// @ts-check
import { E } from '@agoric/eventual-send';
import '@agoric/vats/src/core/types.js';

/** @param { BootstrapPowers } powers */
export async function installOnChain({
  consume: {
    agoricNames,
    board,
    nameAdmins,
    namesByAddress,
    pegasusBundle,
    zoe,
  },
}) {
  // Fetch the nameAdmins we need.
  const [installAdmin, instanceAdmin, uiConfigAdmin] = await Promise.all(
    ['installation', 'instance', 'uiConfig'].map(async edge => {
      const hub = /** @type {NameHub} */ (await E(agoricNames).lookup(edge));
      return E(nameAdmins).get(hub);
    }),
  );

  const pegasusInstall = await E(zoe).install(pegasusBundle);

  const terms = harden({
    board,
    namesByAddress,
  });

  const { instance } = await E(zoe).startInstance(
    pegasusInstall,
    undefined,
    terms,
  );

  const pegasusUiDefaults = {
    CONTRACT_NAME: 'Pegasus',
    BRIDGE_URL: 'http://127.0.0.1:8000',
    // Avoid setting API_URL, so that the UI uses the same origin it came from,
    // if it has an api server.
    // API_URL: 'http://127.0.0.1:8000',
  };

  // Look up all the board IDs.
  const boardIdValue = [['INSTANCE_BOARD_ID', instance]];
  await Promise.all(
    boardIdValue.map(async ([key, valP]) => {
      const val = await valP;
      const boardId = await E(board).getId(val);
      pegasusUiDefaults[key] = boardId;
    }),
  );

  // Stash the defaults where the UI can find them.
  harden(pegasusUiDefaults);

  // Install the names in agoricNames.
  /** @type {Array<[NameAdmin, string, unknown]>} */
  const nameAdminUpdates = [
    [uiConfigAdmin, pegasusUiDefaults.CONTRACT_NAME, pegasusUiDefaults],
    [installAdmin, pegasusUiDefaults.CONTRACT_NAME, pegasusInstall],
    [instanceAdmin, pegasusUiDefaults.CONTRACT_NAME, instance],
    [installAdmin, pegasusUiDefaults.CONTRACT_NAME, pegasusInstall],
  ];
  await Promise.all(
    nameAdminUpdates.map(([nameAdmin, name, value]) =>
      E(nameAdmin).update(name, value),
    ),
  );
}
