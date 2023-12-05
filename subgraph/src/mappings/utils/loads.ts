import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts'
import { LimitPool, LimitPoolFactory, LimitPoolManager, LimitPosition, Token, FeeTier, BasePrice, RangePosition, RangeTick, Transaction, LimitTick, Swap, CompoundRangeLog, MintRangeLog, BurnRangeLog, PoolRouter, TvlUpdateLog, HistoricalOrder, TotalSeasonReward, UserSeasonReward, LimitPoolToken } from '../../../generated/schema'
import { ONE_BD } from '../../constants/constants'
import {
    fetchTokenSymbol,
    fetchTokenName,
    fetchTokenDecimals,
    BIGINT_ZERO,
    BIGDECIMAL_ZERO,
} from './helpers'
import { bigDecimalExponated, safeDiv } from './math'
import { getEthPriceInUSD } from './price'

class LoadBasePriceRet {
    entity: BasePrice
    exists: boolean
}
export function safeLoadBasePrice(name: string): LoadBasePriceRet {
    let exists = true

    let basePriceEntity = BasePrice.load(name)

    if (!basePriceEntity) {
        basePriceEntity = new BasePrice(name)
        exists = false
    }

    basePriceEntity.USD = getEthPriceInUSD()

    return {
        entity: basePriceEntity,
        exists: exists,
    }
}

class LoadTransactionRet {
    entity: Transaction
    exists: boolean
}
export function safeLoadTransaction(event: ethereum.Event): LoadTransactionRet {
    let exists = true

    let transactionEntity = Transaction.load(event.transaction.hash.toHex())

    if (!transactionEntity) {
        transactionEntity = new Transaction(event.transaction.hash.toHex())
        transactionEntity.sender = event.transaction.from
        transactionEntity.blockNumber = event.block.number
        transactionEntity.timestamp = event.block.timestamp
        transactionEntity.gasLimit = event.transaction.gasLimit
        transactionEntity.gasPrice = event.transaction.gasPrice
        exists = false
    }

    return {
        entity: transactionEntity,
        exists: exists,
    }
}

class LoadTokenRet {
    entity: Token
    exists: boolean
}
export function safeLoadToken(address: string): LoadTokenRet {
    let exists = true

    let tokenEntity = Token.load(address)

    if (!tokenEntity) {
        tokenEntity = new Token(address)
        log.info('{}', [address])
        let tokenAddress = Address.fromString(address)
        tokenEntity.symbol = fetchTokenSymbol(tokenAddress)
        tokenEntity.name = fetchTokenName(tokenAddress)
        tokenEntity.decimals = fetchTokenDecimals(tokenAddress)

        exists = false
    }

    return {
        entity: tokenEntity,
        exists: exists,
    }
}

class LoadManagerRet {
    entity: LimitPoolManager
    exists: boolean
}
export function safeLoadManager(address: string): LoadManagerRet {
    let exists = true

    let managerEntity = LimitPoolManager.load(address)

    if (!managerEntity) {
        managerEntity = new LimitPoolManager(address)
        exists = false
    }

    return {
        entity: managerEntity,
        exists: exists,
    }
}
class LoadFeeTierRet {
    entity: FeeTier
    exists: boolean
}
export function safeLoadFeeTier(feeTier: BigInt): LoadFeeTierRet {
    let exists = true

    let feeTierId = feeTier.toString()
    log.debug('pool volatility tier id: {}', [feeTierId])

    let feeTierEntity = FeeTier.load(feeTierId)

    if (!feeTierEntity) {
        feeTierEntity = new FeeTier(feeTierId)
        exists = false
    }

    return {
        entity: feeTierEntity,
        exists: exists,
    }
}

class LoadRangeTickRet {
    entity: RangeTick
    exists: boolean
}
export function safeLoadRangeTick(address: string, index: BigInt): LoadRangeTickRet {
    let exists = true

    let tickId = address
    .concat(index.toString())

    let tickEntity = RangeTick.load(tickId)

    if (!tickEntity) {
        tickEntity = new RangeTick(tickId)
        tickEntity.pool = address
        tickEntity.index = index
        // 1.0001^tick is token1/token0.
        tickEntity.price0 = bigDecimalExponated(BigDecimal.fromString('1.0001'), BigInt.fromI32(tickEntity.index.toI32()))
        tickEntity.price1 = safeDiv(ONE_BD, tickEntity.price0)
        exists = false
    }

    return {
        entity: tickEntity,
        exists: exists,
    }
}

class LoadLimitTickRet {
    entity: LimitTick
    exists: boolean
}
export function safeLoadLimitTick(address: string, index: BigInt): LoadLimitTickRet {
    let exists = true

    let tickId = address
    .concat(index.toString())

    let tickEntity = LimitTick.load(tickId)

    if (!tickEntity) {
        tickEntity = new LimitTick(tickId)
        tickEntity.pool = address
        tickEntity.index = index
        // 1.0001^tick is token1/token0.
        tickEntity.price0 = bigDecimalExponated(BigDecimal.fromString('1.0001'), BigInt.fromI32(tickEntity.index.toI32()))
        tickEntity.price1 = safeDiv(ONE_BD, tickEntity.price0)
        tickEntity.active = true
        exists = false
    }

    return {
        entity: tickEntity,
        exists: exists,
    }
}

class LoadLimitPoolFactoryRet {
    entity: LimitPoolFactory
    exists: boolean
}
export function safeLoadLimitPoolFactory(factoryAddress: string): LoadLimitPoolFactoryRet {
    let exists = true
    let coverPoolFactoryEntity = LimitPoolFactory.load(factoryAddress)

    if (!coverPoolFactoryEntity) {
        coverPoolFactoryEntity = new LimitPoolFactory(factoryAddress)
        coverPoolFactoryEntity.poolCount = BIGINT_ZERO
        exists = false
    }

    return {
        entity: coverPoolFactoryEntity,
        exists: exists,
    }
}

class LoadLimitPoolRet {
    entity: LimitPool
    exists: boolean
}
export function safeLoadLimitPool(poolAddress: string): LoadLimitPoolRet {
    let exists = true
    let limitPoolEntity = LimitPool.load(poolAddress)

    if (!limitPoolEntity) {
        limitPoolEntity = new LimitPool(poolAddress)
        exists = false
    }

    return {
        entity: limitPoolEntity,
        exists: exists,
    }
}

class LoadLimitPoolTokenRet {
    entity: LimitPoolToken
    exists: boolean
}
export function safeLoadLimitPoolToken(poolTokenAddress: string): LoadLimitPoolTokenRet {
    let exists = true
    let limitPoolTokenEntity = LimitPoolToken.load(poolTokenAddress)

    if (!limitPoolTokenEntity) {
        limitPoolTokenEntity = new LimitPoolToken(poolTokenAddress)
        exists = false
    }

    return {
        entity: limitPoolTokenEntity,
        exists: exists,
    }
}

class LoadPoolRouterRet {
    entity: PoolRouter
    exists: boolean
}
export function safeLoadPoolRouter(routerAddress: string): LoadPoolRouterRet {
    let exists = true
    let poolRouterEntity = PoolRouter.load(routerAddress)

    if (!poolRouterEntity) {
        poolRouterEntity = new PoolRouter(routerAddress)
        exists = false
    }

    return {
        entity: poolRouterEntity,
        exists: exists,
    }
}

class LoadLimitPositionRet {
    entity: LimitPosition
    exists: boolean
}
export function safeLoadLimitPosition(
    poolAddress: string,
    positionId: BigInt
): LoadLimitPositionRet {
    let exists = true
    let fromToken: string

    let limitPositionId = poolAddress
        .concat(positionId.toString())

    let positionEntity = LimitPosition.load(limitPositionId)

    if (!positionEntity) {
        positionEntity = new LimitPosition(limitPositionId)
        exists = false
    }

    return {
        entity: positionEntity,
        exists: exists,
    }
}

class LoadSwapRet {
    entity: Swap
    exists: boolean
}
export function safeLoadSwap(event: ethereum.Event, pool: LimitPool): LoadSwapRet {
    let exists = true

    let swapId = event.transaction.hash.toHex()
                 .concat('-')
                 .concat(pool.txnCount.toString())
    let swapEntity = Swap.load(swapId)

    if (!swapEntity) {
        swapEntity = new Swap(swapId)
        swapEntity.pool = pool.id
        exists = false
    }

    return {
        entity: swapEntity,
        exists: exists,
    }
}

class LoadRangePositionRet {
    entity: RangePosition
    exists: boolean
}
export function safeLoadRangePosition(
    poolAddress: string,
    positionId: BigInt
): LoadRangePositionRet {
    let exists = true
    let fromToken: string

    let rangePositionId = poolAddress
        .concat(positionId.toString())

    let positionEntity = RangePosition.load(rangePositionId)

    if (!positionEntity) {
        positionEntity = new RangePosition(rangePositionId)

        exists = false
    }

    return {
        entity: positionEntity,
        exists: exists,
    }
}
export function safeLoadRangePositionById(
    rangePositionId: string
): LoadRangePositionRet {
    let exists = true
    let fromToken: string

    let positionEntity = RangePosition.load(rangePositionId)

    if (!positionEntity) {
        positionEntity = new RangePosition(rangePositionId)

        exists = false
    }

    return {
        entity: positionEntity,
        exists: exists,
    }
}

class LoadTvlUpdateLog {
    entity: TvlUpdateLog
    exists: boolean
}
export function safeLoadTvlUpdateLog(txnHash: Bytes, pool: string): LoadTvlUpdateLog {
    let exists = true

    let tvlUpdateLogId = txnHash.toString()
                    .concat('-')
                    .concat(pool)

    let tvlUpdateLogEntity = TvlUpdateLog.load(tvlUpdateLogId)

    if (!tvlUpdateLogEntity) {
        tvlUpdateLogEntity = new TvlUpdateLog(tvlUpdateLogId)
        exists = false
    }

    return {
        entity: tvlUpdateLogEntity,
        exists: exists,
    }
}

class LoadMintRangeLogRet {
    entity: MintRangeLog
    exists: boolean
}
export function safeLoadMintRangeLog(txnHash: Bytes, pool: string, positionId: BigInt): LoadMintRangeLogRet {
    let exists = true

    let mintRangeLogId = txnHash.toString()
                    .concat('-')
                    .concat(pool)
                    .concat('-')
                    .concat(positionId.toString())

    let mintRangeLogEntity = MintRangeLog.load(mintRangeLogId)

    if (!mintRangeLogEntity) {
        mintRangeLogEntity = new MintRangeLog(mintRangeLogId)
        exists = false
    }

    return {
        entity: mintRangeLogEntity,
        exists: exists,
    }
}

class LoadBurnLogRet {
    entity: BurnRangeLog
    exists: boolean
}
export function safeLoadBurnLog(txnHash: Bytes, pool: string, positionId: BigInt): LoadBurnLogRet {
    let exists = true

    let burnRangeLogId = txnHash.toString()
                    .concat('-')
                    .concat(pool)
                    .concat('-')
                    .concat(positionId.toString())

    let burnRangeLogEntity = BurnRangeLog.load(burnRangeLogId)

    if (!burnRangeLogEntity) {
        burnRangeLogEntity = new BurnRangeLog(burnRangeLogId)
        exists = false
    }

    return {
        entity: burnRangeLogEntity,
        exists: exists,
    }
}

class LoadCompoundRangeLogRet {
    entity: CompoundRangeLog
    exists: boolean
}
export function safeLoadCompoundRangeLog(txnHash: Bytes, pool: string, positionId: BigInt): LoadCompoundRangeLogRet {
    let exists = true

    let compoundLogId = txnHash.toString()
                    .concat('-')
                    .concat(pool)
                    .concat('-')
                    .concat(positionId.toString())

    let compoundLogEntity = CompoundRangeLog.load(compoundLogId)

    if (!compoundLogEntity) {
        compoundLogEntity = new CompoundRangeLog(compoundLogId)
        exists = false
    }

    return {
        entity: compoundLogEntity,
        exists: exists,
    }
}

class LoadHistoricalOrderRet {
    entity: HistoricalOrder
    exists: boolean
}
export function safeLoadHistoricalOrder(tokenInAddress: string, tokenOutAddress: string, poolAddress: string, txnHashOrPositionId: string): LoadHistoricalOrderRet {
    let exists = true

    let historicalOrderId = tokenInAddress
                            .concat('-')
                            .concat(tokenOutAddress)
                            .concat('-')
                            .concat(poolAddress)
                            .concat('-')
                            .concat(txnHashOrPositionId)

    let historicalOrderEntity = HistoricalOrder.load(historicalOrderId)

    if (!historicalOrderEntity) {
        historicalOrderEntity = new HistoricalOrder(historicalOrderId)
<<<<<<< HEAD
        historicalOrderEntity.positionId = BIGINT_ZERO
=======
>>>>>>> master
        historicalOrderEntity.tokenIn = tokenInAddress
        historicalOrderEntity.tokenOut = tokenOutAddress
        historicalOrderEntity.amountIn = BIGDECIMAL_ZERO
        historicalOrderEntity.amountOut = BIGDECIMAL_ZERO
        historicalOrderEntity.completed = true

        exists = false
    }

    return {
        entity: historicalOrderEntity,
        exists: exists,
    }
}

class LoadTotalSeasonRewardRet {
    entity: TotalSeasonReward
    exists: boolean
}
export function safeLoadTotalSeasonReward(factoryAddress: string): LoadTotalSeasonRewardRet {
    let exists = true

    let totalSeasonRewardEntity = TotalSeasonReward.load(factoryAddress)

    if (!totalSeasonRewardEntity) {
        totalSeasonRewardEntity = new TotalSeasonReward(factoryAddress)
        exists = false
    }

    return {
        entity: totalSeasonRewardEntity,
        exists: exists,
    }
}

class LoadUserSeasonRewardRet {
    entity: UserSeasonReward
    exists: boolean
}
export function safeLoadUserSeasonReward(userAddress: string): LoadUserSeasonRewardRet {
    let exists = true

    let userSeasonRewardEntity = UserSeasonReward.load(userAddress)

    if (!userSeasonRewardEntity) {
        userSeasonRewardEntity = new UserSeasonReward(userAddress)

        exists = false
    }

    return {
        entity: userSeasonRewardEntity,
        exists: exists,
    }
}