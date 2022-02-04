// @ts-check
import { assert } from '@agoric/assert';
import { Nat } from '@agoric/nat';

export const CENTRAL_ISSUER_NAME = 'RUN';

/**
 * @typedef {Object} CollateralConfig
 * @property {string} keyword
 * @property {bigint} collateralValue the initial price of this collateral is
 * provided by tradesGivenCentral[0]
 * @property {bigint} initialMarginPercent
 * @property {bigint} liquidationMarginPercent
 * @property {bigint} interestRateBasis
 * @property {bigint} loanFeeBasis
 */

/**
 * @typedef {Object} IssuerInitializationRecord
 * @property {Issuer} [issuer]
 * @property {Brand} [brand]
 * @property {Array<any>} [issuerArgs]
 * @property {CollateralConfig} [collateralConfig]
 * @property {string} [bankDenom]
 * @property {string} [bankPurse]
 * @property {Payment} [bankPayment]
 * @property {Array<[string, bigint]>} [defaultPurses]
 * @property {Array<[bigint, bigint]>} [tradesGivenCentral]
 */

/**
 * @callback Scaler Scale a number from a (potentially fractional) input to a
 * fixed-precision bigint
 * @param {bigint | number} n the input number to scale, must be a
 * natural number
 * @param {number} [fromDecimalPlaces=0] number of decimal places to keep from the input
 * @returns {bigint} the scaled integer
 */

/**
 * Create a decimal scaler.
 *
 * @param {number} toDecimalPlaces number of decimal places in the scaled value
 * @returns {Scaler}
 */
export const makeScaler = toDecimalPlaces => {
  assert.typeof(toDecimalPlaces, 'number');
  Nat(toDecimalPlaces);
  return (n, fromDecimalPlaces = 0) => {
    assert.typeof(fromDecimalPlaces, 'number');
    Nat(fromDecimalPlaces);
    if (typeof n === 'bigint') {
      // Bigints never preserve decimal places.
      return Nat(n) * 10n ** Nat(toDecimalPlaces);
    }
    // Fractional scaling needs a number, not a bigint.
    assert.typeof(n, 'number');
    return (
      Nat(Math.floor(n * 10 ** fromDecimalPlaces)) *
      10n ** Nat(toDecimalPlaces - fromDecimalPlaces)
    );
  };
};
export const scaleMills = makeScaler(4);
export const scaleMicro = makeScaler(6);
export const scaleEth = makeScaler(18);
export const scaleCentral = scaleMicro;

/** @type {[string, IssuerInitializationRecord]} */
const BLD_ISSUER_ENTRY = [
  'BLD',
  {
    issuerArgs: [undefined, { decimalPlaces: 6 }],
    defaultPurses: [['Agoric staking token', scaleMicro(5000)]],
    bankDenom: 'ubld',
    bankPurse: 'Agoric staking token',
    tradesGivenCentral: [
      [scaleCentral(1.23, 2), scaleMicro(1)],
      [scaleCentral(1.21, 2), scaleMicro(1)],
      [scaleCentral(1.22, 2), scaleMicro(1)],
    ],
  },
];
harden(BLD_ISSUER_ENTRY);
export { BLD_ISSUER_ENTRY };

/** @type {(centralRecord: Partial<IssuerInitializationRecord>) => Array<[string, IssuerInitializationRecord]>} */
const fromCosmosIssuerEntries = centralRecord => [
  [
    CENTRAL_ISSUER_NAME,
    {
      issuerArgs: [undefined, { decimalPlaces: 6 }],
      defaultPurses: [['Agoric RUN currency', scaleMicro(53)]],
      bankPurse: 'Agoric RUN currency',
      tradesGivenCentral: [[1n, 1n]],
      ...centralRecord,
    },
  ],
  BLD_ISSUER_ENTRY,
];

harden(fromCosmosIssuerEntries);
export { fromCosmosIssuerEntries };

/**
 * Note that we can still add these fake currencies to be traded on the AMM.
 * Just don't add a defaultPurses entry if you don't want them to be given out
 * on bootstrap.  They might still be tradable on the AMM.
 *
 * @param {boolean} noObviouslyFakeCurrencies
 * @returns {Array<[string, IssuerInitializationRecord]>}
 */
export const demoIssuerEntries = noObviouslyFakeCurrencies => {
  const doFakePurses = noObviouslyFakeCurrencies ? undefined : true;
  return [
    /* We actually can IBC-transfer Atoms via Pegasus right now. */
    [
      'ATOM',
      {
        issuerArgs: [undefined, { decimalPlaces: 6 }],
        defaultPurses: doFakePurses && [['Cosmos Staking', scaleMicro(68)]],
        collateralConfig: {
          keyword: 'ATOM',
          collateralValue: scaleMicro(1_000_000n),
          initialMarginPercent: 150n,
          liquidationMarginPercent: 125n,
          interestRateBasis: 250n,
          loanFeeBasis: 1n,
        },
        tradesGivenCentral: [
          [scaleCentral(33.28, 2), scaleMicro(1)],
          [scaleCentral(34.61, 2), scaleMicro(1)],
          [scaleCentral(37.83, 2), scaleMicro(1)],
        ],
      },
    ],
    [
      'WETH',
      {
        issuerArgs: [undefined, { decimalPlaces: 18 }],
        collateralConfig: {
          keyword: 'WETH',
          collateralValue: scaleEth(1_000_000n),
          initialMarginPercent: 150n,
          liquidationMarginPercent: 125n,
          interestRateBasis: 250n,
          loanFeeBasis: 1n,
        },
        tradesGivenCentral: [
          [scaleCentral(3286.01, 2), scaleEth(1)],
          [scaleCentral(3435.86, 2), scaleEth(1)],
          [scaleCentral(3443.21, 2), scaleEth(1)],
        ],
      },
    ],
    [
      'LINK',
      {
        issuerArgs: [undefined, { decimalPlaces: 18 }],
        defaultPurses: [['Oracle fee', scaleEth(51n)]],
        collateralConfig: {
          keyword: 'LINK',
          collateralValue: scaleEth(1_000_000n),
          initialMarginPercent: 150n,
          liquidationMarginPercent: 125n,
          interestRateBasis: 250n,
          loanFeeBasis: 1n,
        },
        tradesGivenCentral: [
          [scaleCentral(26.9, 2), scaleEth(1)],
          [scaleCentral(30.59, 2), scaleEth(1)],
          [scaleCentral(30.81, 2), scaleEth(1)],
        ],
      },
    ],
    [
      'USDC',
      {
        issuerArgs: [undefined, { decimalPlaces: 18 }],
        defaultPurses: [['USD Coin', scaleEth(1_323n)]],
        collateralConfig: {
          keyword: 'USDC',
          collateralValue: scaleEth(10_000_000n),
          initialMarginPercent: 150n,
          liquidationMarginPercent: 125n,
          interestRateBasis: 250n,
          loanFeeBasis: 1n,
        },
        tradesGivenCentral: [[scaleCentral(1), scaleEth(1)]],
      },
    ],
    [
      'moola',
      {
        defaultPurses: doFakePurses && [['Fun budget', 1900n]],
        tradesGivenCentral: [
          [scaleCentral(1), 1n],
          [scaleCentral(1.3, 1), 1n],
          [scaleCentral(1.2, 1), 1n],
          [scaleCentral(1.8, 1), 1n],
          [scaleCentral(1.5, 1), 1n],
        ],
      },
    ],
    [
      'simolean',
      {
        defaultPurses: doFakePurses && [['Nest egg', 970n]],
        tradesGivenCentral: [
          [scaleCentral(21.35, 2), 1n],
          [scaleCentral(21.72, 2), 1n],
          [scaleCentral(21.24, 2), 1n],
        ],
      },
    ],
  ];
};

harden(demoIssuerEntries);

const renameMe = async () => {
  const demoIssuers = demoIssuerEntries(noFakeCurrencies);
  // all the non=RUN issuers. RUN can't be initialized until we have the
  // bootstrap payment, but we need to know pool sizes to ask for that.
  const demoAndBldIssuers = [...demoIssuers, BLD_ISSUER_ENTRY];

  // Calculate how much RUN we need to fund the AMM pools
  function ammPoolRunDeposits(issuers) {
    let ammTotal = 0n;
    const ammPoolIssuers = [];
    const ammPoolBalances = [];
    issuers.forEach(entry => {
      const [issuerName, record] = entry;
      if (!record.collateralConfig) {
        // skip RUN and fake issuers
        return;
      }
      assert(record.tradesGivenCentral);
      /** @type {bigint} */
      // The initial trade represents the fair value of RUN for collateral.
      const initialTrade = record.tradesGivenCentral[0];
      // The collateralValue to be deposited is given, and we want to deposit
      // the same value of RUN in the pool. For instance, We're going to
      // deposit 2 * 10^13 BLD, and 10^6 build will trade for 28.9 * 10^6 RUN
      const poolBalance = floorDivide(
        multiply(record.collateralConfig.collateralValue, initialTrade[0]),
        initialTrade[1],
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
  }

  const {
    ammTotal: ammDepositValue,
    ammPoolBalances,
    ammPoolIssuers,
  } = ammPoolRunDeposits(demoAndBldIssuers);

  // We'll usually have something like:
  // {
  //   type: 'AG_COSMOS_INIT',
  //   chainID: 'agoric',
  //   storagePort: 1,
  //   supplyCoins: [
  //     { denom: 'provisionpass', amount: '100' },
  //     { denom: 'sendpacketpass', amount: '100' },
  //     { denom: 'ubld', amount: '1000000000000000' },
  //     { denom: 'urun', amount: '50000000000' }
  //   ]
  //   vbankPort: 3,
  //   vibcPort: 2
  // }
  const { supplyCoins = [] } =
    (vatParameters && vatParameters.argv && vatParameters.argv.bootMsg) || {};

  const centralBootstrapSupply = supplyCoins.find(
    ({ denom }) => denom === CENTRAL_DENOM_NAME,
  ) || { amount: '0' };

  // Now we can bootstrap the economy!
  const bankBootstrapSupply = Nat(BigInt(centralBootstrapSupply.amount));
  // Ask the vaultFactory for enough RUN to fund both AMM and bank.
  const bootstrapPaymentValue = bankBootstrapSupply + ammDepositValue;
  // NOTE: no use of the voteCreator. We'll need it to initiate votes on
  // changing VaultFactory parameters.
  const { vaultFactoryCreator, _voteCreator, ammFacets } = await installEconomy(
    bootstrapPaymentValue,
  );

  const [
    centralIssuer,
    centralBrand,
    ammInstance,
    pegasusInstance,
  ] = await Promise.all([
    E(agoricNames).lookup('issuer', CENTRAL_ISSUER_NAME),
    E(agoricNames).lookup('brand', CENTRAL_ISSUER_NAME),
    E(agoricNames).lookup('instance', 'amm'),
    E(agoricNames).lookup('instance', 'Pegasus'),
  ]);

  // Start the reward distributor.
  const epochTimerService = chainTimerService;
  const distributorParams = {
    epochInterval: 60n * 60n, // 1 hour
  };
  const feeCollectorDepositFacet = await E(bankManager)
    .getFeeCollectorDepositFacet(CENTRAL_DENOM_NAME, {
      issuer: centralIssuer,
      brand: centralBrand,
    })
    .catch(e => {
      console.log('Cannot create fee collector', e);
      return undefined;
    });
  if (feeCollectorDepositFacet) {
    // Only distribute fees if there is a collector.
    E(vats.distributeFees)
      .buildDistributor(
        E(vats.distributeFees).makeFeeCollector(zoe, [
          vaultFactoryCreator,
          ammFacets.ammCreatorFacet,
        ]),
        feeCollectorDepositFacet,
        epochTimerService,
        harden(distributorParams),
      )
      .catch(e => console.error('Error distributing fees', e));
  }

  /**
   * @type {Store<Brand, Payment>} A store containing payments that weren't
   * used by the bank and can be used for other purposes.
   */
  const unusedBankPayments = makeStore('brand');

  /* Prime the bank vat with our bootstrap payment. */
  const centralBootstrapPayment = await E(
    vaultFactoryCreator,
  ).getBootstrapPayment(AmountMath.make(centralBrand, bootstrapPaymentValue));

  const [ammBootstrapPayment, bankBootstrapPayment] = await E(
    centralIssuer,
  ).split(
    centralBootstrapPayment,
    AmountMath.make(centralBrand, ammDepositValue),
  );

  // If there's no bankBridgeManager, we'll find other uses for these funds.
  if (!bankBridgeManager) {
    unusedBankPayments.init(centralBrand, bankBootstrapPayment);
  }

  /** @type {Array<[string, import('./issuers').IssuerInitializationRecord]>} */
  const rawIssuerEntries = [
    ...fromCosmosIssuerEntries({
      issuer: centralIssuer,
      brand: centralBrand,
      bankDenom: CENTRAL_DENOM_NAME,
      bankPayment: bankBootstrapPayment,
    }),
    // We still create demo currencies, but not obviously fake ones unless
    // $FAKE_CURRENCIES is given.
    ...demoIssuers,
  ];

  const issuerEntries = await Promise.all(
    rawIssuerEntries.map(async entry => {
      const [issuerName, record] = entry;
      if (record.issuer !== undefined) {
        return entry;
      }
      /** @type {Issuer} */
      const issuer = await E(vats.mints).makeMintAndIssuer(
        issuerName,
        ...(record.issuerArgs || []),
      );
      const brand = await E(issuer).getBrand();

      const newRecord = harden({ ...record, brand, issuer });

      /** @type {[string, typeof newRecord]} */
      const newEntry = [issuerName, newRecord];
      return newEntry;
    }),
  );

  // Add bank assets.
  await Promise.all(
    issuerEntries.map(async entry => {
      const [issuerName, record] = entry;
      const { bankDenom, bankPurse, brand, issuer, bankPayment } = record;
      if (!bankDenom || !bankPurse) {
        return undefined;
      }

      assert(brand);
      assert(issuer);

      const makeMintKit = async () => {
        // We need to obtain the mint in order to mint the tokens when they
        // come from the bank.
        // FIXME: Be more careful with the mint.
        const mint = await E(vats.mints).getMint(issuerName);
        return harden({ brand, issuer, mint });
      };

      let kitP;
      if (bankBridgeManager && bankPayment) {
        // The bank needs the payment to back its existing bridge peg.
        kitP = harden({ brand, issuer, payment: bankPayment });
      } else if (unusedBankPayments.has(brand)) {
        // No need to back the currency.
        kitP = harden({ brand, issuer });
      } else {
        kitP = makeMintKit();
      }

      const kit = await kitP;
      return E(bankManager).addAsset(bankDenom, issuerName, bankPurse, kit);
    }),
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
      issuerEntries.map(async entry => {
        const [issuerName, record] = entry;
        const config = record.collateralConfig;
        if (!config) {
          return undefined;
        }
        assert(record.tradesGivenCentral);
        const initialPrice = record.tradesGivenCentral[0];
        assert(initialPrice);
        const initialPriceNumerator = /** @type {bigint} */ (initialPrice[0]);
        const rates = {
          initialPrice: makeRatio(
            initialPriceNumerator,
            centralBrand,
            /** @type {bigint} */ (initialPrice[1]),
            record.brand,
          ),
          initialMargin: makeRatio(config.initialMarginPercent, centralBrand),
          liquidationMargin: makeRatio(
            config.liquidationMarginPercent,
            centralBrand,
          ),
          interestRate: makeRatio(
            config.interestRateBasis,
            centralBrand,
            BASIS_POINTS_DENOM,
          ),
          loanFee: makeRatio(
            config.loanFeeBasis,
            centralBrand,
            BASIS_POINTS_DENOM,
          ),
        };

        const collateralPayments = E(vats.mints).mintInitialPayments(
          [issuerName],
          [config.collateralValue],
        );
        const secondaryPayment = E.get(collateralPayments)[0];

        assert(record.issuer, `No issuer for ${issuerName}`);
        const liquidityIssuer = E(ammFacets.ammPublicFacet).addPool(
          record.issuer,
          config.keyword,
        );
        const [secondaryAmount, liquidityBrand] = await Promise.all([
          E(record.issuer).getAmountOf(secondaryPayment),
          E(liquidityIssuer).getBrand(),
        ]);
        const centralAmount = issuerMap[issuerName].amount;
        const proposal = harden({
          want: { Liquidity: AmountMath.makeEmpty(liquidityBrand) },
          give: { Secondary: secondaryAmount, Central: centralAmount },
        });

        E(zoe).offer(
          E(ammFacets.ammPublicFacet).makeAddLiquidityInvitation(),
          proposal,
          harden({
            Secondary: secondaryPayment,
            Central: issuerMap[issuerName].payment,
          }),
        );

        return E(vaultFactoryCreator).addVaultType(
          record.issuer,
          config.keyword,
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

  const [ammPublicFacet, pegasus] = await Promise.all(
    [ammInstance, pegasusInstance].map(instance =>
      E(zoe).getPublicFacet(instance),
    ),
  );
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
