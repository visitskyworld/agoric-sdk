// @ts-check
export const CHAIN_BOOTSTRAP_MANIFEST = harden({
  makeVatsFromBundles: {
    vats: {
      vatAdmin: 'vatAdmin',
    },
    devices: {
      vatAdmin: true,
    },
    produce: {
      vatAdminSvc: 'vatAdmin',
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
      zoe: 'zoe',
      feeMintAccess: 'zoe',
    },
  },
  makeBoard: {
    consume: {
      loadVat: true,
      client: true,
    },
    produce: {
      board: 'board',
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
      timer: 'timer',
    },
    produce: {
      chainTimerService: 'timer',
    },
  },
  makeClientBanks: {
    consume: {
      bankManager: 'bank',
      client: true,
    },
    home: { produce: { bank: 'bank' } },
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
      bankManager: 'bank',
    },
    // TODO: re-org loadVat, agoricNames to be
    // subject to permits such as these:
    issuer: { produce: { BLD: true, RUN: 'zoe' } },
    brand: { produce: { BLD: true, RUN: 'zoe' } },
  },
  makeProvisioner: {
    consume: {
      loadVat: true,
      clientCreator: true,
    },
    produce: {
      provisioning: 'provisioning',
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
    home: { produce: { faucet: true } },
  },
  grantRunBehaviors: {
    runBehaviors: true,
    consume: { client: true },
    home: { produce: { runBehaviors: true, governanceActions: true } },
  },
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
    produce: { economicCommitteeCreatorFacet: 'economicCommittee' },
    installation: {
      produce: {
        contractGovernor: 'zoe',
        binaryVoteCounter: 'zoe',
      },
    },
    instance: {
      produce: { economicCommittee: 'zoe' },
    },
  },
  setupAmm: {
    consume: {
      chainTimerService: true,
      agoricNames: true,
      nameAdmins: true,
      zoe: true,
      economicCommitteeCreatorFacet: 'economicCommittee',
      ammBundle: true,
    },
    produce: {
      ammCreatorFacet: 'amm',
      ammGovernorCreatorFacet: 'amm',
    },
    issuer: { consume: { RUN: 'zoe' } },
    installation: {
      consume: { contractGovernor: 'zoe' },
    },
    instance: {
      consume: { economicCommittee: 'zoe' },
      produce: { amm: 'zoe' },
    },
  },
  startPriceAuthority: {
    consume: { loadVat: true },
    produce: {
      priceAuthority: 'priceAuthority',
      priceAuthorityAdmin: 'priceAuthority',
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
      economicCommitteeCreatorFacet: 'economicCommittee',
    },
    produce: {
      vaultFactoryCreator: 'VaultFactory',
      vaultFactoryGovernorCreator: 'VaultFactory',
      vaultFactoryVoteCreator: 'VaultFactory',
    },
    brand: { consume: { RUN: 'zoe' } },
    installation: { consume: { contractGovernor: 'zoe' } },
    instance: {
      consume: { amm: 'zoe', economicCommittee: 'zoe' },
      produce: { VaultFactory: 'zoe' },
    },
  },
  configureVaultFactoryUI: {
    consume: { agoricNames: true, nameAdmins: true, board: true, zoe: true },
  },
});
