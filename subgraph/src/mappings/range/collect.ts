import { safeLoadLimitPool, safeLoadLimitPoolFactory, safeLoadToken, safeLoadBasePrice, safeLoadTvlUpdateLog } from "../utils/loads"
import { BIGINT_ZERO, convertTokenToDecimal } from "../utils/helpers"
import { findEthPerToken } from "../utils/price"
import { updateDerivedTVLAmounts } from "../utils/tvl"
import { Collect } from "../../../generated/LimitPoolFactory/LimitPool"

export function handleCollect(event: Collect): void {
    let amount0Param = event.params.amount0
    let amount1Param = BIGINT_ZERO
    let poolAddress = event.address.toHex()
    let senderParam = event.transaction.from

    let loadLimitPool = safeLoadLimitPool(poolAddress)
    let pool = loadLimitPool.entity // 1

    let loadLimitPoolFactory = safeLoadLimitPoolFactory(pool.factory)
    let loadToken0 = safeLoadToken(pool.token0)
    let loadToken1 = safeLoadToken(pool.token1)
    let loadBasePrice = safeLoadBasePrice('eth')

    let factory = loadLimitPoolFactory.entity // 2
    let token0 = loadToken0.entity // 3
    let token1 = loadToken1.entity // 4
    let basePrice = loadBasePrice.entity // 5

    let amount0 = convertTokenToDecimal(amount0Param, token0.decimals)
    let amount1 = convertTokenToDecimal(amount1Param, token1.decimals)
    let amountUsd = amount0
        .times(token0.ethPrice.times(basePrice.USD))
        .plus(amount1.times(token1.ethPrice.times(basePrice.USD)))

    // eth price updates
    token0.ethPrice = findEthPerToken(token0, token1, pool, basePrice)
    token1.ethPrice = findEthPerToken(token1, token0, pool, basePrice)
    token0.usdPrice = token0.ethPrice.times(basePrice.USD)
    token1.usdPrice = token1.ethPrice.times(basePrice.USD)

    // tvl updates
    let oldPoolTotalValueLockedEth = pool.totalValueLockedEth
    token0.totalValueLocked = token0.totalValueLocked.minus(amount0)
    token1.totalValueLocked = token1.totalValueLocked.minus(amount1)
    pool.totalValueLocked0 = pool.totalValueLocked0.minus(amount0)
    pool.totalValueLocked1 = pool.totalValueLocked1.minus(amount1)
    let updateTvlRet = updateDerivedTVLAmounts(token0, token1, pool, factory, basePrice, oldPoolTotalValueLockedEth)
    token0 = updateTvlRet.token0
    token1 = updateTvlRet.token1
    pool = updateTvlRet.pool
    factory = updateTvlRet.factory

    if (pool.id == '0x55da7d4ae164a4eba4ce5e31e4460177c2ca4c81') {
        let loadTvlUpdateLog = safeLoadTvlUpdateLog(event.transaction.hash, poolAddress)
        let tvlUpdateLog = loadTvlUpdateLog.entity

        tvlUpdateLog.pool = poolAddress
        tvlUpdateLog.eventName = "CollectRange"
        tvlUpdateLog.txnHash = event.transaction.hash
        tvlUpdateLog.txnBlockNumber = event.block.number
        tvlUpdateLog.amount0Change = amount0.neg()
        tvlUpdateLog.amount1Change = amount1.neg()
        tvlUpdateLog.amount0Total = pool.totalValueLocked0
        tvlUpdateLog.amount1Total = pool.totalValueLocked1
        tvlUpdateLog.token0UsdPrice = token0.usdPrice
        tvlUpdateLog.token1UsdPrice = token1.usdPrice
        tvlUpdateLog.amountUsdChange = amount0
        .times(token0.ethPrice.times(basePrice.USD))
        .plus(amount1.times(token1.ethPrice.times(basePrice.USD))).neg()
        tvlUpdateLog.amountUsdTotal = pool.totalValueLockedUsd

        tvlUpdateLog.save()
    }

    pool.save()         // 1
    token0.save()       // 2
    token1.save()       // 3
    factory.save()      // 4
    basePrice.save()    // 5
}