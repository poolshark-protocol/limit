import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { getNonce } from '../../../tasks/utils'
import {
    UniswapV3FactoryMock,
    UniswapV3PoolMock,
    LimitPool,
    LimitPoolFactory,
    Positions,
    Ticks,
    Token20,
    UniswapV3Source,
    Epochs,
    Deltas,
    Claims,
    LimitPoolManager,
    TickMap,
    EpochMap,
} from '../../../typechain'
import { InitialSetup } from './initialSetup'
import { MintCall } from '../../../typechain'
import { BurnCall } from '../../../typechain'
import { SwapCall } from '../../../typechain'
import { QuoteCall } from '../../../typechain'

export interface BeforeEachProps {
    coverPool: LimitPool
    coverPool2: LimitPool
    coverPoolManager: LimitPoolManager
    coverPoolFactory: LimitPoolFactory
    uniswapV3FactoryMock: UniswapV3FactoryMock
    uniswapV3PoolMock: UniswapV3PoolMock
    tickMapLib: TickMap
    deltasLib: Deltas
    epochsLib: Epochs
    epochMapLib: EpochMap
    ticksLib: Ticks
    uniswapV3Source: UniswapV3Source
    claimsLib: Claims
    positionsLib: Positions
    mintCall: MintCall
    burnCall: BurnCall
    swapCall: SwapCall
    quoteCall: QuoteCall
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
        let coverPool: LimitPool
        let coverPool2: LimitPool
        let coverPoolManager: LimitPoolManager
        let coverPoolFactory: LimitPoolFactory
        let uniswapV3FactoryMock: UniswapV3FactoryMock
        let uniswapV3PoolMock: UniswapV3PoolMock
        let tickMapLib: TickMap
        let deltasLib: Deltas
        let epochsLib: Epochs
        let epochMapLib: EpochMap
        let ticksLib: Ticks
        let uniswapV3Source: UniswapV3Source
        let claimsLib: Claims
        let positionsLib: Positions
        let mintCall: MintCall
        let burnCall: BurnCall
        let swapCall: SwapCall
        let quoteCall: QuoteCall
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
            coverPool,
            coverPool2,
            coverPoolManager,
            coverPoolFactory,
            uniswapV3FactoryMock,
            uniswapV3PoolMock,
            tickMapLib,
            deltasLib,
            epochsLib,
            epochMapLib,
            ticksLib,
            uniswapV3Source,
            claimsLib,
            positionsLib,
            mintCall,
            burnCall,
            swapCall,
            quoteCall,
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
