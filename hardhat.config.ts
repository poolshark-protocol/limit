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
        arb_one: {
            chainId: 42161,
            url: process.env.ARBITRUM_ONE_URL || '',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            timeout: 60000,
        },
        scrollSepolia: {
            chainId: 534351,
            url: "https://sepolia-rpc.scroll.io/" || "",
            gasPrice: 1_500_000_000,
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
        },
        op_goerli: {
            chainId: 420,
            gasPrice: 500,
            url: process.env.OPTIMISM_GOERLI_URL || '',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            timeout: 60000,
        },
    },
    etherscan: { 
        apiKey: {
            arbitrumOne: process.env.ARBITRUM_ONE_API_KEY,
            arbitrumGoerli: process.env.ARBITRUM_GOERLI_API_KEY,
            scrollSepolia: 'D62920783A4311EE9D6600155D570C742E',
        },
        customChains: [
            {
              network: 'scrollSepolia',
              chainId: 534351,
              urls: {
                apiURL: 'https://api-sepolia.scrollscan.dev/api',
                browserURL: 'https://api-sepolia.scrollscan.dev',
              },
            },
        ],
    },
}
export default config
