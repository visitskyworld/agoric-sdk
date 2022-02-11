// @ts-check

/** @typedef { import('@agoric/eventual-send').EProxy } EProxy */

/**
 * @template T
 * @typedef {'Device' & { __deviceType__: T }} Device
 */
/** @typedef {<T>(target: Device<T>) => T} DProxy (approximately) */

/**
 * SwingSet types
 *
 * @typedef { Device<ReturnType<typeof
 *   import('@agoric/swingset-vat/src/devices/mailbox-src.js').buildRootDeviceNode>> } MailboxDevice
 * @typedef { ERef<ReturnType<typeof
 *   import('@agoric/swingset-vat/src/vats/vat-tp.js').buildRootObject>> } VattpVat
 * @typedef { ERef<ReturnType<typeof
 *   import('@agoric/swingset-vat/src/kernel/vatAdmin/vatAdminWrapper.js').buildRootObject>> } VatAdminVat
 * @typedef { ERef<ReturnType<typeof
 *   import('@agoric/swingset-vat/src/vats/vat-timerWrapper.js').buildRootObject>> } TimerVat
 *
 * See deliverToController in packages/SwingSet/src/vats/comms/controller.js
 * @typedef {ERef<{
 *   addRemote: (name: string, tx: unknown, rx: unknown) => void,
 *   addEgress: (addr: string, ix: number, provider: unknown) => void,
 * }>} CommsVatRoot
 *
 * @typedef {{
 *   comms: CommsVatRoot,
 *   timer: TimerVat,
 *   vatAdmin: VatAdminVat,
 *   vattp: VattpVat,
 * }} SwingsetVats
 * @typedef {{
 *   mailbox: MailboxDevice,
 *   vatAdmin: unknown,
 * }} SwingsetDevices
 */

/**
 * @typedef {ReturnType<typeof import('../bridge.js').makeBridgeManager> | undefined} OptionalBridgeManager
 */

/**
 * @typedef {{
 *   getChainBundle: () => unknown,
 *   getChainConfigNotifier: () => Notifier<unknown>,
 * }} ClientProvider
 */

/**
 * @typedef {{ resolve: (v: T) => void }} Producer<T>
 * @template T
 */
/**
 * @typedef {(name: string) => T} VatLoader<T>
 * @template T
 */
/**
 * @typedef {{
 *   consume: Record<string, Promise<unknown>>,
 *   produce: Record<string, Producer<unknown>>,
 * }} PromiseSpace
 *
 * @typedef {{
 *   assignBundle: (ps: PropertyMakers) => void
 * }} ClientManager
 *
 * @typedef {Array<(addr: string) => Record<string, unknown>>} PropertyMakers
 */

/**
 * @callback CreateUserBundle
 * @param {string} nickname
 * @param {string} clientAddress
 * @param {string[]} powerFlags
 * @returns {Promise<Record<string, unknown>>}
 *
 * @typedef {Object} ClientFacet
 * @property {() => Record<string, unknown>} getChainBundle Required for ag-solo, but deprecated in favour of getConfiguration
 * @property {() => ConsistentAsyncIterable<Configuration>} getConfiguration
 *
 * @typedef {{ clientAddress: string, clientHome: Record<string, unknown>}} Configuration
 *
 * @typedef {Object} ClientCreator
 * @property {CreateUserBundle} createUserBundle Required for vat-provisioning, but deprecated in favor of {@link createClient}.
 * @property {(nickname: string, clientAddress: string, powerFlags: string[]) => Promise<ClientFacet>} createClientFacet
 */

/**
 * @typedef {{
 *   consume: {
 *     agoricNames: Promise<NameHub>,
 *     ammCreatorFacet: ERef<XYKAMMCreatorFacet>,
 *     ammGovernorCreatorFacet: ERef<GovernedContractFacetAccess>,
 *     chainTimerService: ERef<TimerService>,
 *     economicCommitteeCreatorFacet: ERef<CommitteeElectorateCreatorFacet>,
 *     ammBundle: ERef<SourceBundle>,
 *     getRUNBundle: ERef<SourceBundle>,
 *     vaultBundles: ERef<Record<string, SourceBundle>>,
 *     feeMintAccess: ERef<FeeMintAccess>,
 *     governanceBundles: ERef<Record<string, SourceBundle>>,
 *     nameAdmins: Promise<Store<NameHub, NameAdmin>>,
 *     pegasusBundle: Promise<SourceBundle>,
 *     priceAuthority: ERef<PriceAuthority>,
 *     priceAuthorityAdmin: ERef<PriceAuthorityRegistryAdmin>,
 *     vaultFactoryCreator: ERef<{ makeCollectFeesInvitation: () => Promise<Invitation> }>,
 *     vaultFactoryGovernorCreator: ERef<GovernedContractFacetAccess>,
 *     zoe: ERef<ZoeService>,
 *   },
 *   produce: {
 *     agoricNames: Producer<NameHub>,
 *     agoricNamesAdmin: Producer<NameAdmin>,
 *     ammCreatorFacet: Producer<unknown>,
 *     ammGovernorCreatorFacet: Producer<unknown>,
 *     chainTimerService: Producer<ERef<TimerService>>,
 *     economicCommitteeCreatorFacet: Producer<CommitteeElectorateCreatorFacet>,
 *     ammBundle: Producer<{ moduleFormat: string }>,
 *     getRUNBundle: Producer<{ moduleFormat: string }>,
 *     vaultBundles: Producer<Record<string, { moduleFormat: string }>>,
 *     governanceBundles: Producer<Record<string, { moduleFormat: string }>>,
 *     feeMintAccess: Producer<FeeMintAccess>,
 *     nameAdmins: Producer<Store<NameHub, NameAdmin>>,
 *     priceAuthority: Producer<PriceAuthority>,
 *     priceAuthorityAdmin: Producer<PriceAuthorityRegistryAdmin>,
 *     pegasusBundle: Producer<SourceBundle>,
 *     vaultFactoryCreator: Producer<{ makeCollectFeesInvitation: () => Promise<Invitation> }>,
 *     vaultFactoryGovernorCreator: Producer<unknown>,
 *     vaultFactoryVoteCreator: Producer<unknown>,
 *     zoe: Producer<ERef<ZoeService>>,
 *   },
 * }} EconomyBootstrapPowers
 *
 * @typedef {{
 *   devices: {
 *      timer: unknown,
 *      bridge: Device<import('../bridge.js').BridgeDevice>,
 *      vatAdmin: unknown,
 *   },
 *   vats: {
 *     comms: CommsVatRoot,
 *     timer: TimerVat,
 *     vattp: VattpVat,
 *     vatAdmin: VatAdminVat,
 *   },
 *   vatPowers: { D: DProxy },
 *   runBehaviors: (manifest: unknown) => Promise<unknown>,
 *   consume: EconomyBootstrapPowers['consume'] & {
 *     bankManager: Promise<BankManager>,
 *     board: ERef<Board>,
 *     bridgeManager: ERef<OptionalBridgeManager>,
 *     client: ERef<ClientManager>,
 *     clientCreator: ERef<ClientCreator>,
 *     provisioning: ProvisioningVat,
 *     vatAdminSvc: ERef<VatAdminSvc>,
 *     namesByAddress: ERef<NameHub>,
 *     namesByAddressAdmin: ERef<NameAdmin>,
 *   },
 *   produce: EconomyBootstrapPowers['produce'] & {
 *     bankManager: Producer<unknown>,
 *     board: Producer<ERef<Board>>,
 *     bridgeManager: Producer<OptionalBridgeManager>,
 *     client: Producer<ClientManager>,
 *     clientCreator: Producer<ClientCreator>,
 *     loadVat: Producer<VatLoader<unknown>>,
 *     provisioning: Producer<unknown>,
 *     vatAdminSvc: Producer<ERef<VatAdminSvc>>,
 *     namesByAddress: Producer<NameHub>,
 *     namesByAddressAdmin: Producer<NameAdmin>,
 *   },
 * }} BootstrapPowers
 * @typedef {*} BankManager // TODO
 * @typedef {ERef<ReturnType<import('../vat-provisioning.js').buildRootObject>>} ProvisioningVat
 * @typedef { import('@agoric/zoe/tools/priceAuthorityRegistry').PriceAuthorityRegistryAdmin } PriceAuthorityRegistryAdmin
 */
