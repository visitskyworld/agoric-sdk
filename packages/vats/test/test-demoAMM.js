// @ts-check
// eslint-disable-next-line import/no-extraneous-dependencies
import { test } from '@agoric/swingset-vat/tools/prepare-test-env-ava.js';
import { AmountMath, makeIssuerKit } from '@agoric/ertp';
import {
  setUpZoeForTest,
  setupAmmServices,
} from '@agoric/run-protocol/test/amm/vpool-xyk-amm/setup.js';
import centralSupplyBundle from '@agoric/run-protocol/bundles/bundle-centralSupply.js';
import buildManualTimer from '@agoric/zoe/tools/manualTimer.js';

import { E } from '@endo/far';
import {
  connectFaucet,
  AMMDemoState,
  ammPoolRunDeposits,
  fundAMM,
  poolRates,
  splitAllCentralPayments,
} from '../src/demoIssuers.js';
import { buildRootObject as bldMintRoot } from '../src/vat-mints.js';
import { makePromiseSpace } from '../src/core/utils.js';

/**
 * @param {bigint} frac
 * @param {number} exp
 * @returns
 */
const pad0 = (frac, exp) =>
  `${`${'0'.repeat(exp)}${frac}`.slice(-exp)}`.replace(/0+$/, '');

/** @param { bigint } whole */
const separators = whole => {
  const sep = '_';
  // ack: https://stackoverflow.com/a/45950572/7963, https://regex101.com/
  const revStr = s => s.split('').reverse().join('');
  const lohi = revStr(`${whole}`);
  const s = lohi.replace(/(?=\d{4})(\d{3})/g, (m, p1) => `${p1}${sep}`);
  return revStr(s);
};

/**
 * @param {bigint} n
 * @param {number} exp
 */
const decimal = (n, exp) => {
  const unit = 10n ** BigInt(exp);
  const [whole, frac] = [n / unit, n % unit];
  return frac !== 0n
    ? `${separators(whole)}.${pad0(frac, exp)}`
    : `${separators(whole)}`;
};

/** @param { bigint } n */
const showRUN = n => `${decimal(n, 6)} RUN`;

test('urun -> RUN formatting test utility', t => {
  t.is(showRUN(123456789n), '123.456789 RUN', 'RUN decimal point');
  t.is(showRUN(1234567890n), '1_234.56789 RUN', 'thousands separators');
  t.is(showRUN(3286010000000000n), '3_286_010_000 RUN', 'regression 1');
});

test('ammPoolRunDeposits: check total, WETH', t => {
  const actual = ammPoolRunDeposits(AMMDemoState);
  t.log(actual);
  t.deepEqual(showRUN(actual.ammTotal), '3_380_790_000 RUN');
  t.deepEqual(showRUN(actual.balances.WETH), '3_286_010_000 RUN');
});

test('splitAllCentralPayments: count entries, spot check', async t => {
  const central = makeIssuerKit('RUN', 'nat', harden({ decimalPlaces: 6 }));
  const deposits = ammPoolRunDeposits(AMMDemoState);
  const bootstrapPayment = central.mint.mintPayment(
    AmountMath.make(central.brand, deposits.ammTotal),
  );
  const actual = await splitAllCentralPayments(
    bootstrapPayment,
    deposits.balances,
    central,
  );
  t.log(actual);
  t.is(actual.ATOM.amount.brand, central.brand);
  t.deepEqual(showRUN(actual.ATOM.amount.value), '33_280_000 RUN');
  t.deepEqual(Object.keys(actual), ['BLD', 'ATOM', 'WETH', 'LINK', 'USDC']);
});

const showBrand = b => `${b}`.replace(/.object Alleged: (.*) brand./, '$1');
const Decimals = { RUN: 6, BLD: 6, ATOM: 6, WETH: 18, LINK: 18, USDC: 18 };
const showAmount = ({ brand, value }) => {
  const b = `${showBrand(brand)}`;
  return `${decimal(value, Decimals[b])} ${b}`;
};

test('poolRates: spot check WETH', t => {
  const central = makeIssuerKit('RUN', 'nat', harden({ decimalPlaces: 6 }));
  const weth = makeIssuerKit('WETH', 'nat', harden({ decimalPlaces: 18 }));
  const kits = { RUN: central, WETH: weth };
  const { rates, initialValue } = poolRates(
    'WETH',
    AMMDemoState.WETH,
    kits,
    central,
  );

  t.is(decimal(initialValue, Decimals.WETH), '1_000_000');
  t.is((AMMDemoState.WETH.config || {}).collateralValue, 1_000_000n);

  t.is(showBrand(rates.interestRate.numerator.brand), 'RUN');
  t.is(showAmount(rates.interestRate.numerator), '0.00025 RUN');

  // const showRatio = ({ numerator, denominator }) =>
  //   `${showAmount(numerator)} / ${showAmount(denominator)}`;
  const showRatio = ({ numerator, denominator }) =>
    numerator.brand === denominator.brand
      ? `${decimal(
          (numerator.value *
            10n ** BigInt(Decimals[showBrand(numerator.brand)])) /
            denominator.value,
          Decimals[showBrand(numerator.brand)],
        )}`
      : `${showAmount(numerator)} / ${showAmount(denominator)}`;
  const expected = {
    initialPrice: '3_286.01 RUN / 1 WETH',
    initialMargin: '1.5',
    liquidationMargin: '1.25',
    interestRate: '0.025',
    loanFee: '0.0001',
  };
  Object.entries(expected).forEach(([prop, val]) =>
    t.is(showRatio(rates[prop]), val),
  );
});

test('fundAMM bootstrap behavior', async t => {
  const centralR = makeIssuerKit('central');
  const electorateTerms = { committeeName: 'The Cabal', committeeSize: 1 };
  const timer = buildManualTimer(console.log);

  const {
    zoe,
    amm,
    committeeCreator,
    governor,
    installs,
    invitationAmount,
    space,
  } = await setupAmmServices(electorateTerms, centralR, timer);
  await fundAMM(space);
  t.is('@@actual', '@@expected');
});

test('connectFaucet produces payments', async t => {
  const space = /** @type {any} */ (makePromiseSpace());
  const { consume, produce } =
    /** @type { BootstrapPowers & { consume: { loadVat: (n: 'mints') => MintsVat }} } */ (
      space
    );

  const { zoe, feeMintAccess } = await setUpZoeForTest();
  produce.zoe.resolve(zoe);
  produce.feeMintAccess.resolve(feeMintAccess);
  produce.centralSupplyBundle.resolve(centralSupplyBundle);

  produce.loadVat.resolve(name => {
    assert.equal(name, 'mints');
    return bldMintRoot();
  });

  t.plan(3); // bank deposit, faucet payments, mints

  const bldKit = makeIssuerKit('BLD');
  produce.bldIssuerKit.resolve(bldKit);
  produce.bankManager.resolve(
    Promise.resolve({
      getBankForAddress: _a => ({
        // @ts-ignore never mind other methods
        getPurse: () => ({
          deposit: async (pmt, _x) => {
            const amt = await E(bldKit.issuer).getAmountOf(pmt);
            t.is(showAmount(amt), '5_000 BLD');
            return amt;
          },
        }),
      }),
    }),
  );

  produce.bridgeManager.resolve(undefined);
  // TODO: test for payment rather than bank deposit:
  // produce.bridgeManager.resolve({});
  produce.client.resolve({
    assignBundle: async ([makeProps]) => {
      const props = await makeProps('addr1');
      // @ts-ignore props are unknown; we test that it's a faucet
      const paymentRecords = await E(props.faucet).tapFaucet();
      t.log(paymentRecords);
      const detail = await Promise.all(
        paymentRecords.map(({ issuer, payment, pursePetName }) =>
          E(issuer)
            .getAmountOf(payment)
            .then(a => [pursePetName, showAmount(a)]),
        ),
      );
      t.deepEqual(detail, [
        ['Agoric RUN currency', '53 RUN'],
        ['Oracle fee', '51 LINK'],
        ['USD Coin', '1_323 USDC'],
      ]);
    },
  });

  await connectFaucet({ consume, produce });
  const m = await produce.mints;
  t.truthy(m);
});
