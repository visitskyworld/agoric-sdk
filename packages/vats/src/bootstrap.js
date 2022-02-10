// @ts-check
import { deeplyFulfilled } from '@endo/marshal';
import {
  makeLoopbackProtocolHandler,
  makeEchoConnectionHandler,
  makeNonceMaker,
} from '@agoric/swingset-vat/src/vats/network/index.js';
import { E, Far } from '@endo/far';

import { makePluginManager } from '@agoric/swingset-vat/src/vats/plugin-manager.js';
import { assert, details as X } from '@agoric/assert';
import { observeIteration } from '@agoric/notifier';
import { makeBridgeManager } from './bridge.js';

console.debug(`loading bootstrap.js`);

// Used for coordinating on an index in comms for the provisioning service
const PROVISIONER_INDEX = 1;

function makeVattpFrom(vats) {
  const { vattp, comms } = vats;
  return Far('vattp', {
    makeNetworkHost(allegedName, console = undefined) {
      return E(vattp).makeNetworkHost(allegedName, comms, console);
    },
  });
}

export function buildRootObject(vatPowers, vatParameters) {
  const { D } = vatPowers;
  async function setupCommandDevice(httpVat, cmdDevice, roles) {
    await E(httpVat).setCommandDevice(cmdDevice, roles);
    D(cmdDevice).registerInboundHandler(httpVat);
  }

  async function registerNetworkProtocols(
    vats,
    dibcBridgeManager,
    pegasus,
    pegasusConnectionsAdmin,
  ) {
    /** @type {ERef<Protocol>} */
    const network = vats.network;
    const ps = [];
    // Every vat has a loopback device.
    ps.push(
      E(vats.network).registerProtocolHandler(
        ['/local'],
        makeLoopbackProtocolHandler(),
      ),
    );
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
      ps.push(
        E(vats.network).registerProtocolHandler(['/ibc-port'], loHandler),
      );
    }
    await Promise.all(ps);

    // Add an echo listener on our ibc-port network (whether real or virtual).
    const echoPort = await E(network).bind('/ibc-port/echo');
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

    if (pegasus) {
      // Add the Pegasus transfer port.
      const port = await E(network).bind('/ibc-port/pegasus');

      const { handler, subscription } = await E(
        pegasus,
      ).makePegasusConnectionKit();
      observeIteration(subscription, {
        updateState(connectionState) {
          const { localAddr, actions } = connectionState;
          if (actions) {
            // We're open and ready for business.
            pegasusConnectionsAdmin.update(localAddr, connectionState);
          } else {
            // We're closed.
            pegasusConnectionsAdmin.delete(localAddr);
          }
        },
      });
      E(port).addListener(
        Far('listener', {
          async onAccept(_port, _localAddr, _remoteAddr, _listenHandler) {
            return handler;
          },
          async onListen(p, _listenHandler) {
            console.debug(`Listening on Pegasus transfer port: ${p}`);
          },
        }),
      );
    }

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
                  console.error(
                    `Error provisioning ${nickname} ${address}:`,
                    e,
                  ),
                );
            }
            default:
              assert.fail(X`Unrecognized request ${obj.type}`);
          }
        },
      });
      dibcBridgeManager.register('provision', handler);
    }
  }

  // objects that live in the client's solo vat. Some services should only
  // be in the DApp environment (or only in end-user), but we're not yet
  // making a distinction, so the user also gets them.
  async function createLocalBundle(vats, devices, vatAdminSvc) {
    // This will eventually be a vat spawning service. Only needed by dev
    // environments.
    const spawner = E(vats.spawner).buildSpawner(vatAdminSvc);

    const localTimerService = E(vats.timer).createTimerService(devices.timer);

    // Needed for DApps, maybe for user clients.
    const scratch = E(vats.uploads).getUploads();

    // Only create the plugin manager if the device exists.
    let plugin;
    if (devices.plugin) {
      plugin = makePluginManager(devices.plugin, vatPowers);
    }

    // This will allow dApp developers to register in their api/deploy.js
    const httpRegCallback = Far('httpRegCallback', {
      doneLoading(subsystems) {
        return E(vats.http).doneLoading(subsystems);
      },
      send(obj, connectionHandles) {
        return E(vats.http).send(obj, connectionHandles);
      },
      registerURLHandler(handler, path) {
        return E(vats.http).registerURLHandler(handler, path);
      },
      registerAPIHandler(handler) {
        return E(vats.http).registerURLHandler(handler, '/api');
      },
      async registerWallet(wallet, privateWallet, privateWalletBridge) {
        await Promise.all([
          E(vats.http).registerURLHandler(privateWallet, '/private/wallet'),
          E(vats.http).registerURLHandler(
            privateWalletBridge,
            '/private/wallet-bridge',
          ),
          E(vats.http).setWallet(wallet),
        ]);
      },
    });

    return deeplyFulfilled(
      harden({
        ...(plugin ? { plugin } : {}),
        scratch,
        spawner,
        localTimerService,
        network: vats.network,
        http: httpRegCallback,
        vattp: makeVattpFrom(vats),
      }),
    );
  }

  return Far('root', {
    async bootstrap(vats, devices) {
      const bridgeManager =
        devices.bridge && makeBridgeManager(E, D, devices.bridge);
      const {
        ROLE,
        // TODO: Don't make client bootstrap dependent on having just zero or
        // one chains.  Instead, supply all the connections as input to the
        // bootstrap (or have other ways of initializing per-connection
        // bootstrap code).  Also use an abstract name for the connection
        // instead of GCI so that a given chain can be followed across a GCI
        // change such as in a hard-fork.
        FIXME_GCI,
        // giveMeAllTheAgoricPowers,
        // noFakeCurrencies,
        // hardcodedClientAddresses,
      } = vatParameters.argv;

      async function addRemote(addr) {
        const { transmitter, setReceiver } = await E(vats.vattp).addRemote(
          addr,
        );
        await E(vats.comms).addRemote(addr, transmitter, setReceiver);
      }

      D(devices.mailbox).registerInboundHandler(vats.vattp);
      await E(vats.vattp).registerMailboxDevice(devices.mailbox);

      const vatAdminSvc = await E(vats.vatAdmin).createVatAdminService(
        devices.vatAdmin,
      );

      console.debug(`${ROLE} bootstrap starting`);
      // scenario #1: Cloud has: multi-node chain, controller solo node,
      // provisioning server (python). New clients run provisioning
      // client (python) on localhost, which creates client solo node on
      // localhost, with HTML frontend. Multi-player mode.
      switch (ROLE) {
        // REAL VALIDATORS run this.
        case 'chain':
          assert.fail(X`ROLE is now in core bootstrap: ${ROLE}`);

        // ag-setup-solo runs this.
        case 'client': {
          let localBundle;
          let chainBundle;
          const deprecated = {};

          // Tell the http server about our presences.  This can be called in
          // any order (whether localBundle and/or chainBundle are set or not).
          const updatePresences = () =>
            E(vats.http).setPresences(localBundle, chainBundle, deprecated);

          const addLocalPresences = async () => {
            await registerNetworkProtocols(vats, bridgeManager, null);

            await setupCommandDevice(vats.http, devices.command, {
              client: true,
            });
            localBundle = await createLocalBundle(vats, devices, vatAdminSvc);

            // TODO: Remove this alias when we can.
            deprecated.uploads = localBundle.scratch;
            await updatePresences();
          };

          const addChainPresences = async () => {
            assert(FIXME_GCI, X`client must be given GCI`);
            await addRemote(FIXME_GCI);
            // addEgress(..., index, ...) is called in vat-provisioning.
            const chainProvider = E(vats.comms).addIngress(
              FIXME_GCI,
              PROVISIONER_INDEX,
            );
            chainBundle = await E(chainProvider).getChainBundle();
            await updatePresences();
          };

          // We race to add presences, regardless of order.  This allows a solo
          // REPL to be useful even if only some of the presences have loaded.
          await Promise.all([addLocalPresences(), addChainPresences()]);
          break;
        }

        // fake-chain runs this
        case 'sim-chain':
          assert.fail(X`ROLE is now in core bootstrap: ${ROLE}`);

        default:
          assert.fail(X`ROLE was not recognized: ${ROLE}`);
      }

      console.debug(`all vats initialized for ${ROLE}`);
    },
  });
}
