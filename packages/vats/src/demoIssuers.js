// @ts-check
import { assert } from '@agoric/assert';
import { AmountMath, AssetKind } from '@agoric/ertp';
import { Nat } from '@agoric/nat';
import { Collect } from '@agoric/run-protocol/src/collect.js';
import {
  natSafeMath,
  makeRatio,
} from '@agoric/zoe/src/contractSupport/index.js';
import { E } from '@endo/far';

const { multiply, floorDivide } = natSafeMath;
const { entries, fromEntries, keys } = Object;

export const CENTRAL_ISSUER_NAME = 'RUN';
const CENTRAL_DENOM_NAME = 'urun';

const DecimalPlaces = {
  BLD: 6,
  [CENTRAL_ISSUER_NAME]: 6,
  ATOM: 6,
  WETH: 18,
  LINK: 18,
  USDC: 18,
};

/** @type {Record<string, { petName: string, balance: bigint}>} */
const FaucetPurseDetail = {
  [CENTRAL_ISSUER_NAME]: { petName: 'Agoric RUN currency', balance: 53n },
  LINK: { petName: 'Oracle fee', balance: 51n },
  USDC: { petName: 'USD Coin', balance: 1_323n },
};

const FakePurseDetail = {
  ATOM: { petName: 'Cosmos Staking', balance: 68n },
  moola: { petName: 'Fun budget', balance: 1900n },
  simolean: { petName: 'Nest egg', balance: 970n },
};

const PCT = 100n;
const BASIS = 10_000n;

/**
 * @typedef {[bigint, bigint]} Rational
 *
 * TODO: test vs 50m from sim-chain.js
 *
 * @type { Record<string, {
 *   config?: {
 *     collateralValue: bigint,
 *     initialMargin: Rational,
 *     liquidationMargin: Rational,
 *     interestRate: Rational,
 *     loanFee: Rational,
 *   },
 *   trades: Array<{ central: number, collateral: bigint}>
 * }>}
 */
export const AMMDemoState = {
  // TODO: getRUN makes BLD obsolete here
  BLD: {
    config: {
      collateralValue: 20_000_000n,
      initialMargin: [150n, PCT],
      liquidationMargin: [125n, PCT],
      interestRate: [250n, BASIS],
      loanFee: [1n, BASIS],
    },
    trades: [
      { central: 1.23, collateral: 1n },
      { central: 1.21, collateral: 1n },
      { central: 1.22, collateral: 1n },
    ],
  },

  /* We actually can IBC-transfer Atoms via Pegasus right now. */
  ATOM: {
    config: {
      collateralValue: 1_000_000n,
      initialMargin: [150n, PCT],
      liquidationMargin: [125n, PCT],
      interestRate: [250n, BASIS],
      loanFee: [1n, BASIS],
    },
    trades: [
      { central: 33.28, collateral: 1n },
      { central: 34.61, collateral: 1n },
      { central: 37.83, collateral: 1n },
    ],
  },

  WETH: {
    config: {
      collateralValue: 1_000_000n,
      initialMargin: [150n, PCT],
      liquidationMargin: [125n, PCT],
      interestRate: [250n, BASIS],
      loanFee: [1n, BASIS],
    },
    trades: [
      { central: 3286.01, collateral: 1n },
      { central: 3435.86, collateral: 1n },
      { central: 3443.21, collateral: 1n },
    ],
  },

  LINK: {
    config: {
      collateralValue: 1_000_000n,
      initialMargin: [150n, PCT],
      liquidationMargin: [125n, PCT],
      interestRate: [250n, BASIS],
      loanFee: [1n, BASIS],
    },
    trades: [
      { central: 26.9, collateral: 1n },
      { central: 30.59, collateral: 1n },
      { central: 30.81, collateral: 1n },
    ],
  },

  USDC: {
    config: {
      collateralValue: 10_000_000n,
      initialMargin: [150n, PCT],
      liquidationMargin: [125n, PCT],
      interestRate: [250n, BASIS],
      loanFee: [1n, BASIS],
    },
    trades: [{ central: 1, collateral: 1n }],
  },

  moola: {
    trades: [
      { central: 1, collateral: 1n },
      { central: 1.3, collateral: 1n },
      { central: 1.2, collateral: 1n },
      { central: 1.8, collateral: 1n },
      { central: 1.5, collateral: 1n },
    ],
  },

  simolean: {
    trades: [
      { central: 21.35, collateral: 1n },
      { central: 21.72, collateral: 1n },
      { central: 21.24, collateral: 1n },
    ],
  },
};

/** @param { number } f */
const run2places = f =>
  BigInt(Math.round(f * 100)) *
  10n ** BigInt(DecimalPlaces[CENTRAL_ISSUER_NAME] - 2);

/**
 * Calculate how much RUN we need to fund the AMM pools
 *
 * @param {typeof AMMDemoState} issuers
 */
export const ammPoolRunDeposits = issuers => {
  let ammTotal = 0n;
  const ammPoolIssuers = /** @type {string[]} */ ([]);
  const ammPoolBalances = /** @type {bigint[]} */ ([]);
  entries(issuers).forEach(([issuerName, record]) => {
    if (!record.config) {
      // skip RUN and fake issuers
      return;
    }
    assert(record.trades);

    /** @param { bigint } n */
    const inCollateral = n => n * 10n ** DecimalPlaces[issuerName];

    // The initial trade represents the fair value of RUN for collateral.
    const initialTrade = record.trades[0];
    // The collateralValue to be deposited is given, and we want to deposit
    // the same value of RUN in the pool. For instance, We're going to
    // deposit 2 * 10^13 BLD, and 10^6 build will trade for 28.9 * 10^6 RUN
    const poolBalance = floorDivide(
      multiply(
        inCollateral(record.config.collateralValue),
        run2places(initialTrade.central),
      ),
      inCollateral(initialTrade.collateral),
    );
    ammTotal += poolBalance;
    ammPoolIssuers.push(issuerName);
    ammPoolBalances.push(poolBalance);
  });
  return {
    ammTotal,
    ammPoolBalances,
    ammPoolIssuers,
  };
};

/**
 * @param { BootstrapPowers & {
 *   consume: { loadVat: VatLoader<MintsVat> }
 * }} powers
 */
export const fundAMM = async ({
  consume: {
    zoe,
    agoricNames,
    centralSupplyBundle: centralP,
    feeMintAccess: feeMintAccessP,
    loadVat,
    vaultFactoryCreator,
  },
}) => {
  const {
    ammTotal: ammDepositValue,
    ammPoolBalances,
    ammPoolIssuers,
  } = ammPoolRunDeposits(AMMDemoState);

  const [centralIssuer, centralBrand, ammInstance] = await Promise.all([
    E(agoricNames).lookup('issuer', CENTRAL_ISSUER_NAME),
    E(agoricNames).lookup('brand', CENTRAL_ISSUER_NAME),
    E(agoricNames).lookup('instance', 'amm'),
  ]);
  const ammPublicFacet = await E(zoe).getPublicFacet(ammInstance);

  const [centralSupplyBundle, feeMintAccess] = await Promise.all([
    centralP,
    feeMintAccessP,
  ]);
  const { creatorFacet: ammSupplier } = await E(zoe).startInstance(
    E(zoe).install(centralSupplyBundle),
    { Central: centralIssuer },
    { bootstrapPaymentValue: ammDepositValue },
    { feeMintAccess },
  );
  /** @type { Payment } */
  const ammBootstrapPayment = await E(ammSupplier).getBootstrapPayment();

  const vats = {
    mints: E(loadVat)('mints'),
  };

  const [bldIssuer, bldBrand] = await Promise.all([
    E(agoricNames).lookup('issuer', 'BLD'),
    E(agoricNames).lookup('brand', 'BLD'),
  ]);

  const kits = await Collect.allValues(
    Collect.mapValues(
      fromEntries(keys(AMMDemoState).map(n => [n, n])),
      async issuerName => {
        switch (issuerName) {
          case 'RUN':
            return { issuer: centralIssuer, brand: centralBrand };
          case 'BLD':
            return { issuer: bldIssuer, brand: bldBrand };
          default: {
            const issuer = await E(vats.mints).makeMintAndIssuer(
              issuerName,
              AssetKind.NAT,
              {
                decimalPlaces: DecimalPlaces[issuerName],
              },
            );
            const brand = await E(issuer).getBrand();
            return { issuer, brand };
          }
        }
      },
    ),
  );

  async function addAllCollateral() {
    async function splitAllCentralPayments() {
      const ammPoolAmounts = ammPoolBalances.map(b =>
        AmountMath.make(centralBrand, b),
      );

      const allPayments = await E(centralIssuer).splitMany(
        ammBootstrapPayment,
        ammPoolAmounts,
      );

      const issuerMap = {};
      for (let i = 0; i < ammPoolBalances.length; i += 1) {
        const issuerName = ammPoolIssuers[i];
        issuerMap[issuerName] = {
          payment: allPayments[i],
          amount: ammPoolAmounts[i],
        };
      }
      return issuerMap;
    }

    const issuerMap = await splitAllCentralPayments();

    return Promise.all(
      entries(AMMDemoState).map(async ([issuerName, record]) => {
        /** @param { bigint } n */
        const inCollateral = n => n * 10n ** BigInt(DecimalPlaces[issuerName]);
        const config = record.config;
        if (!config) {
          return undefined;
        }
        assert(record.trades);
        const initialPrice = record.trades[0];
        assert(initialPrice);
        const initialPriceNumerator = run2places(record.trades[0].central);

        /**
         * @param {Rational} r
         * @param {Brand} b
         */
        const toRatio = ([n, d], b) => makeRatio(n, b, d);
        const rates = {
          initialPrice: makeRatio(
            initialPriceNumerator,
            centralBrand,
            inCollateral(initialPrice.collateral),
            kits[issuerName].brand,
          ),
          initialMargin: toRatio(config.initialMargin, centralBrand),
          liquidationMargin: toRatio(config.liquidationMargin, centralBrand),
          interestRate: toRatio(config.interestRate, centralBrand),
          loanFee: toRatio(config.loanFee, centralBrand),
        };

        const collateralPayments = E(vats.mints).mintInitialPayments(
          [issuerName],
          [inCollateral(config.collateralValue)],
        );
        const secondaryPayment = E.get(collateralPayments)[0];

        const kit = kits[issuerName];
        assert(kit.issuer, `No issuer for ${issuerName}`);
        const liquidityIssuer = E(ammPublicFacet).addPool(
          kit.issuer,
          issuerName,
        );
        const [secondaryAmount, liquidityBrand] = await Promise.all([
          E(kit.issuer).getAmountOf(secondaryPayment),
          E(liquidityIssuer).getBrand(),
        ]);
        const centralAmount = issuerMap[issuerName].amount;
        const proposal = harden({
          want: { Liquidity: AmountMath.makeEmpty(liquidityBrand) },
          give: { Secondary: secondaryAmount, Central: centralAmount },
        });

        E(zoe).offer(
          E(ammPublicFacet).makeAddLiquidityInvitation(),
          proposal,
          harden({
            Secondary: secondaryPayment,
            Central: issuerMap[issuerName].payment,
          }),
        );

        return E(vaultFactoryCreator).addVaultType(
          kit.issuer,
          issuerName,
          rates,
        );
      }),
    );
  }

  /**
   * @param {ERef<Issuer>} issuerIn
   * @param {ERef<Issuer>} issuerOut
   * @param {ERef<Brand>} brandIn
   * @param {ERef<Brand>} brandOut
   * @param {Array<[bigint | number, bigint | number]>} tradeList
   */
  const makeFakePriceAuthority = (
    issuerIn,
    issuerOut,
    brandIn,
    brandOut,
    tradeList,
  ) =>
    E(vats.priceAuthority).makeFakePriceAuthority({
      issuerIn,
      issuerOut,
      actualBrandIn: brandIn,
      actualBrandOut: brandOut,
      tradeList,
      timer: chainTimerService,
      quoteInterval: QUOTE_INTERVAL,
    });

  await addAllCollateral();

  const brandsWithPriceAuthorities = await E(ammPublicFacet).getAllPoolBrands();

  await Promise.all(
    issuerEntries.map(async entry => {
      // Create priceAuthority pairs for centralIssuer based on the
      // AMM or FakePriceAuthority.
      const [issuerName, record] = entry;
      console.debug(`Creating ${issuerName}-${CENTRAL_ISSUER_NAME}`);
      const { tradesGivenCentral, issuer } = record;

      assert(issuer);
      const brand = await E(issuer).getBrand();
      let toCentral;
      let fromCentral;

      if (brandsWithPriceAuthorities.includes(brand)) {
        ({ toCentral, fromCentral } = await E(ammPublicFacet)
          .getPriceAuthorities(brand)
          .catch(_e => {
            // console.warn('could not get AMM priceAuthorities', _e);
            return {};
          }));
      }

      if (!fromCentral && tradesGivenCentral) {
        // We have no amm from-central price authority, make one from trades.
        if (issuerName !== CENTRAL_ISSUER_NAME) {
          console.log(
            `Making fake price authority for ${CENTRAL_ISSUER_NAME}-${issuerName}`,
          );
        }
        fromCentral = makeFakePriceAuthority(
          centralIssuer,
          issuer,
          centralBrand,
          brand,
          tradesGivenCentral,
        );
      }

      if (!toCentral && centralIssuer !== issuer && tradesGivenCentral) {
        // We have no amm to-central price authority, make one from trades.
        console.log(
          `Making fake price authority for ${issuerName}-${CENTRAL_ISSUER_NAME}`,
        );
        /** @type {Array<[bigint | number, bigint | number]>} */
        const tradesGivenOther = tradesGivenCentral.map(
          ([valueCentral, valueOther]) => [valueOther, valueCentral],
        );
        toCentral = makeFakePriceAuthority(
          issuer,
          centralIssuer,
          brand,
          centralBrand,
          tradesGivenOther,
        );
      }

      // Register the price pairs.
      await Promise.all(
        [
          [fromCentral, centralBrand, brand],
          [toCentral, brand, centralBrand],
        ].map(async ([pa, fromBrand, toBrand]) => {
          const paPresence = await pa;
          if (!paPresence) {
            return;
          }
          await E(priceAuthorityAdmin).registerPriceAuthority(
            paPresence,
            fromBrand,
            toBrand,
          );
        }),
      );
    }),
  );
};
