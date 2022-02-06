// @ts-check
import { assert } from '@agoric/assert';
import { AmountMath, AssetKind } from '@agoric/ertp';
import { Collect } from '@agoric/run-protocol/src/collect.js';
import {
  natSafeMath,
  makeRatio,
} from '@agoric/zoe/src/contractSupport/index.js';
import { E } from '@endo/far';

const { multiply, floorDivide } = natSafeMath;
const { entries, fromEntries, keys, values } = Object;

const CENTRAL_ISSUER_NAME = 'RUN';
const QUOTE_INTERVAL = 5 * 60;

/** @type {Record<string, number>} */
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
  const balanceEntries = entries(issuers)
    .filter(([_i, { config }]) => config) // skip RUN and fake issuers
    .map(([issuerName, record]) => {
      assert(record.config);
      assert(record.trades);

      /** @param { bigint } n */
      const inCollateral = n => n * 10n ** BigInt(DecimalPlaces[issuerName]);

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
      return /** @type {[string, bigint]} */ ([issuerName, poolBalance]);
    });
  return {
    ammTotal,
    balances: fromEntries(balanceEntries),
  };
};

/**
 * @param {Payment} bootstrapPayment
 * @param {Record<string, bigint>} balances
 * @param {{ issuer: Issuer, brand: Brand }} central
 */
export const splitAllCentralPayments = async (
  bootstrapPayment,
  balances,
  central,
) => {
  const ammPoolAmounts = values(balances).map(b =>
    AmountMath.make(central.brand, b),
  );

  const allPayments = await E(central.issuer).splitMany(
    bootstrapPayment,
    ammPoolAmounts,
  );

  const issuerMap = fromEntries(
    keys(balances).map((name, i) => [
      name,
      {
        payment: allPayments[i],
        amount: ammPoolAmounts[i],
      },
    ]),
  );

  return issuerMap;
};

/**
 * @param {string} issuerName
 * @param {typeof AMMDemoState['ATOM']} record
 * @param {Record<string, { issuer: Issuer, brand: Brand }>} kits
 * @param {{ issuer: Issuer, brand: Brand }} central
 */
export const poolRates = (issuerName, record, kits, central) => {
  /** @param { bigint } n */
  const inCollateral = n => n * 10n ** BigInt(DecimalPlaces[issuerName]);
  const config = record.config;
  assert(config);
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
      central.brand,
      inCollateral(initialPrice.collateral),
      kits[issuerName].brand,
    ),
    initialMargin: toRatio(config.initialMargin, central.brand),
    liquidationMargin: toRatio(config.liquidationMargin, central.brand),
    interestRate: toRatio(config.interestRate, central.brand),
    loanFee: toRatio(config.loanFee, central.brand),
  };
  return { rates, initialValue: inCollateral(config.collateralValue) };
};

/**
 * @param { EconomyBootstrapPowers & {
 *   consume: { loadVat: VatLoader<MintsVat> }
 * }} powers
 */
export const fundAMM = async ({
  consume: {
    agoricNames,
    centralSupplyBundle: centralP,
    chainTimerService,
    feeMintAccess: feeMintAccessP,
    loadVat,
    priceAuthorityAdmin,
    vaultFactoryCreator,
    zoe,
  },
}) => {
  const { ammTotal: ammDepositValue, balances } = ammPoolRunDeposits(
    AMMDemoState,
  );

  const vats = {
    mints: E(loadVat)('mints'),
  };

  const kits = await Collect.allValues(
    Collect.mapValues(
      fromEntries(
        [CENTRAL_ISSUER_NAME, ...keys(AMMDemoState)].map(n => [n, n]),
      ),
      async issuerName => {
        switch (issuerName) {
          case CENTRAL_ISSUER_NAME:
          case 'BLD': {
            const [issuer, brand] = await Promise.all([
              E(agoricNames).lookup('issuer', issuerName),
              E(agoricNames).lookup('brand', issuerName),
            ]);
            return { issuer, brand };
          }
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
  const central = kits[CENTRAL_ISSUER_NAME];

  /** @type {[SourceBundle, FeeMintAccess, Instance, TimerService]} */
  const [
    centralSupplyBundle,
    feeMintAccess,
    ammInstance,
    timer,
  ] = await Promise.all([
    centralP,
    feeMintAccessP,
    E(agoricNames).lookup('instance', 'amm'),
    chainTimerService,
  ]);
  const ammPublicFacet = await E(zoe).getPublicFacet(ammInstance);

  const { creatorFacet: ammSupplier } = await E(zoe).startInstance(
    E(zoe).install(centralSupplyBundle),
    { Central: central.issuer },
    { bootstrapPaymentValue: ammDepositValue },
    { feeMintAccess },
  );
  /** @type { Payment } */
  const ammBootstrapPayment = await E(ammSupplier).getBootstrapPayment();

  async function addAllCollateral() {
    const issuerMap = await splitAllCentralPayments(
      ammBootstrapPayment,
      balances,
      central,
    );

    return Promise.all(
      entries(AMMDemoState).map(async ([issuerName, record]) => {
        const { rates, initialValue } = poolRates(
          issuerName,
          record,
          kits,
          central,
        );

        const collateralPayments = E(vats.mints).mintInitialPayments(
          [issuerName],
          [initialValue],
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
      timer,
      quoteInterval: QUOTE_INTERVAL,
    });

  await addAllCollateral();

  const brandsWithPriceAuthorities = await E(ammPublicFacet).getAllPoolBrands();

  await Promise.all(
    // TODO: exactly what is the list of things to iterate here?
    entries(AMMDemoState).map(async ([issuerName, record]) => {
      // Create priceAuthority pairs for centralIssuer based on the
      // AMM or FakePriceAuthority.
      console.debug(`Creating ${issuerName}-${CENTRAL_ISSUER_NAME}`);
      const issuer = kits[issuerName].issuer;
      const { trades } = record;
      /** @param { bigint } n */
      const inCollateral = n => n * 10n ** BigInt(DecimalPlaces[issuerName]);
      const tradesGivenCentral = trades.map(
        ({
          central: num,
          collateral: unit,
        }) => /** @type {[bigint, bigint]} */ ([
          run2places(num),
          inCollateral(unit),
        ]),
      );
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
          central.issuer,
          issuer,
          central.brand,
          brand,
          tradesGivenCentral,
        );
      }

      if (!toCentral && central.issuer !== issuer && tradesGivenCentral) {
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
          central.issuer,
          brand,
          central.brand,
          tradesGivenOther,
        );
      }

      // Register the price pairs.
      await Promise.all(
        [
          [fromCentral, central.brand, brand],
          [toCentral, brand, central.brand],
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
