import * as dotenv from 'dotenv'
import { Contract } from 'ethers'
import { HardhatUserConfig, task } from 'hardhat/config'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
require('solidity-coverage')
require('hardhat-contract-sizer')
import { handleHardhatTasks } from './taskHandler'

handleHardhatTasks()
dotenv.config()
const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: '0.8.18',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        goerli: {
            chainId: 5,
            gasPrice: 50000000000,
            url: process.env.GOERLI_URL || '',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            timeout: 60000,
        },
        arb_goerli: {
            chainId: 421613,
            gasPrice: 15_000_000_000,
            url: process.env.ARBITRUM_GOERLI_URL || '',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            timeout: 60000,
        },
        arb_sepolia: {
            chainId: 421614,
            gasPrice: 15_000_000_000,
            url: process.env.ARBITRUM_SEPOLIA_URL || '',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            timeout: 60000,
        },
        arb_one: {
            chainId: 42161,
            url: process.env.ARBITRUM_ONE_URL || '',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            timeout: 60000,
        },
        scroll: {
            chainId: 534352,
            gasPrice: 640_000_000,
            url: process.env.SCROLL_URL || "",
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        scrollSepolia: {
            chainId: 534351,
            gasPrice: 2_000_000_000,
            url: "https://sepolia-rpc.scroll.io/" || "",
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        mode: {
            chainId: 34443,
            url: "https://mainnet.mode.network/" || "",
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        }
    },
    etherscan: { 
        apiKey: {
            arbitrumOne: process.env.ARBITRUM_ONE_API_KEY,
            arbitrumGoerli: process.env.ARBITRUM_GOERLI_API_KEY,
            arb_sepolia: process.env.ARBITRUM_SEPOLIA_API_KEY,
            scrollSepolia: process.env.SCROLL_SEPOLIA_API_KEY,
            scroll: process.env.SCROLL_API_KEY,
            mode: process.env.MODE_API_KEY
        },
        customChains: [
            {
              network: 'scrollSepolia',
              chainId: 534351,
              urls: {
                apiURL: 'https://api-sepolia.scrollscan.com/api',
                browserURL: 'https://sepolia.scrollscan.com/',
              },
            },
            {
                network: 'scroll',
                chainId: 534352,
                urls: {
                  apiURL: 'https://api.scrollscan.com/api',
                  browserURL: 'https://scrollscan.com/',
                },
            },
            {
                network: 'mode',
                chainId: 34443,
                urls: {
                  apiURL: 'https://explorer.mode.network/api',
                  browserURL: 'https://explorer.mode.network/',
                },
            },
            {
                network: 'arb_sepolia',
                chainId: 421614,
                urls: {
                  apiURL: 'https://api-sepolia.arbiscan.io/api',
                  browserURL: 'https://sepolia.arbiscan.io/',
                },
            },
        ],
    },
}
export default config
