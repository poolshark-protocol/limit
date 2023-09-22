import { Address, store } from "@graphprotocol/graph-ts"
import { safeLoadBasePrice, safeLoadBurnLog, safeLoadRangePositionById, safeLoadLimitPool, safeLoadLimitPoolFactory, safeLoadRangeTick, safeLoadToken, safeLoadRangePosition } from "../utils/loads"
import {
    BigInt,
} from '@graphprotocol/graph-ts'
import { ONE_BI } from "../../constants/constants"
import { updateDerivedTVLAmounts } from "../utils/tvl"
import { BIGINT_ZERO, convertTokenToDecimal } from "../utils/helpers"
import { findEthPerToken } from "../utils/price"
import { BurnRange } from "../../../generated/LimitPoolFactory/LimitPool"

export function handleBurnRange(event: BurnRange): void {
    let recipientParam = event.params.recipient
    let positionIdParam = event.params.positionId
    let liquidityBurnedParam = event.params.liquidityBurned
    let amount0Param = event.params.amount0
    let amount1Param = event.params.amount1
    let poolAddress = event.address.toHex()
    let msgSender = event.transaction.from

    let loadPosition = safeLoadRangePosition(
        poolAddress,
        positionIdParam
    )
    let position = loadPosition.entity

    let lower = position.lower
    let upper = position.upper

    // log burn action
    let loadBurnLog = safeLoadBurnLog(event.transaction.hash, poolAddress, positionIdParam)
    let burnLog = loadBurnLog.entity
    if (!loadBurnLog.exists) {
        burnLog.owner = msgSender
        burnLog.recipient = recipientParam
        burnLog.lower = lower
        burnLog.upper = upper
        burnLog.positionId = positionIdParam
        burnLog.pool = poolAddress
    }
    burnLog.liquidityBurned = burnLog.liquidityBurned.plus(liquidityBurnedParam)

    let loadBasePrice = safeLoadBasePrice('eth')
    let loadLimitPool = safeLoadLimitPool(poolAddress)
    let basePrice = loadBasePrice.entity
    let pool = loadLimitPool.entity

    let loadLimitPoolFactory = safeLoadLimitPoolFactory(pool.factory)
    let loadToken0 = safeLoadToken(pool.token0)
    let loadToken1 = safeLoadToken(pool.token1)
    let factory = loadLimitPoolFactory.entity
    let token0 = loadToken0.entity
    let token1 = loadToken1.entity

    let loadLowerTick = safeLoadRangeTick(
        poolAddress,
        lower
    )
    let loadUpperTick = safeLoadRangeTick(
        poolAddress,
        upper
    )
    let lowerTick = loadLowerTick.entity
    let upperTick = loadUpperTick.entity

    // convert amounts to decimal values
    let amount0 = convertTokenToDecimal(amount0Param, token0.decimals)
    let amount1 = convertTokenToDecimal(amount1Param, token1.decimals)
    let amountUsd = amount0
        .times(token0.ethPrice.times(basePrice.USD))
        .plus(amount1.times(token1.ethPrice.times(basePrice.USD)))

    if (liquidityBurnedParam.equals(position.liquidity)) {
        store.remove('RangePosition', position.id)
    } else {
        position.liquidity = position.liquidity.minus(liquidityBurnedParam)
        position.updatedAtBlockNumber = event.block.number
        position.updatedAtTimestamp = event.block.timestamp
        position.save()
    }

    if (lowerTick.liquidityAbsolute.equals(liquidityBurnedParam)) {
        store.remove('RangeTick', lowerTick.id)
    } else {
        lowerTick.liquidityDelta = lowerTick.liquidityDelta.minus(liquidityBurnedParam)
        lowerTick.liquidityAbsolute = lowerTick.liquidityAbsolute.minus(liquidityBurnedParam)
    }
    if (upperTick.liquidityAbsolute.equals(liquidityBurnedParam)) {
        store.remove('RangeTick', upperTick.id)
    } else {
        upperTick.liquidityDelta = upperTick.liquidityDelta.plus(liquidityBurnedParam)
        upperTick.liquidityAbsolute = upperTick.liquidityAbsolute.minus(liquidityBurnedParam)
    }

    token0.txnCount = token0.txnCount.plus(ONE_BI)
    token1.txnCount = token1.txnCount.plus(ONE_BI)
    pool.txnCount = pool.txnCount.plus(ONE_BI)
    factory.txnCount = factory.txnCount.plus(ONE_BI)

    // eth price updates
    token0.ethPrice = findEthPerToken(token0, token1, basePrice)
    token1.ethPrice = findEthPerToken(token1, token0, basePrice)
    token0.usdPrice = token0.ethPrice.times(basePrice.USD)
    token1.usdPrice = token1.ethPrice.times(basePrice.USD)

    // tvl updates
    let oldPoolTotalValueLockedEth = pool.totalValueLockedEth
    token0.totalValueLocked = token0.totalValueLocked.minus(amount0)
    token1.totalValueLocked = token1.totalValueLocked.minus(amount1)
    pool.totalValueLocked0 = pool.totalValueLocked0.minus(amount0)
    pool.totalValueLocked1 = pool.totalValueLocked1.minus(amount1)
    let updateTvlRet = updateDerivedTVLAmounts(token0, token1, pool, factory, oldPoolTotalValueLockedEth)
    token0 = updateTvlRet.token0
    token1 = updateTvlRet.token1
    pool = updateTvlRet.pool
    factory = updateTvlRet.factory

    if (
        pool.tickAtPrice !== null &&
        lower.le(pool.tickAtPrice) &&
        upper.gt(pool.tickAtPrice)
      ) {
        pool.liquidity = pool.liquidity.minus(liquidityBurnedParam)
        pool.poolLiquidity = pool.poolLiquidity.minus(liquidityBurnedParam)
    }

    burnLog.save()
    basePrice.save()
    pool.save()
    factory.save()
    token0.save()
    token1.save()
    lowerTick.save()
    upperTick.save()
}