// @ts-check
import { E, Far } from '@endo/far';
import { deeplyFulfilled } from '@endo/marshal';
import {
  makeNotifierKit,
  makeSubscriptionKit,
  observeIteration,
} from '@agoric/notifier';
import {
  governanceBundles,
  economyBundles,
  ammBundle,
} from '@agoric/run-protocol/src/importedBundles.js';
import pegasusBundle from '@agoric/pegasus/bundles/bundle-pegasus.js';
import {
  makeLoopbackProtocolHandler,
  makeEchoConnectionHandler,
  makeNonceMaker,
} from '@agoric/swingset-vat/src/vats/network/index.js';

import { makeBridgeManager as makeBridgeManagerKit } from '../bridge.js';

import { collectNameAdmins, mixProperties } from './utils.js';

const { details: X } = assert;

/**
 * @param {BootstrapPowers & {
 *   consume: { loadVat: ERef<VatLoader<ProvisioningVat>> }
 * }} powers
 */
export const makeProvisioner = async ({
  consume: { clientCreator, loadVat },
  vats: { comms, vattp },
  produce: { provisioning },
}) => {
  const provisionerVat = E(loadVat)('provisioning');
  await E(provisionerVat).register(clientCreator, comms, vattp);
  provisioning.resolve(provisionerVat);
};
harden(makeProvisioner);

/** @param {BootstrapPowers} powers */
export const bridgeProvisioner = async ({
  consume: { provisioning, bridgeManager: bridgeManagerP },
}) => {
  const bridgeManager = await bridgeManagerP;
  if (!bridgeManager) {
    return;
  }

  // Register a provisioning handler over the bridge.
  const handler = Far('provisioningHandler', {
    async fromBridge(_srcID, obj) {
      switch (obj.type) {
        case 'PLEASE_PROVISION': {
          const { nickname, address, powerFlags } = obj;
          return E(provisioning)
            .pleaseProvision(nickname, address, powerFlags)
            .catch(e =>
              console.error(`Error provisioning ${nickname} ${address}:`, e),
            );
        }
        default:
          assert.fail(X`Unrecognized request ${obj.type}`);
      }
    },
  });
  await E(bridgeManager).register('provision', handler);
};
harden(bridgeProvisioner);

/** @param {BootstrapPowers} powers */
export const makeClientManager = async ({
  produce: { client, clientCreator: clientCreatorP },
}) => {
  // Create a subscription of chain configurations.
  /** @type {SubscriptionRecord<PropertyMakers>} */
  const { subscription, publication } = makeSubscriptionKit();

  // Cache the latest full property maker state.
  /** @type { PropertyMakers } */
  let cachedPropertyMakers = [];

  /** @type {ClientManager} */
  const clientManager = Far('chainClientManager', {
    assignBundle: newPropertyMakers => {
      // Write the property makers to the cache, and update the subscription.
      cachedPropertyMakers = [...cachedPropertyMakers, ...newPropertyMakers];
      publication.updateState(newPropertyMakers);
    },
  });

  /** @type {ClientCreator} */
  const clientCreator = Far('clientCreator', {
    createUserBundle: (nickname, clientAddress, powerFlags) => {
      const c = E(clientCreator).createClientFacet(
        nickname,
        clientAddress,
        powerFlags,
      );
      return E(c).getChainBundle();
    },
    createClientFacet: async (_nickname, clientAddress, _powerFlags) => {
      /** @type {Record<string, unknown>} */
      let clientHome = {};

      const makeUpdatedConfiguration = (newPropertyMakers = []) => {
        // Specialize the property makers with the client address.
        const newProperties = mixProperties(newPropertyMakers, clientAddress);
        clientHome = { ...clientHome, ...newProperties };
        const config = harden({ clientAddress, clientHome });
        /** @type {typeof config} */
        const df = deeplyFulfilled(config);
        return df;
      };

      // Publish new configurations.
      const { notifier, updater } = makeNotifierKit(
        makeUpdatedConfiguration(cachedPropertyMakers),
      );

      /** @type {ClientFacet} */
      const clientFacet = Far('chainProvisioner', {
        getChainBundle: () => clientHome,
        getConfiguration: () => notifier,
      });

      observeIteration(subscription, {
        updateState(newPropertyMakers) {
          updater.updateState(makeUpdatedConfiguration(newPropertyMakers));
        },
      });

      return clientFacet;
    },
  });

  clientCreatorP.resolve(clientCreator);
  client.resolve(clientManager);
};
harden(makeClientManager);

/** @param {BootstrapPowers} powers */
export const startTimerService = async ({
  devices: { timer: timerDevice },
  vats: { timer: timerVat },
  produce: { chainTimerService },
}) => {
  chainTimerService.resolve(E(timerVat).createTimerService(timerDevice));
};
harden(startTimerService);

/** @param {BootstrapPowers} powers */
export const makeBridgeManager = async ({
  devices: { bridge },
  vatPowers: { D },
  produce: { bridgeManager },
}) => {
  const myBridge = bridge ? makeBridgeManagerKit(E, D, bridge) : undefined;
  if (!myBridge) {
    console.warn(
      'Running without a bridge device; this is not an actual chain.',
    );
  }
  bridgeManager.resolve(myBridge);
};
harden(makeBridgeManager);

/**
 * no free lunch on chain
 *
 * @param {BootstrapPowers} powers
 */
export const connectChainFaucet = async ({ consume: { client } }) => {
  const faucet = Far('faucet', { tapFaucet: () => harden([]) });

  return E(client).assignBundle([_addr => ({ faucet })]);
};
harden(connectChainFaucet);

/** @param {BootstrapPowers} powers */
export const shareEconomyBundles = async ({
  produce: {
    ammBundle: ammP,
    getRUNBundle,
    vaultBundles,
    governanceBundles: govP,
    pegasusBundle: pegasusP,
    centralSupplyBundle: centralP,
  },
}) => {
  govP.resolve(governanceBundles);
  ammP.resolve(ammBundle);
  vaultBundles.resolve({
    VaultFactory: economyBundles.VaultFactory,
    liquidate: economyBundles.liquidate,
  });
  getRUNBundle.resolve(economyBundles.getRUN);
  pegasusP.resolve(pegasusBundle);
  centralP.resolve(economyBundles.centralSupply);
};
harden(shareEconomyBundles);

/**
 * @param { BootstrapPowers & {
 *   consume: { loadVat: VatLoader<any> }
 * }} powers
 * @typedef { import('@agoric/swingset-vat/src/vats/network/router.js').RouterProtocol} RouterProtocol
 * @typedef {ERef<ReturnType<import('../vat-ibc.js').buildRootObject>>} IBCVat
 *
 * // TODO: why doesn't overloading VatLoader work???
 * @typedef { ((name: 'network') => RouterProtocol) &
 *            ((name: 'ibc') => IBCVat) } VatLoader2
 */
export const registerNetworkProtocols = async ({
  consume: {
    agoricNames,
    nameAdmins,
    loadVat,
    bridgeManager: bridgeManagerP,
    zoe,
    provisioning,
  },
}) => {
  /** @type {{ network: ERef<RouterProtocol>, ibc: IBCVat, provisioning: ProvisioningVat}} */
  const vats = {
    network: E(loadVat)('network'),
    ibc: E(loadVat)('ibc'),
    provisioning,
  };

  const ps = [];
  // Every vat has a loopback device.
  ps.push(
    E(vats.network).registerProtocolHandler(
      ['/local'],
      makeLoopbackProtocolHandler(),
    ),
  );
  const dibcBridgeManager = await bridgeManagerP;
  if (dibcBridgeManager) {
    // We have access to the bridge, and therefore IBC.
    const callbacks = Far('callbacks', {
      downcall(method, obj) {
        return dibcBridgeManager.toBridge('dibc', {
          ...obj,
          type: 'IBC_METHOD',
          method,
        });
      },
    });
    const ibcHandler = await E(vats.ibc).createInstance(callbacks);
    dibcBridgeManager.register('dibc', ibcHandler);
    ps.push(
      E(vats.network).registerProtocolHandler(
        ['/ibc-port', '/ibc-hop'],
        ibcHandler,
      ),
    );
  } else {
    const loHandler = makeLoopbackProtocolHandler(
      makeNonceMaker('ibc-channel/channel-'),
    );
    ps.push(E(vats.network).registerProtocolHandler(['/ibc-port'], loHandler));
  }
  await Promise.all(ps);

  // Add an echo listener on our ibc-port network (whether real or virtual).
  const echoPort = await E(vats.network).bind('/ibc-port/echo');
  E(echoPort).addListener(
    Far('listener', {
      async onAccept(_port, _localAddr, _remoteAddr, _listenHandler) {
        return harden(makeEchoConnectionHandler());
      },
      async onListen(port, _listenHandler) {
        console.debug(`listening on echo port: ${port}`);
      },
    }),
  );

  // In the promise space for a solo, this lookup doesn't resolve,
  // so we never bother with the rest.
  // TODO: is this leak OK?
  E(agoricNames)
    .lookup('instance', 'pegasus')
    .then(async pegasusInstance => {
      const pegasus = E(zoe).getPublicFacet(pegasusInstance);

      if (pegasus) {
        const [pegasusConnectionsAdmin] = await collectNameAdmins(
          ['pegasus'],
          agoricNames,
          nameAdmins,
        );

        // Add the Pegasus transfer port.
        const port = await E(vats.network).bind('/ibc-port/transfer');
        E(port).addListener(
          Far('listener', {
            async onAccept(_port, _localAddr, _remoteAddr, _listenHandler) {
              const chandlerP = E(pegasus).makePegConnectionHandler();
              const proxyMethod =
                name =>
                (...args) =>
                  E(chandlerP)[name](...args);
              const onOpen = proxyMethod('onOpen');
              const onClose = proxyMethod('onClose');

              let localAddr;
              return Far('pegasusConnectionHandler', {
                onOpen(c, actualLocalAddr, ...args) {
                  localAddr = actualLocalAddr;
                  if (pegasusConnectionsAdmin) {
                    pegasusConnectionsAdmin.update(localAddr, c);
                  }
                  return onOpen(c, ...args);
                },
                onReceive: proxyMethod('onReceive'),
                onClose(c, ...args) {
                  try {
                    return onClose(c, ...args);
                  } finally {
                    if (pegasusConnectionsAdmin) {
                      pegasusConnectionsAdmin.delete(localAddr);
                    }
                  }
                },
              });
            },
            async onListen(p, _listenHandler) {
              console.debug(`Listening on Pegasus transfer port: ${p}`);
            },
          }),
        );
      }
    })
    .catch(reason => console.error(reason)); // TODO: catch/log suffices?

  if (dibcBridgeManager) {
    // Register a provisioning handler over the bridge.
    const handler = Far('provisioningHandler', {
      async fromBridge(_srcID, obj) {
        switch (obj.type) {
          case 'PLEASE_PROVISION': {
            const { nickname, address, powerFlags } = obj;
            return E(vats.provisioning)
              .pleaseProvision(nickname, address, powerFlags)
              .catch(e =>
                console.error(`Error provisioning ${nickname} ${address}:`, e),
              );
          }
          default:
            assert.fail(X`Unrecognized request ${obj.type}`);
        }
      },
    });
    dibcBridgeManager.register('provision', handler);
  }
};
