import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { getNonce } from '../../../tasks/utils'
import {
    LimitPool,
    LimitPoolFactory,
    Token20,
    LimitPoolManager,
    TickMap,
    PoolRouter,
    RangePositions,
    LimitPositions,
    BurnLimitCall,
    MintLimitCall,
    RangePoolERC1155,
    Ticks,
    FeesCall,
    SampleCall,
    SnapshotCall,
    SnapshotLimitCall,
} from '../../../typechain'
import { InitialSetup } from './initialSetup'
import { MintRangeCall } from '../../../typechain'
import { BurnRangeCall } from '../../../typechain'
import { SwapCall } from '../../../typechain'
import { QuoteCall } from '../../../typechain'

export interface BeforeEachProps {
    //shared
    limitPool: LimitPool
    limitPool2: LimitPool
    limitPoolImpl: LimitPool
    limitPoolToken: RangePoolERC1155
    limitPoolManager: LimitPoolManager
    limitPoolFactory: LimitPoolFactory
    poolRouter: PoolRouter
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
    rangePoolERC1155: RangePoolERC1155
    snapshotCall: SnapshotCall
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
    token20: Token20
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
        let limitPool2: LimitPool
        let limitPoolImpl: LimitPool
        let limitPoolToken: RangePoolERC1155
        let limitPoolManager: LimitPoolManager
        let limitPoolFactory: LimitPoolFactory
        let poolRouter: PoolRouter
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
        let rangePoolERC1155: RangePoolERC1155
        let snapshotCall: SnapshotCall
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
        let token20: Token20
        let admin: SignerWithAddress
        let alice: SignerWithAddress
        let bob: SignerWithAddress
        let carol: SignerWithAddress

        return {
            //shared
            limitPool,
            limitPool2,
            limitPoolImpl,
            limitPoolToken,
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
            snapshotCall,
            rangePositionsLib,
            rangePoolERC1155,
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
            token20,
            admin,
            alice,
            bob,
            carol,
        }
    }
}
