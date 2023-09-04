import { SUPPORTED_NETWORKS } from '../../../scripts/constants/supportedNetworks'
import { DeployAssist } from '../../../scripts/util/deployAssist'
import { ContractDeploymentsKeys } from '../../../scripts/util/files/contractDeploymentKeys'
import { ContractDeploymentsJson } from '../../../scripts/util/files/contractDeploymentsJson'
import { BurnLimitCall__factory, LimitPool__factory, MintLimitCall__factory, LimitPositions__factory, QuoteCall__factory, PositionERC1155__factory, LimitTicks__factory, FeesCall__factory, SampleCall__factory, SnapshotRangeCall__factory, SnapshotLimitCall__factory } from '../../../typechain'
import { BurnRangeCall__factory } from '../../../typechain'
import { SwapCall__factory } from '../../../typechain'
import { MintRangeCall__factory } from '../../../typechain'
import {
    Token20__factory,
    LimitPoolFactory__factory,
    Ticks__factory,
    RangePositions__factory,
    LimitPoolManager__factory,
    TickMap__factory,
    PoolsharkRouter__factory
} from '../../../typechain'

// import {abi as factoryAbi} from '../../../artifacts/contracts/LimitPoolFactory.sol/LimitPoolFactory.json'
// import { keccak256 } from 'ethers/lib/utils'

export class InitialSetup {
    private token0Decimals = 18
    private token1Decimals = 18
    private deployAssist: DeployAssist
    private contractDeploymentsJson: ContractDeploymentsJson
    private contractDeploymentsKeys: ContractDeploymentsKeys
    private constantProductString: string

    constructor() {
        this.deployAssist = new DeployAssist()
        this.contractDeploymentsJson = new ContractDeploymentsJson()
        this.contractDeploymentsKeys = new ContractDeploymentsKeys()
        this.constantProductString = ethers.utils.formatBytes32String('CONSTANT-PRODUCT')
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
            ['Wrapped Ether', 'WETH', this.token0Decimals]
        )
    
        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            Token20__factory,
            'tokenB',
            ['Dai Stablecoin', 'DAI', this.token1Decimals]
        )

        const tokenOrder = hre.props.tokenA.address.localeCompare(hre.props.tokenB.address) < 0
        let token0Args
        let token1Args
        if (tokenOrder) {
            hre.props.token0 = hre.props.tokenA
            hre.props.token1 = hre.props.tokenB
            token0Args = ['Wrapped Ether', 'WETH', this.token0Decimals]
            token1Args = ['Dai Stablecoin', 'DAI', this.token1Decimals]
        } else {
            hre.props.token0 = hre.props.tokenB
            hre.props.token1 = hre.props.tokenA
            token0Args = ['Dai Stablecoin', 'DAI', this.token1Decimals]
            token1Args = ['Wrapped Ether', 'WETH', this.token0Decimals]
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


        // Encode the function parameters
        // const abiCoder = new ethers.utils.AbiCoder();
        // const encodedData = abiCoder.encode(["address", "address", "int16"], [hre.props.token0.address, hre.props.token1.address, 10]);
        // const signature = keccak256(encodedData);
        // console.log('encoded data:', signature);

        // shared
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
            Ticks__factory,
            'ticksLib',
            [],
        )

        // range
        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            RangePositions__factory,
            'rangePositionsLib',
            [],
        )


        // limit
        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            LimitPositions__factory,
            'limitPositionsLib',
            [],
            {
                'contracts/libraries/Ticks.sol:Ticks': hre.props.ticksLib.address
            }

        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            LimitPoolManager__factory,
            'limitPoolManager',
            []
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            LimitPoolFactory__factory,
            'limitPoolFactory',
            [   
                hre.props.limitPoolManager.address
            ],
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            SwapCall__factory,
            'swapCall',
            [],
            {
                'contracts/libraries/Ticks.sol:Ticks': hre.props.ticksLib.address,
            }
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            MintRangeCall__factory,
            'mintRangeCall',
            []
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            BurnRangeCall__factory,
            'burnRangeCall',
            []
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            MintLimitCall__factory,
            'mintLimitCall',
            [],
            {
                'contracts/libraries/limit/LimitPositions.sol:LimitPositions': hre.props.limitPositionsLib.address
            }
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            BurnLimitCall__factory,
            'burnLimitCall',
            []
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            SnapshotLimitCall__factory,
            'snapshotLimitCall',
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
            FeesCall__factory,
            'feesCall',
            []
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            SampleCall__factory,
            'sampleCall',
            []
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            SnapshotRangeCall__factory,
            'snapshotRangeCall',
            []
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            LimitPool__factory,
            'limitPoolImpl',
            [
                hre.props.limitPoolFactory.address
            ],
            {
                'contracts/libraries/limit/LimitPositions.sol:LimitPositions': hre.props.limitPositionsLib.address,
                'contracts/libraries/Ticks.sol:Ticks': hre.props.ticksLib.address,
                'contracts/libraries/range/pool/MintRangeCall.sol:MintRangeCall': hre.props.mintRangeCall.address,
                'contracts/libraries/range/pool/BurnRangeCall.sol:BurnRangeCall': hre.props.burnRangeCall.address,
                'contracts/libraries/range/pool/SnapshotRangeCall.sol:SnapshotRangeCall': hre.props.snapshotRangeCall.address,
                'contracts/libraries/limit/pool/MintLimitCall.sol:MintLimitCall': hre.props.mintLimitCall.address,
                'contracts/libraries/limit/pool/BurnLimitCall.sol:BurnLimitCall': hre.props.burnLimitCall.address,
                'contracts/libraries/limit/pool/SnapshotLimitCall.sol:SnapshotLimitCall': hre.props.snapshotLimitCall.address,
                'contracts/libraries/pool/SwapCall.sol:SwapCall': hre.props.swapCall.address,
                'contracts/libraries/pool/QuoteCall.sol:QuoteCall': hre.props.quoteCall.address,
                'contracts/libraries/pool/FeesCall.sol:FeesCall': hre.props.feesCall.address,
                'contracts/libraries/pool/SampleCall.sol:SampleCall': hre.props.sampleCall.address
            }
        )

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            PositionERC1155__factory,
            'positionERC1155',
            [
              hre.props.limitPoolFactory.address
            ]
        )

        const enableImplTxn = await hre.props.limitPoolManager.enableImplementation(
            this.constantProductString,
            hre.props.limitPoolImpl.address,
            hre.props.positionERC1155.address
        )
        await enableImplTxn.wait();

        hre.nonce += 1;

        await this.deployAssist.deployContractWithRetry(
            network,
            // @ts-ignore
            PoolsharkRouter__factory,
            'poolRouter',
            [
              hre.props.limitPoolFactory.address,
              hre.props.limitPoolImpl.address //TODO: needs to be coverPoolFactory
            ]
        )

        const setFactoryTxn = await hre.props.limitPoolManager.setFactory(
            hre.props.limitPoolFactory.address
        )
        await setFactoryTxn.wait()

        hre.nonce += 1;

        // create first limit pool
        let createPoolTxn = await hre.props.limitPoolFactory.createLimitPool(
            this.constantProductString,
            hre.props.token0.address,
            hre.props.token1.address,
            '500',
            '177159557114295710296101716160'
        )
        await createPoolTxn.wait()

        hre.nonce += 1

        let limitPoolAddress; let limitPoolTokenAddress;
        [limitPoolAddress, limitPoolTokenAddress] = await hre.props.limitPoolFactory.getLimitPool(
            this.constantProductString,
            hre.props.token0.address,
            hre.props.token1.address,
            '500'
        )
        hre.props.limitPool = await hre.ethers.getContractAt('LimitPool', limitPoolAddress)
        hre.props.limitPoolToken = await hre.ethers.getContractAt('PositionERC1155', limitPoolTokenAddress)

        await this.deployAssist.saveContractDeployment(
            network,
            'LimitPool',
            'limitPool',
            hre.props.limitPool,
            [
                this.constantProductString,
                hre.props.token0.address,
                hre.props.token1.address,
                '500'
            ]
        )

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
        const limitPoolAddress = (
            await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                {
                    networkName: hre.network.name,
                    objectName: 'limitPool',
                },
                'readLimitPoolSetup'
            )
        ).contractAddress

        const limitPoolFactoryAddress = (
            await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                {
                    networkName: hre.network.name,
                    objectName: 'limitPoolFactory',
                },
                'readLimitPoolSetup'
            )
        ).contractAddress

        const positionERC1155Address = (
            await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                {
                    networkName: hre.network.name,
                    objectName: 'positionERC1155',
                },
                'readLimitPoolSetup'
            )
        ).contractAddress
        const poolRouterAddress = (
            await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                {
                    networkName: hre.network.name,
                    objectName: 'poolRouter',
                },
                'readLimitPoolSetup'
            )
        ).contractAddress

        hre.props.token0 = await hre.ethers.getContractAt('Token20', token0Address)
        hre.props.token1 = await hre.ethers.getContractAt('Token20', token1Address)
        hre.props.limitPool = await hre.ethers.getContractAt('LimitPool', limitPoolAddress)
        hre.props.limitPoolFactory = await hre.ethers.getContractAt('LimitPoolFactory', limitPoolFactoryAddress)
        hre.props.limitPoolToken = await hre.ethers.getContractAt('PositionERC1155', positionERC1155Address)
        hre.props.poolRouter = await hre.ethers.getContractAt('PoolsharkRouter', poolRouterAddress)

        return nonce
    }

    public async createLimitPool(): Promise<void> {

        await hre.props.limitPoolFactory
          .connect(hre.props.admin)
          .createLimitPool(
            this.constantProductString,
            hre.props.token0.address,
            hre.props.token1.address,
            '10000',
            '177159557114295710296101716160'
        )
        hre.nonce += 1
    }
}
