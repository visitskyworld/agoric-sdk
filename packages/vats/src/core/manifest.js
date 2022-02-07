// @ts-check
export const CHAIN_BOOTSTRAP_MANIFEST = harden({
  makeVatsFromBundles: {
    vats: {
      vatAdmin: true,
    },
    devices: {
      vatAdmin: true,
    },
    produce: {
      vatAdminSvc: true,
      loadVat: true,
    },
  },
  buildZoe: {
    consume: {
      agoricNames: true,
      nameAdmins: true,
      vatAdminSvc: true,
      loadVat: true,
      client: true,
    },
    produce: {
      zoe: { vat: 'zoe' },
      feeMintAccess: { vat: 'zoe' },
    },
  },
  makeBoard: {
    consume: {
      loadVat: true,
      client: true,
    },
    produce: {
      board: { vat: 'board' },
    },
  },
  makeBridgeManager: {
    devices: { bridge: true },
    vatPowers: { D: true },
    produce: { bridgeManager: true },
  },
  makeAddressNameHubs: {
    consume: {
      client: true,
    },
    produce: {
      agoricNames: true,
      agoricNamesAdmin: true,
      nameAdmins: true,
      namesByAddress: true,
      namesByAddressAdmin: true,
    },
    home: {
      produce: { myAddressNameAdmin: true },
    },
  },
  startTimerService: {
    devices: {
      timer: true,
    },
    vats: {
      timer: { vat: 'timer' },
    },
    produce: {
      chainTimerService: { vat: 'timer' },
    },
  },
  makeClientBanks: {
    consume: {
      bankManager: { vat: 'bank' },
      client: true,
    },
    home: { produce: { bank: { vat: 'bank' } } },
  },
  mintInitialSupply: {
    vatParameters: {
      argv: { bootMsg: true },
    },
    consume: {
      centralSupplyBundle: true,
      feeMintAccess: true,
      zoe: true,
    },
    produce: {
      initialSupply: true,
    },
  },
  addBankAssets: {
    vatParameters: {
      argv: { bootMsg: true },
    },
    consume: {
      agoricNames: true,
      nameAdmins: true,
      initialSupply: true,
      bridgeManager: true,
      loadVat: true,
      zoe: true,
    },
    produce: {
      bankManager: { vat: 'bank' },
    },
    // TODO: re-org loadVat, agoricNames to be
    // subject to permits such as these:
    issuer: { produce: { BLD: true, RUN: { vat: 'zoe' } } },
    brand: { produce: { BLD: true, RUN: { vat: 'zoe' } } },
  },
  makeProvisioner: {
    consume: {
      loadVat: true,
      clientCreator: true,
    },
    produce: {
      provisioning: { vat: 'provisioning' },
    },
    vats: {
      comms: true,
      vattp: true,
    },
    vat: { provisioning: true },
  },
  bridgeProvisioner: {
    consume: {
      provisioning: true,
      bridgeManager: true,
    },
  },
  makeClientManager: {
    produce: {
      client: true,
      clientCreator: true,
    },
  },
  connectChainFaucet: {
    consume: {
      client: true,
    },
    home: { produce: { faucet: true } },
  },
});

export const SIM_CHAIN_BOOTSTRAP_MANIFEST = harden({
  ...CHAIN_BOOTSTRAP_MANIFEST,
  installSimEgress: {
    vatParameters: { argv: { hardcodedClientAddresses: true } },
    vats: {
      vattp: true,
      comms: true,
    },
    consume: { clientCreator: true },
  },
  connectFaucet: {
    consume: { zoe: true, client: true },
  },
  grantRunBehaviors: {
    runBehaviors: true,
    consume: { client: true },
  },
  home: { runBehaviors: true, governanceActions: true },
});

export const GOVERNANCE_ACTIONS_MANIFEST = harden({
  shareEconomyBundles: {
    produce: {
      ammBundle: true,
      getRUNBundle: true,
      pegasusBundle: true,
      vaultBundles: true,
      governanceBundles: true,
    },
  },
  startEconomicCommittee: {
    consume: {
      agoricNames: true,
      nameAdmins: true,
      zoe: true,
      governanceBundles: true,
    },
    produce: { economicCommitteeCreatorFacet: { vat: 'economicCommittee' } },
    instance: {
      produce: { economicCommitteeCreatorFacet: { vat: 'zoe' } },
    },
  },
  setupAmm: {
    consume: {
      chainTimerService: true,
      agoricNames: true,
      nameAdmins: true,
      zoe: true,
      economicCommitteeCreatorFacet: true,
      ammBundle: true,
    },
    produce: {
      ammCreatorFacet: { vat: 'amm' },
      ammGovernorCreatorFacet: { vat: 'amm' },
    },
    installation: {
      consume: { contractGovernor: { vat: 'zoe' } },
    },
    instance: {
      produce: { amm: { vat: 'zoe' } },
      consume: { economicCommittee: { vat: 'zoe' } },
    },
  },
  startPriceAuthority: {
    consume: { loadVat: true },
    produce: {
      priceAuthority: { vat: 'priceAuthority' },
      priceAuthorityAdmin: { vat: 'priceAuthority' },
    },
  },
  startVaultFactory: {
    consume: {
      feeMintAccess: true,
      agoricNames: true,
      vaultBundles: true,
      nameAdmins: true,
      chainTimerService: true,
      zoe: true,
      priceAuthority: true,
      economicCommitteeCreatorFacet: true,
    },
    produce: {
      vaultFactoryCreator: { vat: 'VaultFactory' },
      vaultFactoryGovernorCreator: { vat: 'VaultFactory' },
      vaultFactoryVoteCreator: { vat: 'VaultFactory' },
    },
    instance: {
      produce: { VaultFactory: { vat: 'zoe' } },
    },
  },
  configureVaultFactoryUI: {
    consume: { agoricNames: true, nameAdmins: true, board: true, zoe: true },
  },
});
