import { Address, BigDecimal, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts'
import { LimitPool, LimitPoolFactory, LimitPoolManager, LimitPosition, Token, FeeTier, BasePrice, RangePosition, RangeTick, Transaction, LimitTick, Swap, CompoundRangeLog, MintRangeLog, BurnRangeLog, PoolRouter, TvlUpdateLog, HistoricalOrder, TotalSeasonReward, UserSeasonReward, LimitPoolToken, VFinPosition } from '../../../generated/schema'
import { FACTORY_ADDRESS, ONE_BD } from '../../constants/constants'
import {
    fetchTokenSymbol,
    fetchTokenName,
    fetchTokenDecimals,
    BIGINT_ZERO,
    BIGDECIMAL_ZERO,
    BIGINT_ONE,
} from './helpers'
import { bigDecimalExponated, safeDiv } from './math'
import { getEthPriceInUSD } from './price'
import { ZERO_ADDRESS } from '../../constants/constants'

class LoadLimitPoolFactoryRet {
    entity: LimitPoolFactory
    exists: boolean
}
export function safeLoadLimitPoolFactory(factoryAddress: string): LoadLimitPoolFactoryRet {
    let exists = true
    let limitPoolFactoryEntity = LimitPoolFactory.load(factoryAddress)

    if (!limitPoolFactoryEntity) {
        limitPoolFactoryEntity = new LimitPoolFactory(factoryAddress)

        limitPoolFactoryEntity.manager = ZERO_ADDRESS
        limitPoolFactoryEntity.poolCount = BIGINT_ZERO
        limitPoolFactoryEntity.txnCount = BIGINT_ZERO
        limitPoolFactoryEntity.volumeEthTotal = BIGDECIMAL_ZERO
        limitPoolFactoryEntity.volumeUsdTotal = BIGDECIMAL_ZERO
        limitPoolFactoryEntity.feesUsdTotal = BIGDECIMAL_ZERO
        limitPoolFactoryEntity.feesEthTotal = BIGDECIMAL_ZERO
        limitPoolFactoryEntity.totalValueLockedUsd = BIGDECIMAL_ZERO
        limitPoolFactoryEntity.totalValueLockedEth = BIGDECIMAL_ZERO

        exists = false
    }

    return {
        entity: limitPoolFactoryEntity,
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
        managerEntity.owner = Bytes.fromHexString(ZERO_ADDRESS)
        managerEntity.feeTo = Bytes.fromHexString(ZERO_ADDRESS)
        managerEntity.factory = FACTORY_ADDRESS
        managerEntity.feeTiers = new Array<string>()
        managerEntity.poolTypes = new Array<string>()

        exists = false
    }

    return {
        entity: managerEntity,
        exists: exists,
    }
}

class LoadBasePriceRet {
    entity: BasePrice
    exists: boolean
}
export function safeLoadBasePrice(name: string, stablePool: LimitPool | null = null): LoadBasePriceRet {
    let exists = true

    let basePriceEntity = BasePrice.load(name)

    if (!basePriceEntity) {
        basePriceEntity = new BasePrice(name)
        exists = false
    }

    if (stablePool !== null) {
        log.info("pool data: {}", [stablePool.id])
        // only non-null when updating v3 pool price
        basePriceEntity.USD = getEthPriceInUSD(stablePool)
    } else {
        log.info("pool data is null", [])
    }

    return {
        entity: basePriceEntity,
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
        feeTierEntity.feeAmount = BIGINT_ZERO
        feeTierEntity.tickSpacing = BIGINT_ZERO

        feeTierEntity.createdAtBlockNumber = BIGINT_ZERO
        feeTierEntity.createdAtTimestamp = BIGINT_ZERO

        exists = false
    }

    return {
        entity: feeTierEntity,
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

        tokenEntity.ethPrice = BIGDECIMAL_ZERO
        tokenEntity.usdPrice = BIGDECIMAL_ZERO

        tokenEntity.pools = new Array<string>()
        
        tokenEntity.volume = BIGDECIMAL_ZERO
        tokenEntity.volumeUsd = BIGDECIMAL_ZERO
        tokenEntity.volumeEth = BIGDECIMAL_ZERO
        tokenEntity.txnCount = BIGINT_ZERO

        tokenEntity.feesUsdTotal = BIGDECIMAL_ZERO
        tokenEntity.feesEthTotal = BIGDECIMAL_ZERO

        tokenEntity.totalValueLocked = BIGDECIMAL_ZERO
        tokenEntity.totalValueLockedEth = BIGDECIMAL_ZERO
        tokenEntity.totalValueLockedUsd = BIGDECIMAL_ZERO

        tokenEntity.whitelistPools = new Array<string>()

        exists = false
    }

    return {
        entity: tokenEntity,
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

        limitPoolEntity.token0 = 'token0'
        limitPoolEntity.token1 = 'token1'

        limitPoolEntity.feeTier = 'default'
        limitPoolEntity.swapFee = BIGINT_ZERO
        limitPoolEntity.tickSpacing = BIGINT_ZERO
        limitPoolEntity.factory = ZERO_ADDRESS
        limitPoolEntity.poolType = 'default'
        limitPoolEntity.poolToken = Bytes.fromHexString(ZERO_ADDRESS)

        limitPoolEntity.liquidity = BIGINT_ZERO
        limitPoolEntity.liquidityGlobal = BIGINT_ZERO
        limitPoolEntity.positionIdNext = BIGINT_ONE
        limitPoolEntity.epoch = BIGINT_ONE
        limitPoolEntity.poolPrice = BIGINT_ZERO
        limitPoolEntity.pool0Price = BIGINT_ZERO
        limitPoolEntity.pool1Price = BIGINT_ZERO
        limitPoolEntity.poolLiquidity = BIGINT_ZERO
        limitPoolEntity.pool0Liquidity = BIGINT_ZERO
        limitPoolEntity.pool1Liquidity = BIGINT_ZERO
        limitPoolEntity.tickAtPrice = BIGINT_ZERO

        limitPoolEntity.feeGrowthGlobal0 = BIGINT_ZERO
        limitPoolEntity.feeGrowthGlobal1 = BIGINT_ZERO

        limitPoolEntity.samplesLength = BigInt.fromString('5')

        limitPoolEntity.price0 = BIGDECIMAL_ZERO
        limitPoolEntity.price1 = BIGDECIMAL_ZERO

        limitPoolEntity.volumeToken0 = BIGDECIMAL_ZERO
        limitPoolEntity.volumeToken1 = BIGDECIMAL_ZERO
        limitPoolEntity.volumeEth = BIGDECIMAL_ZERO
        limitPoolEntity.volumeUsd = BIGDECIMAL_ZERO
        limitPoolEntity.feesUsd = BIGDECIMAL_ZERO
        limitPoolEntity.feesEth = BIGDECIMAL_ZERO
        limitPoolEntity.txnCount = BIGINT_ZERO

        limitPoolEntity.totalValueLocked0 = BIGDECIMAL_ZERO
        limitPoolEntity.totalValueLocked1 = BIGDECIMAL_ZERO
        limitPoolEntity.totalValueLockedUsd = BIGDECIMAL_ZERO
        limitPoolEntity.totalValueLockedEth = BIGDECIMAL_ZERO

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

        limitPoolTokenEntity.pool = 'default'

        exists = false
    }

    return {
        entity: limitPoolTokenEntity,
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

        positionEntity.positionId = BIGINT_ZERO
        positionEntity.owner = Bytes.fromHexString(ZERO_ADDRESS)
        positionEntity.lower = BIGINT_ZERO
        positionEntity.upper = BIGINT_ZERO
        positionEntity.zeroForOne = true
        positionEntity.liquidity = BIGINT_ZERO
        positionEntity.pool = 'default'
        positionEntity.epochLast = BIGINT_ZERO
        positionEntity.claimPriceLast = BIGINT_ZERO
        positionEntity.amountIn = BIGINT_ZERO
        positionEntity.amountFilled = BIGINT_ZERO
        positionEntity.tokenIn = 'tokenIn'
        positionEntity.tokenOut = 'tokenOut'

        positionEntity.txnHash = Bytes.fromHexString(ZERO_ADDRESS)
        positionEntity.createdBy = Bytes.fromHexString(ZERO_ADDRESS)
        positionEntity.createdAtTimestamp = BIGINT_ZERO

        exists = false
    }

    return {
        entity: positionEntity,
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

        positionEntity.positionId = BIGINT_ZERO
        positionEntity.owner = Bytes.fromHexString(ZERO_ADDRESS)
        positionEntity.lower = BIGINT_ZERO
        positionEntity.upper = BIGINT_ZERO
        positionEntity.liquidity = BIGINT_ZERO
        positionEntity.pool = 'default'
        positionEntity.staked = false

        positionEntity.createdAtTimestamp = BIGINT_ZERO
        positionEntity.createdAtBlockNumber = BIGINT_ZERO
        positionEntity.updatedAtTimestamp = BIGINT_ZERO
        positionEntity.updatedAtBlockNumber = BIGINT_ZERO

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

        positionEntity.positionId = BIGINT_ZERO
        positionEntity.owner = Bytes.fromHexString(ZERO_ADDRESS)
        positionEntity.lower = BIGINT_ZERO
        positionEntity.upper = BIGINT_ZERO
        positionEntity.liquidity = BIGINT_ZERO
        positionEntity.pool = 'default'
        positionEntity.staked = false

        positionEntity.createdAtTimestamp = BIGINT_ZERO
        positionEntity.createdAtBlockNumber = BIGINT_ZERO
        positionEntity.updatedAtTimestamp = BIGINT_ZERO
        positionEntity.updatedAtBlockNumber = BIGINT_ZERO

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

        swapEntity.transaction = 'default'
        swapEntity.recipient = Bytes.fromHexString(ZERO_ADDRESS)
        swapEntity.timestamp = BIGINT_ZERO
        swapEntity.pool = pool.id
        swapEntity.zeroForOne = true
        swapEntity.amount0 = BIGDECIMAL_ZERO
        swapEntity.amount1 = BIGDECIMAL_ZERO
        swapEntity.amountUsd = BIGDECIMAL_ZERO
        swapEntity.priceAfter = BIGINT_ZERO
        swapEntity.tickAfter = BIGINT_ZERO
        swapEntity.txnIndex = BIGINT_ZERO

        exists = false
    }

    return {
        entity: swapEntity,
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
        transactionEntity.swaps = new Array<string>()

        exists = false
    }

    return {
        entity: transactionEntity,
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

        tickEntity.liquidityDelta = BIGINT_ZERO
        tickEntity.liquidityAbsolute = BIGINT_ZERO

        tickEntity.feeGrowthOutside0 = BIGINT_ZERO
        tickEntity.feeGrowthOutside1 = BIGINT_ZERO

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
        tickEntity.active = true
        tickEntity.price0 = bigDecimalExponated(BigDecimal.fromString('1.0001'), BigInt.fromI32(tickEntity.index.toI32()))
        tickEntity.price1 = safeDiv(ONE_BD, tickEntity.price0)

        tickEntity.liquidityDelta = BIGINT_ZERO
        tickEntity.liquidityAbsolute = BIGINT_ZERO

        tickEntity.epochLast0 = BIGINT_ZERO
        tickEntity.epochLast1 = BIGINT_ZERO

        exists = false
    }

    return {
        entity: tickEntity,
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

        poolRouterEntity.limitPoolFactory = Bytes.fromHexString(ZERO_ADDRESS)
        poolRouterEntity.coverPoolFactory = Bytes.fromHexString(ZERO_ADDRESS)

        exists = false
    }

    return {
        entity: poolRouterEntity,
        exists: exists,
    }
}

class LoadVFinPositionRet {
    entity: VFinPosition
    exists: boolean
}
export function safeLoadVFinPosition(vFinAddress: string, positionId: BigInt): LoadVFinPositionRet {
    let exists = true

    let vFinPositionId = vFinAddress.concat(positionId.toString())

    let vFinPositionEntity = VFinPosition.load(vFinPositionId)

    if (!vFinPositionEntity) {
        vFinPositionEntity = new VFinPosition(vFinPositionId)

        vFinPositionEntity.owner = Bytes.fromHexString(ZERO_ADDRESS)
        vFinPositionEntity.positionId = BIGINT_ZERO
        vFinPositionEntity.vFinAddress = Bytes.fromHexString(ZERO_ADDRESS)

        exists = false
    }

    return {
        entity: vFinPositionEntity,
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

        tvlUpdateLogEntity.pool = ZERO_ADDRESS
        tvlUpdateLogEntity.eventName = "default"
        tvlUpdateLogEntity.txnHash = Bytes.fromHexString(ZERO_ADDRESS)
        tvlUpdateLogEntity.txnBlockNumber = BIGINT_ZERO
        tvlUpdateLogEntity.amount0Change = BIGDECIMAL_ZERO
        tvlUpdateLogEntity.amount1Change = BIGDECIMAL_ZERO
        tvlUpdateLogEntity.amount0Total = BIGDECIMAL_ZERO
        tvlUpdateLogEntity.amount1Total = BIGDECIMAL_ZERO
        tvlUpdateLogEntity.token0UsdPrice = BIGDECIMAL_ZERO
        tvlUpdateLogEntity.token1UsdPrice = BIGDECIMAL_ZERO
        tvlUpdateLogEntity.amountUsdChange = BIGDECIMAL_ZERO
        tvlUpdateLogEntity.amountUsdTotal = BIGDECIMAL_ZERO

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
        
        mintRangeLogEntity.sender = Bytes.fromHexString(ZERO_ADDRESS)
        mintRangeLogEntity.recipient = Bytes.fromHexString(ZERO_ADDRESS)
        mintRangeLogEntity.lower = BIGINT_ZERO
        mintRangeLogEntity.upper = BIGINT_ZERO
        mintRangeLogEntity.positionId = BIGINT_ZERO
        mintRangeLogEntity.liquidityMinted = BIGINT_ZERO
        mintRangeLogEntity.pool = ZERO_ADDRESS

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

        burnRangeLogEntity.owner = Bytes.fromHexString(ZERO_ADDRESS)
        burnRangeLogEntity.recipient = Bytes.fromHexString(ZERO_ADDRESS)
        burnRangeLogEntity.lower = BIGINT_ZERO
        burnRangeLogEntity.upper = BIGINT_ZERO
        burnRangeLogEntity.positionId = BIGINT_ZERO
        burnRangeLogEntity.liquidityBurned = BIGINT_ZERO
        burnRangeLogEntity.pool = ZERO_ADDRESS

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

        compoundLogEntity.sender = Bytes.fromHexString(ZERO_ADDRESS)
        compoundLogEntity.pool = ZERO_ADDRESS
        compoundLogEntity.liquidityCompounded = BIGINT_ZERO
        compoundLogEntity.positionId = BIGINT_ZERO

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

        historicalOrderEntity.owner = Bytes.fromHexString(ZERO_ADDRESS)

        historicalOrderEntity.pool = 'default'
        historicalOrderEntity.tokenIn = tokenInAddress
        historicalOrderEntity.tokenOut = tokenOutAddress
        historicalOrderEntity.txnHash = Bytes.fromHexString(ZERO_ADDRESS)

        historicalOrderEntity.amountIn = BIGDECIMAL_ZERO
        historicalOrderEntity.amountOut = BIGDECIMAL_ZERO
        historicalOrderEntity.averagePrice = BIGDECIMAL_ZERO
        historicalOrderEntity.completedAtTimestamp = BIGINT_ZERO

        historicalOrderEntity.usdValue = BIGDECIMAL_ZERO

        historicalOrderEntity.positionId = BIGINT_ZERO
        historicalOrderEntity.touches = BIGINT_ZERO

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

        totalSeasonRewardEntity.whitelistedFeesUsd = BIGDECIMAL_ZERO
        totalSeasonRewardEntity.nonWhitelistedFeesUsd = BIGDECIMAL_ZERO
        totalSeasonRewardEntity.volumeTradedUsd = BIGDECIMAL_ZERO
        totalSeasonRewardEntity.stakingPoints = BIGINT_ZERO

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

        userSeasonRewardEntity.whitelistedFeesUsd = BIGDECIMAL_ZERO
        userSeasonRewardEntity.nonWhitelistedFeesUsd = BIGDECIMAL_ZERO
        userSeasonRewardEntity.volumeTradedUsd = BIGDECIMAL_ZERO
        userSeasonRewardEntity.stakingPoints = BIGINT_ZERO

        exists = false
    }

    return {
        entity: userSeasonRewardEntity,
        exists: exists,
    }
}