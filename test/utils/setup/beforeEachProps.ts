import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { getNonce } from '../../../tasks/utils'
import {
    LimitPool,
    LimitPoolFactory,
    Token20,
    LimitPoolManager,
    TickMap,
    PoolRouter,
    Positions,
    PositionsLimit,
    Ticks,
    TicksLimit,
    BurnLimitCall,
    MintLimitCall,
} from '../../../typechain'
import { InitialSetup } from './initialSetup'
import { MintCall } from '../../../typechain'
import { BurnCall } from '../../../typechain'
import { SwapCall } from '../../../typechain'
import { QuoteCall } from '../../../typechain'

export interface BeforeEachProps {
    //shared
    limitPool: LimitPool
    limitPool2: LimitPool
    limitPoolImpl: LimitPool
    limitPoolManager: LimitPoolManager
    limitPoolFactory: LimitPoolFactory
    poolRouter: PoolRouter
    tickMapLib: TickMap
    swapCall: SwapCall
    quoteCall: QuoteCall
    //range
    burnCall: BurnCall
    mintCall: MintCall
    positionsLib: Positions
    //limit
    burnLimitCall: BurnLimitCall
    mintLimitCall: MintLimitCall
    positionsLimitLib: PositionsLimit
    //shared/limit
    ticksLimitLib: TicksLimit
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
        let limitPoolManager: LimitPoolManager
        let limitPoolFactory: LimitPoolFactory
        let poolRouter: PoolRouter
        let tickMapLib: TickMap
        let swapCall: SwapCall
        let quoteCall: QuoteCall
        //range
        let burnCall: BurnCall
        let mintCall: MintCall
        let positionsLib: Positions
        //limit
        let burnLimitCall: BurnLimitCall
        let mintLimitCall: MintLimitCall
        let positionsLimitLib: PositionsLimit
        //shared/limit
        let ticksLimitLib: TicksLimit
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
            limitPoolManager,
            limitPoolFactory,
            poolRouter,
            tickMapLib,
            swapCall,
            quoteCall,
            //range
            burnCall,
            mintCall,
            positionsLib,
            //limit
            burnLimitCall,
            mintLimitCall,
            positionsLimitLib,
            //shared/limit,
            ticksLimitLib,
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
