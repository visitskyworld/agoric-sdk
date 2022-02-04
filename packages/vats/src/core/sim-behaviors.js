// @ts-check
import { E, Far } from '@endo/far';
import { GOVERNANCE_ACTIONS_MANIFEST } from './manifest.js';
import { addRemote } from './utils.js';

/** @param { BootstrapPowers } powers */
export const installSimEgress = async ({
  vatParameters: { argv },
  vats: { vattp, comms },
  consume: { clientCreator },
}) => {
  const PROVISIONER_INDEX = 1;

  return Promise.all(
    argv.hardcodedClientAddresses.map(async (addr, i) => {
      const clientFacet = await E(clientCreator).createClientFacet(
        `solo${i}`,
        addr,
        ['agoric.ALL_THE_POWERS'],
      );

      await addRemote(addr, { vats: { comms, vattp } });
      await E(comms).addEgress(addr, PROVISIONER_INDEX, clientFacet);
    }),
  );
};
harden(installSimEgress);

/** @param {BootstrapPowers} powers */
export const connectFaucet = async ({ consume: { zoe, client } }) => {
  const userFeePurse = await E(zoe).makeFeePurse();
  const faucet = Far('faucet', {
    tapFaucet: () => [],
    // TODO: obsolete getFeePurse, now that zoe fees are gone?
    getFeePurse: () => userFeePurse,
  });

  return E(client).assignBundle([_addr => ({ faucet })]);
};
harden(connectFaucet);

/** @param {BootstrapPowers} powers */
export const grantRunBehaviors = async ({
  runBehaviors,
  consume: { client },
}) => {
  const bundle = {
    behaviors: Far('behaviors', { run: manifest => runBehaviors(manifest) }),
    governanceActions: GOVERNANCE_ACTIONS_MANIFEST,
  };
  return E(client).assignBundle([_addr => bundle]);
};
harden(grantRunBehaviors);
