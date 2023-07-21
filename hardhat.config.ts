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
            allowUnlimitedContractSize: true,
        },
        arb_goerli: {
            chainId: 421613,
            gasPrice: 10000000000,
            url: process.env.ARBITRUM_GOERLI_URL || '',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            timeout: 60000,
            allowUnlimitedContractSize: true,
        },
        op_goerli: {
            chainId: 420,
            gasPrice: 500,
            url: process.env.OPTIMISM_GOERLI_URL || '',
            accounts: process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
            timeout: 60000,
            allowUnlimitedContractSize: true,
        },
    },
    etherscan: {
        apiKey: process.env.ARBITRUM_GOERLI_API_KEY,
    },
}
export default config
