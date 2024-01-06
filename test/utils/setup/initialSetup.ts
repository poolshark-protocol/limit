import { keccak256 } from 'ethers/lib/utils'
import { SUPPORTED_NETWORKS } from '../../../scripts/constants/supportedNetworks'
import { DeployAssist } from '../../../scripts/util/deployAssist'
import { ContractDeploymentsKeys } from '../../../scripts/util/files/contractDeploymentKeys'
import { ContractDeploymentsJson } from '../../../scripts/util/files/contractDeploymentsJson'
import { BurnLimitCall__factory, LimitPool__factory, MintLimitCall__factory, LimitPositions__factory, QuoteCall__factory, PositionERC1155__factory, LimitTicks__factory, FeesCall__factory, SampleCall__factory, SnapshotRangeCall__factory, SnapshotLimitCall__factory, WETH9__factory, RangeStaker, RangeStaker__factory } from '../../../typechain'
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

    /// DEPLOY CONFIG
    private deployTokens = false
    private deployContracts = false
    private deployPools = false
    private deployRouter = false
    private deployStaker = true

    constructor() {
        this.deployAssist = new DeployAssist()
        this.contractDeploymentsJson = new ContractDeploymentsJson()
        this.contractDeploymentsKeys = new ContractDeploymentsKeys()
        this.constantProductString = ethers.utils.formatBytes32String('CONSTANT-PRODUCT')
    }

    public async initialLimitPoolSetup(): Promise<number> {
        const network = SUPPORTED_NETWORKS[hre.network.name.toUpperCase()]
        
        if (!this.deployTokens && hre.network.name != 'hardhat') {
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
              hre.props.token0 = await hre.ethers.getContractAt('Token20', token0Address)
              hre.props.token1 = await hre.ethers.getContractAt('Token20', token1Address)
        } else {
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
        }

        // Encode the function parameters
        // const abiCoder = new ethers.utils.AbiCoder();
        // const encodedData = abiCoder.encode(["address", "address", "int16"], [hre.props.token0.address, hre.props.token1.address, 10]);
        // const signature = keccak256(encodedData);
        // console.log('encoded data:', signature);
        if (this.deployContracts || hre.network.name == 'hardhat') {
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

            const enableImplTxn = await hre.props.limitPoolManager.enablePoolType(
                hre.props.limitPoolImpl.address,
                hre.props.positionERC1155.address,
                this.constantProductString
            )
            await enableImplTxn.wait();

            hre.nonce += 1;

            const setFactoryTxn = await hre.props.limitPoolManager.setFactory(
                hre.props.limitPoolFactory.address
            )
            await setFactoryTxn.wait()

            hre.nonce += 1;
    
            let limitPoolAddress; let limitPoolTokenAddress;
    
            if (hre.network.name == 'hardhat') {
                // deploy weth9
                await this.deployAssist.deployContractWithRetry(
                    network,
                    // @ts-ignore
                    WETH9__factory,
                    'weth9',
                    []
                )
                // add 500 fee tier
                let enableFeeTierTxn = await hre.props.limitPoolManager.enableFeeTier(
                    500,
                    10
                );
                await enableFeeTierTxn.wait();

                hre.nonce += 1;

                // add 500 fee tier
                enableFeeTierTxn = await hre.props.limitPoolManager.enableFeeTier(
                    800,
                    2
                );
                await enableFeeTierTxn.wait();

                hre.nonce += 1;

                // create first limit pool
                let createPoolTxn = await hre.props.limitPoolFactory.createLimitPool({
                    poolTypeId: 0,
                    tokenIn: hre.props.token0.address,
                    tokenOut: hre.props.token1.address,
                    swapFee: '500',
                    startPrice: '177159557114295710296101716160'
                });
                await createPoolTxn.wait();

                hre.nonce += 1;

                // create weth limit pool
                let wethPoollTxn = await hre.props.limitPoolFactory.createLimitPool({
                    poolTypeId: 0,
                    tokenIn: hre.props.weth9.address,
                    tokenOut: hre.props.token1.address,
                    swapFee: '500',
                    startPrice: '3266660825699135434887405499641'
                });
                await wethPoollTxn.wait();
    
                hre.nonce += 1;

                // create kyber test limit pool
                let kyperPoolTxn = await hre.props.limitPoolFactory.createLimitPool({
                    poolTypeId: 0,
                    tokenIn: hre.props.token0.address,
                    tokenOut: hre.props.token1.address,
                    swapFee: '800',
                    startPrice: '3266660825699135434887405499641'
                });
                await kyperPoolTxn.wait();
    
                hre.nonce += 1;
    
                [limitPoolAddress, limitPoolTokenAddress] = await hre.props.limitPoolFactory.getLimitPool(
                    hre.props.token0.address,
                    hre.props.token1.address,
                    '500',
                    0
                )

                let [wethPoolAddress, wethPoolTokenAddress] = await hre.props.limitPoolFactory.getLimitPool(
                    hre.props.weth9.address,
                    hre.props.token1.address,
                    '500',
                    0
                )

                hre.props.wethPool = await hre.ethers.getContractAt('LimitPool', wethPoolAddress)
                hre.props.wethPoolToken = await hre.ethers.getContractAt('PositionERC1155', wethPoolTokenAddress)

                let [kyberPoolAddress, kyberPoolTokenAddress] = await hre.props.limitPoolFactory.getLimitPool(
                    hre.props.token0.address,
                    hre.props.token1.address,
                    '800',
                    0
                )

                hre.props.kyberPool = await hre.ethers.getContractAt('LimitPool', kyberPoolAddress)
                hre.props.kyberPoolToken = await hre.ethers.getContractAt('PositionERC1155', kyberPoolTokenAddress)

            } else if (this.deployPools) {
                // create first limit pool
                let createPoolTxn = await hre.props.limitPoolFactory.createLimitPool({
                    poolTypeId: 0,
                    tokenIn: hre.props.token0.address,
                    tokenOut: hre.props.token1.address,
                    swapFee: '1000',
                    startPrice: '3854594635971501655978346'
                });
                await createPoolTxn.wait();
    
                hre.nonce += 1;
    
                [limitPoolAddress, limitPoolTokenAddress] = await hre.props.limitPoolFactory.getLimitPool(
                    hre.props.token0.address,
                    hre.props.token1.address,
                    '1000',
                    0
                )
    
                hre.nonce += 1;
                // @dev - skip 0.3% and 1% fee tiers for now
                // createPoolTxn = await hre.props.limitPoolFactory.createLimitPool({
                //     poolTypeId: 0,
                //     tokenIn: hre.props.token0.address,
                //     tokenOut: hre.props.token1.address,
                //     swapFee: '3000',
                //     startPrice: '1738267302024796147492397123192298'
                // });
                // await createPoolTxn.wait();
    
                // hre.nonce += 1;
    
                // createPoolTxn = await hre.props.limitPoolFactory.createLimitPool({
                //     poolTypeId: 0,
                //     tokenIn: hre.props.token0.address,
                //     tokenOut: hre.props.token1.address,
                //     swapFee: '10000',
                //     startPrice: '1738267302024796147492397123192298'
                // });
                // await createPoolTxn.wait();

                // hre.nonce += 1;
            }
    
            hre.props.limitPool = await hre.ethers.getContractAt('LimitPool', limitPoolAddress)
            hre.props.limitPoolToken = await hre.ethers.getContractAt('PositionERC1155', limitPoolTokenAddress)

            await hre.props.limitPoolToken.name()
            await hre.props.limitPoolToken.symbol()
    
            await this.deployAssist.saveContractDeployment(
                network,
                'LimitPool',
                'limitPool',
                hre.props.limitPool,
                [
                    hre.props.token0.address,
                    hre.props.token1.address,
                    hre.network.name == 'hardhat' ? '500' : '1000',
                    0
                ]
            )
        }

        if (hre.network.name == 'hardhat' || this.deployRouter) {
            let limitPoolFactoryAddress; let coverPoolFactoryAddress; let weth9Address;
            if (hre.network.name == 'hardhat') {
                limitPoolFactoryAddress = hre.props.limitPoolFactory.address
                coverPoolFactoryAddress = '0x0000000000000000000000000000000000000000'
                weth9Address = hre.props.weth9.address
            } else {
                limitPoolFactoryAddress = (
                    await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                        {
                            networkName: hre.network.name,
                            objectName: 'limitPoolFactory',
                        },
                        'readLimitPoolSetup'
                    )
                ).contractAddress
                coverPoolFactoryAddress = (
                    await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                        {
                            networkName: hre.network.name,
                            objectName: 'coverPoolFactory',
                        },
                        'readLimitPoolSetup'
                    )
                ).contractAddress
                weth9Address = (
                    await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                      {
                        networkName: hre.network.name,
                        objectName: 'weth9',
                      },
                      'readLimitPoolSetup'
                    )
                ).contractAddress
            }
            await this.deployAssist.deployContractWithRetry(
                network,
                // @ts-ignore
                PoolsharkRouter__factory,
                'poolRouter',
                [
                  limitPoolFactoryAddress, // limitPoolFactory
                  coverPoolFactoryAddress, // coverPoolFactory,
                  weth9Address
                ]
            )
        }
        if (hre.network.name == 'hardhat' || this.deployStaker) {
            let limitPoolFactoryAddress;
            if (hre.network.name == 'hardhat') {
                limitPoolFactoryAddress = hre.props.limitPoolFactory.address
            } else {
                limitPoolFactoryAddress = (
                    await this.contractDeploymentsJson.readContractDeploymentsJsonFile(
                        {
                            networkName: hre.network.name,
                            objectName: 'limitPoolFactory',
                        },
                        'readLimitPoolSetup'
                    )
                ).contractAddress 
            }
            await this.deployAssist.deployContractWithRetry(
                network,
                // @ts-ignore
                RangeStaker__factory,
                'rangeStaker',
                [
                    {
                        limitPoolFactory: limitPoolFactoryAddress,
                        startTime: 0,
                        endTime: 2000707154
                    }
                ]
            )   
        }
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
        // await hre.props.limitPoolFactory
        //   .connect(hre.props.admin)
        //   .createLimitPool({
        //     poolType: this.constantProductString,
        //     tokenIn: hre.props.token0.address,
        //     tokenOut: hre.props.token1.address,
        //     swapFee: '10000',
        //     startPrice: '177159557114295710296101716160'
        //   })
        // hre.nonce += 1
        // 1000
        // 3000
        // 10000
        let poolTxn = await hre.props.limitPoolFactory
          .connect(hre.props.admin)
          .createLimitPool({
            poolTypeId: 0,
            tokenIn: '0x5339F8fDFc2a9bE081fc1d924d9CF1473dA46C68',  // stETH
            tokenOut: '0x3a56859B3E176636095c142c87F73cC57B408b67', // USDC
            swapFee: '1000',
            startPrice: '3169126500570573503741758013440'
        })
        await poolTxn.wait()
        hre.nonce += 1
        poolTxn = await hre.props.limitPoolFactory
            .connect(hre.props.admin)
            .createLimitPool({
            poolTypeId: 0,
            tokenIn: '0x681cfAC3f265b6041FF4648A1CcB214F1c0DcF38',  // YFI
            tokenOut: '0x7dCF144D7f39d7aD7aE0E6F9E612379F73BD8E80', // DAI
            swapFee: '1000',
            startPrice: '177159557114295710296101716160'
        })
        await poolTxn.wait()
        hre.nonce += 1
        poolTxn = await hre.props.limitPoolFactory
        .connect(hre.props.admin)
        .createLimitPool({
            poolTypeId: 0,
            tokenIn: '0x681cfAC3f265b6041FF4648A1CcB214F1c0DcF38',  // YFI
            tokenOut: '0xa9e1ab5e6878621F80E03A4a5F8FB3705F4FFA2B', // SUSHI
            swapFee: '1000',
            startPrice: '177159557114295710296101716160'
        })
        await poolTxn.wait()
        hre.nonce += 1
        poolTxn = await hre.props.limitPoolFactory
        .connect(hre.props.admin)
        .createLimitPool({
            poolTypeId: 0,
            tokenIn: '0x3a56859B3E176636095c142c87F73cC57B408b67',  // USDC
            tokenOut: '0x7dCF144D7f39d7aD7aE0E6F9E612379F73BD8E80', // DAI
            swapFee: '1000',
            startPrice: '177159557114295710296101716160'
        })
        await poolTxn.wait()
        hre.nonce += 1
    }
}
