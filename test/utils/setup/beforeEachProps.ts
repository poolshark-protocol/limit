import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { getNonce } from '../../../tasks/utils'
import {
    LimitPool,
    LimitPoolFactory,
    Token20,
    LimitPoolManager,
    TickMap,
    PoolsharkRouter,
    RangePositions,
    LimitPositions,
    BurnLimitCall,
    MintLimitCall,
    PositionERC1155,
    Ticks,
    FeesCall,
    SampleCall,
    SnapshotRangeCall,
    SnapshotLimitCall,
    WETH9,
    RangeStaker,
} from '../../../typechain'
import { InitialSetup } from './initialSetup'
import { MintRangeCall } from '../../../typechain'
import { BurnRangeCall } from '../../../typechain'
import { SwapCall } from '../../../typechain'
import { QuoteCall } from '../../../typechain'

export interface BeforeEachProps {
    //shared
    limitPool: LimitPool
    wethPool: LimitPool
    wethPoolToken: PositionERC1155
    limitPoolImpl: LimitPool
    limitPoolToken: PositionERC1155
    kyberPool: LimitPool
    kyberPoolToken: PositionERC1155
    limitPoolManager: LimitPoolManager
    limitPoolFactory: LimitPoolFactory
    poolRouter: PoolsharkRouter
    ticksLib: Ticks
    tickMapLib: TickMap
    swapCall: SwapCall
    quoteCall: QuoteCall
    feesCall: FeesCall
    sampleCall: SampleCall
    //range
    burnRangeCall: BurnRangeCall
    mintRangeCall: MintRangeCall
    rangePositionsLib: RangePositions
    positionERC1155: PositionERC1155
    snapshotRangeCall: SnapshotRangeCall
    rangeStaker: RangeStaker
    //limit
    burnLimitCall: BurnLimitCall
    mintLimitCall: MintLimitCall
    snapshotLimitCall: SnapshotLimitCall
    limitPositionsLib: LimitPositions
    //shared
    tokenA: Token20
    tokenB: Token20
    token0: Token20
    token1: Token20
    weth9: WETH9
    admin: SignerWithAddress
    alice: SignerWithAddress
    bob: SignerWithAddress
    carol: SignerWithAddress
}

export class GetBeforeEach {
    private initialSetup: InitialSetup
    private nonce: number

    constructor() {
        this.initialSetup = new InitialSetup()
    }

    public async getBeforeEach() {
        hre.props = this.retrieveProps()
        const signers = await ethers.getSigners()
        hre.props.admin = signers[0]
        hre.props.alice = signers[0]
        if (hre.network.name == 'hardhat') {
            hre.props.bob = signers[1]
            hre.carol = signers[2]
        }
        hre.nonce = await getNonce(hre, hre.props.alice.address)
        this.nonce = await this.initialSetup.initialLimitPoolSetup()
    }

    public retrieveProps(): BeforeEachProps {
        //shared
        let limitPool: LimitPool
        let wethPool: LimitPool
        let wethPoolToken: PositionERC1155
        let limitPoolImpl: LimitPool
        let limitPoolToken: PositionERC1155
        let kyberPool: LimitPool
        let kyberPoolToken: PositionERC1155
        let limitPoolManager: LimitPoolManager
        let limitPoolFactory: LimitPoolFactory
        let poolRouter: PoolsharkRouter
        let tickMapLib: TickMap
        let ticksLib: Ticks
        let swapCall: SwapCall
        let quoteCall: QuoteCall
        let feesCall: FeesCall
        let sampleCall: SampleCall
        //range
        let burnRangeCall: BurnRangeCall
        let mintRangeCall: MintRangeCall
        let rangePositionsLib: RangePositions
        let positionERC1155: PositionERC1155
        let snapshotRangeCall: SnapshotRangeCall
        let rangeStaker: RangeStaker
        //limit
        let burnLimitCall: BurnLimitCall
        let mintLimitCall: MintLimitCall
        let limitPositionsLib: LimitPositions
        let snapshotLimitCall: SnapshotLimitCall
        //shared
        let tokenA: Token20
        let tokenB: Token20
        let token0: Token20
        let token1: Token20
        let weth9: WETH9
        let admin: SignerWithAddress
        let alice: SignerWithAddress
        let bob: SignerWithAddress
        let carol: SignerWithAddress

        return {
            //shared
            limitPool,
            wethPool,
            wethPoolToken,
            limitPoolImpl,
            limitPoolToken,
            kyberPool,
            kyberPoolToken,
            limitPoolManager,
            limitPoolFactory,
            poolRouter,
            tickMapLib,
            ticksLib,
            swapCall,
            quoteCall,
            feesCall,
            sampleCall,
            //range
            burnRangeCall,
            mintRangeCall,
            snapshotRangeCall,
            rangePositionsLib,
            positionERC1155,
            rangeStaker,
            //limit
            burnLimitCall,
            mintLimitCall,
            limitPositionsLib,
            snapshotLimitCall,
            //shared
            tokenA,
            tokenB,
            token0,
            token1,
            weth9,
            admin,
            alice,
            bob,
            carol,
        }
    }
}
