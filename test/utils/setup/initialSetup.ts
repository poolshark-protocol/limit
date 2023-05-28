import { SUPPORTED_NETWORKS } from '../../../scripts/constants/supportedNetworks'
import { DeployAssist } from '../../../scripts/util/deployAssist'
import { ContractDeploymentsKeys } from '../../../scripts/util/files/contractDeploymentKeys'
import { ContractDeploymentsJson } from '../../../scripts/util/files/contractDeploymentsJson'
import { QuoteCall__factory } from '../../../typechain'
import { BurnCall__factory } from '../../../typechain'
import { SwapCall__factory } from '../../../typechain'
import { MintCall__factory } from '../../../typechain'
import {
    Token20__factory,
    LimitPoolFactory__factory,
    Ticks__factory,
    Positions__factory,
    Epochs__factory,
    Deltas__factory,
    Claims__factory,
    LimitPoolManager__factory,
    TickMap__factory,
    EpochMap__factory,
    UniswapV3Source__factory,
    UniswapV3FactoryMock__factory,
} from '../../../typechain'

export class InitialSetup {
    private token0Decimals = 18
    private token1Decimals = 18
    private uniV3String = ethers.utils.formatBytes32String('UNI-V3')
    private constantProductString =  ethers.utils.formatBytes32String('CONSTANT-PRODUCT')
    private deployAssist: DeployAssist
    private contractDeploymentsJson: ContractDeploymentsJson
    private contractDeploymentsKeys: ContractDeploymentsKeys

    constructor() {
        this.deployAssist = new DeployAssist()
        this.contractDeploymentsJson = new ContractDeploymentsJson()
        this.contractDeploymentsKeys = new ContractDeploymentsKeys()
    }

    public async initialLimitPoolSetup(): Promise<number> {
        const network = SUPPORTED_NETWORKS[hre.network.name.toUpperCase()]
        
        // const token0Address = (
        //     await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
        //       {
        //         networkName: hre.network.name,
        //         objectName: 'token0',
        //       },
        //       'readLimitPoolSetup'
        //     )
        //   ).contractAddress
        //   const token1Address = (
        //     await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
        //       {
        //         networkName: hre.network.name,
        //         objectName: 'token1',
        //       },
        //       'readLimitPoolSetup'
        //     )
        //   ).contractAddress
        //   hre.props.token0 = await hre.ethers.getContractAt('Token20', token0Address)
        //   hre.props.token1 = await hre.ethers.getContractAt('Token20', token1Address)
        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            Token20__factory,
            'tokenA',
            ['Token20A', 'TOKEN20A', this.token0Decimals]
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            Token20__factory,
            'tokenB',
            ['Token20B', 'TOKEN20B', this.token1Decimals]
        )

        const tokenOrder = hre.props.tokenA.address.localeCompare(hre.props.tokenB.address)
        let token0Args
        let token1Args
        if (tokenOrder < 0) {
            hre.props.token0 = hre.props.tokenA
            hre.props.token1 = hre.props.tokenB
            token0Args = ['Token20A', 'TOKEN20A', this.token0Decimals]
            token1Args = ['Token20B', 'TOKEN20B', this.token1Decimals]
        } else {
            hre.props.token0 = hre.props.tokenB
            hre.props.token1 = hre.props.tokenA
            token0Args = ['Token20B', 'TOKEN20B', this.token1Decimals]
            token1Args = ['Token20A', 'TOKEN20A', this.token0Decimals]
        }
        this.deployAssist.saveContractDeployment(
            network,
            'Token20',
            'token0',
            hre.props.token0,
            token0Args
        )
        this.deployAssist.saveContractDeployment(
            network,
            'Token20',
            'token1',
            hre.props.token1,
            token1Args
        )
        this.deployAssist.deleteContractDeployment(network, 'tokenA')
        this.deployAssist.deleteContractDeployment(network, 'tokenB')

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            UniswapV3FactoryMock__factory,
            'uniswapV3FactoryMock',
            [
                hre.props.token0.address,
                hre.props.token1.address
            ]
        )
        const mockPoolAddress = await hre.props.uniswapV3FactoryMock.getPool(
            hre.props.token0.address,
            hre.props.token1.address,
            '500'
        )

        hre.props.uniswapV3PoolMock = await hre.ethers.getContractAt('UniswapV3PoolMock', mockPoolAddress)
        await this.deployAssist.saveContractDeployment(
            network,
            'UniswapV3PoolMock',
            'uniswapV3PoolMock',
            hre.props.uniswapV3PoolMock,
            [hre.props.token0.address, hre.props.token1.address, '500', '10']
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            UniswapV3Source__factory,
            'uniswapV3Source',
            [
                hre.props.uniswapV3FactoryMock.address
            ]
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            TickMap__factory,
            'tickMapLib',
            []
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            EpochMap__factory,
            'epochMapLib',
            []
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            Deltas__factory,
            'deltasLib',
            [],
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            Epochs__factory,
            'epochsLib',
            [],
            {
                'contracts/libraries/Deltas.sol:Deltas': hre.props.deltasLib.address,
                'contracts/libraries/TickMap.sol:TickMap': hre.props.tickMapLib.address,
                'contracts/libraries/EpochMap.sol:EpochMap': hre.props.epochMapLib.address
            }
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            Ticks__factory,
            'ticksLib',
            [],
            {
                'contracts/libraries/TickMap.sol:TickMap': hre.props.tickMapLib.address
            }
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            Claims__factory,
            'claimsLib',
            [],
            {
                'contracts/libraries/Deltas.sol:Deltas': hre.props.deltasLib.address,
                'contracts/libraries/TickMap.sol:TickMap': hre.props.tickMapLib.address,
                'contracts/libraries/EpochMap.sol:EpochMap': hre.props.epochMapLib.address
            }
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            Positions__factory,
            'positionsLib',
            [],
            {
                'contracts/libraries/Claims.sol:Claims': hre.props.claimsLib.address
            }
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            LimitPoolManager__factory,
            'coverPoolManager',
            [
                this.uniV3String,
                hre.props.uniswapV3Source.address,
                hre.props.uniswapV3Source.address
            ]
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            MintCall__factory,
            'mintCall',
            [],
            {
                'contracts/libraries/Deltas.sol:Deltas': hre.props.deltasLib.address,
                'contracts/libraries/TickMap.sol:TickMap': hre.props.tickMapLib.address,
                'contracts/libraries/EpochMap.sol:EpochMap': hre.props.epochMapLib.address,
                'contracts/libraries/Ticks.sol:Ticks': hre.props.ticksLib.address
            }
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            BurnCall__factory,
            'burnCall',
            [],
            {
                'contracts/libraries/Claims.sol:Claims': hre.props.claimsLib.address,
                'contracts/libraries/Deltas.sol:Deltas': hre.props.deltasLib.address,
                'contracts/libraries/TickMap.sol:TickMap': hre.props.tickMapLib.address,
                'contracts/libraries/EpochMap.sol:EpochMap': hre.props.epochMapLib.address,
                'contracts/libraries/Ticks.sol:Ticks': hre.props.ticksLib.address
            }
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            SwapCall__factory,
            'swapCall',
            []
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            QuoteCall__factory,
            'quoteCall',
            []
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            LimitPoolFactory__factory,
            'coverPoolFactory',
            [   
                hre.props.coverPoolManager.address
            ],
            {
                'contracts/libraries/Positions.sol:Positions': hre.props.positionsLib.address,
                'contracts/libraries/Ticks.sol:Ticks': hre.props.ticksLib.address,
                'contracts/libraries/Epochs.sol:Epochs': hre.props.epochsLib.address,
                'contracts/libraries/pool/MintCall.sol:MintCall': hre.props.mintCall.address,
                'contracts/libraries/pool/BurnCall.sol:BurnCall': hre.props.burnCall.address,
                'contracts/libraries/pool/SwapCall.sol:SwapCall': hre.props.swapCall.address,
                'contracts/libraries/pool/QuoteCall.sol:QuoteCall': hre.props.quoteCall.address
            }
        )

        const setFactoryTxn = await hre.props.coverPoolManager.setFactory(
            hre.props.coverPoolFactory.address
        )
        await setFactoryTxn.wait()

        hre.nonce += 1

        // create first cover pool
        let createPoolTxn = await hre.props.coverPoolFactory.createLimitPool(
            this.uniV3String,
            hre.props.token0.address,
            hre.props.token1.address,
            '500',
            '20',
            '5'
        )
        await createPoolTxn.wait()

        hre.nonce += 1

        let coverPoolAddress = await hre.props.coverPoolFactory.getLimitPool(
            this.uniV3String,
            hre.props.token0.address,
            hre.props.token1.address,
            '500',
            '20',
            '5'
        )
        hre.props.coverPool = await hre.ethers.getContractAt('LimitPool', coverPoolAddress)

        await this.deployAssist.saveContractDeployment(
            network,
            'LimitPool',
            'coverPool',
            hre.props.coverPool,
            [hre.props.uniswapV3PoolMock.address]
        )

        // create second cover pool
        createPoolTxn = await hre.props.coverPoolFactory.createLimitPool(
            this.uniV3String,
            hre.props.token0.address,
            hre.props.token1.address,
            '500',
            '40',
            '10'
        )
        await createPoolTxn.wait()

        hre.nonce += 1

        coverPoolAddress = await hre.props.coverPoolFactory.getLimitPool(
            this.uniV3String,
            hre.props.token0.address,
            hre.props.token1.address,
            '500',
            '40',
            '10'
        )
        hre.props.coverPool2 = await hre.ethers.getContractAt('LimitPool', coverPoolAddress)

        await this.deployAssist.saveContractDeployment(
            network,
            'LimitPool',
            'coverPool2',
            hre.props.coverPool2,
            [hre.props.uniswapV3PoolMock.address]
        )

        //TODO: for coverPool2 we need a second mock pool with a different cardinality

        await hre.props.uniswapV3PoolMock.setObservationCardinality('5', '5')

        return hre.nonce
    }

    public async readLimitPoolSetup(nonce: number): Promise<number> {
        const token0Address = (
            await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                {
                    networkName: hre.network.name,
                    objectName: 'token0',
                },
                'readLimitPoolSetup'
            )
        ).contractAddress
        const token1Address = (
            await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                {
                    networkName: hre.network.name,
                    objectName: 'token1',
                },
                'readLimitPoolSetup'
            )
        ).contractAddress
        const coverPoolAddress = (
            await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                {
                    networkName: hre.network.name,
                    objectName: 'coverPool',
                },
                'readLimitPoolSetup'
            )
        ).contractAddress

        const uniswapV3PoolMockAddress = (
            await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                {
                    networkName: hre.network.name,
                    objectName: 'uniswapV3PoolMock',
                },
                'readLimitPoolSetup'
            )
        ).contractAddress

        const coverPoolFactoryAddress = (
            await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                {
                    networkName: hre.network.name,
                    objectName: 'coverPoolFactory',
                },
                'readLimitPoolSetup'
            )
        ).contractAddress

        hre.props.token0 = await hre.ethers.getContractAt('Token20', token0Address)
        hre.props.token1 = await hre.ethers.getContractAt('Token20', token1Address)
        hre.props.coverPool = await hre.ethers.getContractAt('LimitPool', coverPoolAddress)
        hre.props.coverPoolFactory = await hre.ethers.getContractAt('LimitPoolFactory', coverPoolFactoryAddress)
        hre.props.uniswapV3PoolMock = await hre.ethers.getContractAt('UniswapV3PoolMock', uniswapV3PoolMockAddress)

        return nonce
    }

    public async createLimitPool(): Promise<void> {

        await hre.props.coverPoolFactory
          .connect(hre.props.admin)
          .createLimitPool(
            this.uniV3String,
            hre.props.token0.address,
            hre.props.token1.address,
            '500',
            '40',
            '40'
        )
        hre.nonce += 1
    }
}
