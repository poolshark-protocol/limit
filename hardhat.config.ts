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
                version: '0.8.13',
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
            gasPrice: 1_000_000_000,
            url: process.env.ARBITRUM_GOERLI_URL || '',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            timeout: 60000,
        },
        scrollSepolia: {
            chainId: 534351,
            url: "https://sepolia-rpc.scroll.io/" || "",
            gasPrice: 1_500_000_000,
            accounts:
              process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
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
            arbitrumGoerli: process.env.ARBITRUM_GOERLI_API_KEY,
            scrollSepolia: 'abc',
        },
        customChains: [
            {
              network: 'scrollSepolia',
              chainId: 534351,
              urls: {
                apiURL: 'https://sepolia-blockscout.scroll.io/api',
                browserURL: 'https://sepolia-blockscout.scroll.io/',
              },
            },
        ],
    },
}
export default config
