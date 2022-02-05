// @ts-check
import { E, Far } from '@endo/far';
import { makeIssuerKit } from '@agoric/ertp';

import { makeNameHubKit } from '../nameHub.js';

import { feeIssuerConfig, collectNameAdmins, makeNameAdmins } from './utils.js';

const Tokens = {
  RUN: {
    denom: 'urun',
    suggestedName: 'Agoric RUN currency',
  },
  BLD: {
    denom: 'ubld',
    suggestedName: 'Agoric staking token',
  },
};

/**
 * In golang/cosmos/app/app.go, we define
 * cosmosInitAction with type AG_COSMOS_INIT,
 * with the following shape.
 *
 * The urun supplyCoins value is taken from geneis,
 * thereby authorizing the minting an initial supply of RUN.
 */
// eslint-disable-next-line no-unused-vars
const bootMsgEx = {
  type: 'AG_COSMOS_INIT',
  chainID: 'agoric',
  storagePort: 1,
  supplyCoins: [
    { denom: 'provisionpass', amount: '100' },
    { denom: 'sendpacketpass', amount: '100' },
    { denom: 'ubld', amount: '1000000000000000' },
    { denom: 'urun', amount: '50000000000' },
  ],
  vbankPort: 3,
  vibcPort: 2,
};

/**
 * TODO: review behaviors carefully for powers that go out of scope,
 * since we may want/need them later.
 */

/** @param {BootstrapPowers} powers */
export const makeVatsFromBundles = ({
  vats,
  devices,
  produce: { vatAdminSvc, loadVat },
}) => {
  const svc = E(vats.vatAdmin).createVatAdminService(devices.vatAdmin);
  vatAdminSvc.resolve(svc);
  // TODO: getVat? do we need to memoize this by name?
  // TODO: rename loadVat to createVatByName?
  loadVat.resolve(bundleName => {
    console.info(`createVatByName(${bundleName})`);
    const root = E(svc)
      .createVatByName(bundleName)
      .then(r => r.root);
    return root;
  });
};
harden(makeVatsFromBundles);

/**
 * @param { BootstrapPowers & {
 *   consume: { loadVat: ERef<VatLoader<ZoeVat>> }
 * }} powers
 *
 * @typedef {ERef<ReturnType<import('../vat-zoe.js').buildRootObject>>} ZoeVat
 */
export const buildZoe = async ({
  consume: { agoricNames, vatAdminSvc, loadVat, client, nameAdmins },
  produce: { zoe, feeMintAccess },
}) => {
  const { zoeService, feeMintAccess: fma } = await E(
    E(loadVat)('zoe'),
  ).buildZoe(vatAdminSvc, feeIssuerConfig);

  zoe.resolve(zoeService);

  const runIssuer = await E(zoeService).getFeeIssuer();
  const runBrand = await E(runIssuer).getBrand();
  const [issuerAdmin, brandAdmin] = await collectNameAdmins(
    ['issuer', 'brand'],
    agoricNames,
    nameAdmins,
  );

  feeMintAccess.resolve(fma);
  return Promise.all([
    E(issuerAdmin).update('RUN', runIssuer),
    E(brandAdmin).update('RUN', runBrand),
    E(client).assignBundle([_addr => ({ zoe: zoeService })]),
  ]);
};
harden(buildZoe);

/**
 * TODO: rename this to getBoard?
 *
 * @param {BootstrapPowers & {
 *   consume: { loadVat: ERef<VatLoader<BoardVat>>
 * }}} powers
 * @typedef {ERef<ReturnType<import('../vat-board.js').buildRootObject>>} BoardVat
 */
export const makeBoard = async ({
  consume: { loadVat, client },
  produce: {
    board: { resolve: resolveBoard },
  },
}) => {
  const board = E(E(loadVat)('board')).getBoard();
  resolveBoard(board);
  return E(client).assignBundle([_addr => ({ board })]);
};
harden(makeBoard);

/** @param {BootstrapPowers} powers */
export const makeAddressNameHubs = async ({ consume: { client }, produce }) => {
  const { nameHub: namesByAddress, nameAdmin: namesByAddressAdmin } =
    makeNameHubKit();

  const { agoricNames, agoricNamesAdmin, nameAdmins } = makeNameAdmins();

  produce.nameAdmins.resolve(nameAdmins);
  produce.agoricNames.resolve(agoricNames);
  produce.agoricNamesAdmin.resolve(agoricNamesAdmin);
  produce.namesByAddress.resolve(namesByAddress);
  produce.namesByAddressAdmin.resolve(namesByAddressAdmin);

  const perAddress = address => {
    // Create a name hub for this address.
    const { nameHub: myAddressNameHub, nameAdmin: rawMyAddressNameAdmin } =
      makeNameHubKit();
    // Register it with the namesByAddress hub.
    namesByAddressAdmin.update(address, myAddressNameHub);

    /** @type {MyAddressNameAdmin} */
    const myAddressNameAdmin = Far('myAddressNameAdmin', {
      ...rawMyAddressNameAdmin,
      getMyAddress: () => address,
    });
    return { agoricNames, namesByAddress, myAddressNameAdmin };
  };

  return E(client).assignBundle([perAddress]);
};
harden(makeAddressNameHubs);

/**
 * @param {BootstrapPowers & {
 *   consume: { loadVat: ERef<VatLoader<BankVat>> },
 * }} powers
 * @typedef {ERef<ReturnType<import('../vat-bank.js').buildRootObject>>} BankVat
 */
export const makeClientBanks = async ({
  consume: { loadVat, client, bridgeManager },
  produce: { bankManager },
}) => {
  const mgr = E(E(loadVat)('bank')).makeBankManager(bridgeManager);
  bankManager.resolve(mgr);
  return E(client).assignBundle([
    address => ({ bank: E(mgr).getBankForAddress(address) }),
  ]);
};
harden(makeClientBanks);

/**
 * @param { BootstrapPowers & {
 *   vatParameters: { argv: { bootMsg?: typeof bootMsgEx }}
 * }} powers
 */
export const mintCentralSupply = async ({
  vatParameters: {
    argv: { bootMsg },
  },
  consume: {
    agoricNames,
    bankManager,
    centralSupplyBundle,
    feeMintAccess: feeMintAccessP,
    zoe,
  },
  produce: { initialSupply },
}) => {
  const { supplyCoins = [] } = bootMsg || {};

  const centralBootstrapSupply = supplyCoins.find(
    ({ denom }) => denom === CENTRAL_DENOM_NAME,
  ) || { amount: '0' };

  const bootstrapPaymentValue = Nat(BigInt(centralBootstrapSupply.amount));

  const installation = E(zoe).install(centralSupplyBundle);
  const [feeMintAccess, runIssuer] = await Promise.all([
    feeMintAccessP,
    E(agoricNames).lookup('issuer', 'RUN'),
  ]);
  const start = E(zoe).startInstance(
    installation,
    { Central: runIssuer },
    { bootstrapPaymentValue },
    { feeMintAccess },
  );
  const payment = await E(E.get(start).creatorFacet).getBootstrapPayment();
  // TODO: is it OK for creatorFacet, instance, installation to be dropped?
  initialSupply.resolve(payment);

  const [issuerName, { bankDenom, bankPurse, issuerArgs }] = BLD_ISSUER_ENTRY;
  assert(issuerArgs);
  const kit = makeIssuerKit(issuerName, ...issuerArgs); // TODO: should this live in another vat???
  await E(bankManager).addAsset(bankDenom, issuerName, bankPurse, kit);
  const { brand, issuer } = kit;
  const [issuerAdmin, brandAdmin] = await collectNameAdmins(
    ['issuer', 'brand'],
    agoricNames,
    nameAdmins,
  );
  return Promise.all([
    E(issuerAdmin).update(issuerName, issuer),
    E(brandAdmin).update(issuerName, brand),
  ]);
};

/**
 * Note that we can still add these fake currencies to be traded on the AMM.
 * Just don't add a defaultPurses entry if you don't want them to be given out
 * on bootstrap.  They might still be tradable on the AMM.
 *
 * @param {boolean} noObviouslyFakeCurrencies
 * @returns {Array<[string, IssuerInitializationRecord]>}
 */

/** @param { BootstrapPowers } powers */
export const addBankAssets = async ({ consume: { bankManager } }) => {
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
};
harden(addBankAssets);
