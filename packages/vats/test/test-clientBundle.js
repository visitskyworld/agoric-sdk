// @ts-check
// eslint-disable-next-line import/no-extraneous-dependencies
import { test } from '@agoric/swingset-vat/tools/prepare-test-env-ava.js';
// eslint-disable-next-line import/no-extraneous-dependencies
import { makeLoopback } from '@endo/captp';
import { E, Far } from '@endo/far';
import centralSupplyBundle from '@agoric/run-protocol/bundles/bundle-centralSupply.js';
import { makeFakeVatAdmin } from '@agoric/zoe/tools/fakeVatAdmin.js';
import { makeZoeKit } from '@agoric/zoe';

import { makeIssuerKit } from '@agoric/ertp';
import { makeClientManager } from '../src/core/chain-behaviors.js';
import { makePromiseSpace } from '../src/core/utils.js';
import { connectFaucet, showAmount } from '../src/demoIssuers.js';
import { buildRootObject as bldMintRoot } from '../src/vat-mints.js';
import { makeClientBanks } from '../src/core/basic-behaviors.js';

const setUpZoeForTest = async () => {
  const { makeFar } = makeLoopback('zoeTest');
  const { zoeService, feeMintAccess: nonFarFeeMintAccess } = makeZoeKit(
    makeFakeVatAdmin(() => {}).admin,
  );
  /** @type {ERef<ZoeService>} */
  const zoe = makeFar(zoeService);
  const feeMintAccess = await makeFar(nonFarFeeMintAccess);
  return {
    zoe,
    feeMintAccess,
  };
};
harden(setUpZoeForTest);

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

  t.plan(4); // bank deposit, faucet payments, mints

  const bldKit = makeIssuerKit('BLD');
  produce.bldIssuerKit.resolve(bldKit);
  produce.bankManager.resolve(
    Promise.resolve(
      // @ts-ignore never mind other methods
      Far('mockBankManager', {
        getBankForAddress: _a =>
          Far('mockBank', {
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
    ),
  );

  /** @param { BootstrapPowers } powers */
  const stubProps = async ({ consume: { client } }) => {
    const stub = {
      agoricNames: true,
      namesByAddress: true,
      myAddressNameAdmin: true,
      board: true,
      zoe: true,
    };
    E(client).assignBundle([_a => stub]);
  };

  await Promise.all([
    makeClientManager({ consume, produce }),
    connectFaucet({ consume, produce }),
    makeClientBanks({ consume, produce }),
    stubProps({ consume, produce }),
  ]);
  const m = await produce.mints;
  t.truthy(m);

  const userBundle = await E(consume.clientCreator).createUserBundle(
    'nick',
    'address1',
    [],
  );
  // t.deepEqual(Object.keys(userBundle), '@@todo');
  const pmts = await E(userBundle.faucet).tapFaucet();

  const detail = await Promise.all(
    pmts.map(({ issuer, payment, pursePetName }) =>
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
});
