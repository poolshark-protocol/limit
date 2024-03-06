import { store, BigInt, log } from "@graphprotocol/graph-ts"
import { BurnLimit } from "../../../generated/LimitPoolFactory/LimitPool"
import { FACTORY_ADDRESS, ONE_BI } from "../../constants/constants"
import { BIGINT_ONE, BIGINT_ZERO, convertTokenToDecimal } from "../utils/helpers"
import { safeLoadBasePrice, safeLoadBurnLog, safeLoadHistoricalOrder, safeLoadLimitPool, safeLoadLimitPoolFactory, safeLoadLimitPosition, safeLoadLimitTick, safeLoadToken, safeLoadTotalSeasonReward, safeLoadTvlUpdateLog, safeLoadUserSeasonReward } from "../utils/loads"
import { findEthPerToken } from "../utils/price"
import { updateDerivedTVLAmounts } from "../utils/tvl"
import { safeDiv } from "../utils/math"

export function handleBurnLimit(event: BurnLimit): void {
    let msgSender = event.transaction.from.toHex()
    let positionIdParam = event.params.positionId
    let lowerParam = event.params.lower
    let oldClaimParam = event.params.oldClaim
    let newClaimParam = event.params.newClaim
    let upperParam = event.params.upper
    let zeroForOneParam = event.params.zeroForOne
    let liquidityBurnedParam = event.params.liquidityBurned
    let tokenInClaimedParam = event.params.tokenInClaimed
    let tokenOutBurnedParam = event.params.tokenOutBurned
    let poolAddress = event.address.toHex()
    let senderParam = event.transaction.from

    let lower = BigInt.fromI32(lowerParam)
    let newClaim = BigInt.fromI32(newClaimParam)
    let upper = BigInt.fromI32(upperParam)

    let loadBasePrice = safeLoadBasePrice('eth') // 1
    let loadLimitPool = safeLoadLimitPool(poolAddress) // 2

    let pool      = loadLimitPool.entity
    let basePrice = loadBasePrice.entity
    
    let loadLimitPoolFactory = safeLoadLimitPoolFactory(pool.factory) // 3
    let loadPosition = safeLoadLimitPosition(poolAddress, positionIdParam) // 4
    let loadLowerTick = safeLoadLimitTick(poolAddress, lower) // 5
    let loadUpperTick = safeLoadLimitTick(poolAddress, upper) // 6
    let loadTokenIn = safeLoadToken(zeroForOneParam ? pool.token1 : pool.token0) // 7
    let loadTokenOut = safeLoadToken(zeroForOneParam ? pool.token0 : pool.token1) // 8

    let factory = loadLimitPoolFactory.entity
    let position  = loadPosition.entity
    let lowerTick = loadLowerTick.entity
    let upperTick = loadUpperTick.entity
    let tokenIn = loadTokenIn.entity
    let tokenOut = loadTokenOut.entity

    // update txn counts
    pool.txnCount = pool.txnCount.plus(ONE_BI)
    tokenIn.txnCount = tokenIn.txnCount.plus(ONE_BI)
    tokenOut.txnCount = tokenOut.txnCount.plus(ONE_BI)
    factory.txnCount = factory.txnCount.plus(ONE_BI)

    let amountIn = convertTokenToDecimal(tokenInClaimedParam, tokenIn.decimals)
    let amountOut = convertTokenToDecimal(tokenOutBurnedParam, tokenOut.decimals)

    let loadOrder = safeLoadHistoricalOrder(tokenIn.id, tokenOut.id, poolAddress, position.positionId.toString()) // 9
    let order = loadOrder.entity

    if (!loadPosition.exists) {
        //throw an error
        return;
    }
    if (loadOrder.exists) {
        order.touches = order.touches.plus(BIGINT_ONE)
        order.usdValue = order.usdValue.plus(amountIn.times(tokenIn.usdPrice))
    }
    
    // increment position amounts
    position.amountFilled = position.amountFilled.plus(tokenInClaimedParam)
    position.amountIn = position.amountIn.minus(tokenOutBurnedParam)
   
    if (position.liquidity == liquidityBurnedParam || 
            (zeroForOneParam ? newClaim.equals(upper) : newClaim.equals(lower))) {
        if (!loadOrder.exists) {
            // throw an error
        } else {
            order.completedAtTimestamp = event.block.timestamp
            order.amountIn = order.amountIn.plus(convertTokenToDecimal(position.amountIn, tokenOut.decimals))
            order.amountOut = order.amountOut.plus(convertTokenToDecimal(position.amountFilled, tokenIn.decimals))
            order.averagePrice = safeDiv(order.amountOut, order.amountIn)
            order.completed = true
            order.save()    // 9
        }
        store.remove('LimitPosition', position.id)
    } else {
        position.liquidity = position.liquidity.minus(liquidityBurnedParam)
        // shrink position to new size
        if (zeroForOneParam) {
            position.lower = newClaim
        } else {
            position.upper = newClaim
        }
        position.save()
    }

    // update pool liquidity global
    if (newClaim.equals(zeroForOneParam ? upper : lower)) {
        pool.liquidityGlobal = pool.liquidityGlobal.minus(position.liquidity)
    } else {
        pool.liquidityGlobal = pool.liquidityGlobal.minus(liquidityBurnedParam)
    }

    // grab tick epochs
    let lowerTickEpoch = zeroForOneParam ? lowerTick.epochLast0 : lowerTick.epochLast1
    let upperTickEpoch = zeroForOneParam ? upperTick.epochLast0 : upperTick.epochLast1
 
    /// @note - we do not store liquidity delta on half ticks
    if (zeroForOneParam) {
        if (lowerTickEpoch.le(position.epochLast)) {
            // lower tick has not been crossed yet
            lowerTick.liquidityDelta = lowerTick.liquidityDelta.minus(liquidityBurnedParam)
            lowerTick.liquidityAbsolute = lowerTick.liquidityAbsolute.minus(liquidityBurnedParam)
        }
        if (upperTickEpoch.le(position.epochLast)) {
            // upper tick has not been crossed yet
            upperTick.liquidityDelta = upperTick.liquidityDelta.plus(liquidityBurnedParam)
            upperTick.liquidityAbsolute = upperTick.liquidityAbsolute.minus(liquidityBurnedParam) 
        }
    } else {
        if (lowerTickEpoch.le(position.epochLast)) {
            // lower tick has not been crossed yet
            lowerTick.liquidityDelta = lowerTick.liquidityDelta.plus(liquidityBurnedParam)
            lowerTick.liquidityAbsolute = lowerTick.liquidityAbsolute.minus(liquidityBurnedParam)
        }
        if (upperTickEpoch.le(position.epochLast)) {
            // upper tick has not been crossed yet
            upperTick.liquidityDelta = upperTick.liquidityDelta.minus(liquidityBurnedParam)
            upperTick.liquidityAbsolute = upperTick.liquidityAbsolute.minus(liquidityBurnedParam)
        }
    }
    if (lowerTick.liquidityAbsolute.equals(BIGINT_ZERO)) {
        lowerTick.active = false
    }
    if (upperTick.liquidityAbsolute.equals(BIGINT_ZERO)) {
        upperTick.active = false
    }
    lowerTick.save() // 1
    upperTick.save() // 2

    // tvl adjustments
    tokenIn.totalValueLocked = tokenIn.totalValueLocked.minus(amountIn)
    tokenOut.totalValueLocked = tokenOut.totalValueLocked.minus(amountOut)
    pool.totalValueLocked0 = pool.totalValueLocked0.minus(zeroForOneParam ? amountOut : amountIn)
    pool.totalValueLocked1 = pool.totalValueLocked1.minus(zeroForOneParam ? amountIn : amountOut)

    // eth price updates
    tokenIn.ethPrice = findEthPerToken(tokenIn, tokenOut, pool, basePrice)
    tokenOut.ethPrice = findEthPerToken(tokenOut, tokenIn, pool, basePrice)
    tokenIn.usdPrice = tokenIn.ethPrice.times(basePrice.USD)
    tokenOut.usdPrice = tokenOut.ethPrice.times(basePrice.USD)

    // tvl updates
    let oldPoolTotalValueLockedEth = pool.totalValueLockedEth
    let updateTvlRet = updateDerivedTVLAmounts(
        zeroForOneParam ? tokenOut : tokenIn,
        zeroForOneParam ? tokenIn : tokenOut,
        pool,
        factory,
        basePrice,
        oldPoolTotalValueLockedEth
    )
    if (zeroForOneParam) {
        tokenIn = updateTvlRet.token1
        tokenOut = updateTvlRet.token0
    } else {
        tokenIn = updateTvlRet.token0
        tokenOut = updateTvlRet.token1
    }
    pool = updateTvlRet.pool
    factory = updateTvlRet.factory

    if (newClaim < lower || newClaim > upper) { 
        let loadTvlUpdateLog = safeLoadTvlUpdateLog(event.transaction.hash, poolAddress)
        let tvlUpdateLog = loadTvlUpdateLog.entity

        tvlUpdateLog.pool = poolAddress
        tvlUpdateLog.eventName = "BurnLimit"
        tvlUpdateLog.txnHash = event.transaction.hash
        tvlUpdateLog.txnBlockNumber = event.block.number
        tvlUpdateLog.amount0Change = zeroForOneParam ? amountOut.neg() : amountIn.neg()
        tvlUpdateLog.amount1Change = zeroForOneParam ? amountIn.neg() : amountOut.neg()
        tvlUpdateLog.amount0Total = pool.totalValueLocked0
        tvlUpdateLog.amount1Total = pool.totalValueLocked1
        tvlUpdateLog.token0UsdPrice = zeroForOneParam ? tokenOut.usdPrice : tokenIn.usdPrice
        tvlUpdateLog.token1UsdPrice = zeroForOneParam ? tokenIn.usdPrice : tokenOut.usdPrice
        tvlUpdateLog.amountUsdChange = amountIn
        .times(tokenIn.ethPrice.times(basePrice.USD))
        .plus(amountOut.times(tokenOut.ethPrice.times(basePrice.USD))).neg()
        tvlUpdateLog.amountUsdTotal = pool.totalValueLockedUsd

        tvlUpdateLog.save()
    }
    // update season 1 rewards
    // if (event.block.timestamp.ge(SEASON_1_START_TIME) && event.block.timestamp.le(SEASON_1_END_TIME)) {
    //     // update season rewards if between start and end time
    //     let loadTotalSeasonReward = safeLoadTotalSeasonReward(FACTORY_ADDRESS) // 10
    //     let loadUserSeasonReward = safeLoadUserSeasonReward(event.transaction.from.toHex()) // 11
        
    //     let totalSeasonReward = loadTotalSeasonReward.entity
    //     let userSeasonReward = loadUserSeasonReward.entity

    //     totalSeasonReward.volumeTradedUsd = totalSeasonReward.volumeTradedUsd.plus(amountIn.times(tokenIn.usdPrice))
    //     userSeasonReward.volumeTradedUsd = userSeasonReward.volumeTradedUsd.plus(amountIn.times(tokenIn.usdPrice))

    //     totalSeasonReward.save() // 10
    //     userSeasonReward.save()  // 11
    // }

    basePrice.save() // 3
    pool.save() // 4
    factory.save() // 5
    tokenIn.save() // 7
    tokenOut.save() // 8

}