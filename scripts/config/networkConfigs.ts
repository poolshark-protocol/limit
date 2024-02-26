import { SUPPORTED_NETWORKS } from '../constants/supportedNetworks'

export interface NetworkConfig {
    chainId: number
    gas: number
    gasPrice: number
    url: string
    accounts: string[]
}

type NetworkConfigs = {
    [name in SUPPORTED_NETWORKS]: NetworkConfig
}

const getAccounts = function () {
    return process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : ['']
}

export const NETWORK_CONFIGS: NetworkConfigs = {
    /* Local Network Configs */
    hardhat: {
        chainId: 31337,
        gas: 9000000,
        gasPrice: 100000,
        url: '',
        accounts: [''],
    },
    /* Mainnet Network Configs */
    arb_one: {
        chainId: 42161,
        gas: 9000000,
        gasPrice: 1_000_000_000,
        url: process.env.ARBITRUM_ONE_URL || '',
        accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    scroll: {
        chainId: 534352,
        gas: 9000000,
        gasPrice: 4000000,
        url: process.env.SCROLL_ALPHA_URL || '',
        accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    mode: {
        chainId: 34443,
        gas: 9000000,
        gasPrice: 4000000,
        url: "https://mainnet.mode.network/" || "",
        accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    /* Testnet Network Configs */
    arb_sepolia: {
        chainId: 421614,
        gas: 9000000,
        gasPrice: 10_000_000_000,
        url: process.env.ARBITRUM_GOERLI_URL || '',
        accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    scrollSepolia: {
        chainId: 534353,
        gas: 9000000,
        gasPrice: 4000000,
        url: process.env.SCROLL_ALPHA_URL || '',
        accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    inEvm: {
        chainId: 534353,
        gas: 9000000,
        gasPrice: 4000000,
        url: process.env.SCROLL_ALPHA_URL || '',
        accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    }
}
