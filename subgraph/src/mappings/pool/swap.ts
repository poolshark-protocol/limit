import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import { safeLoadBasePrice, safeLoadHistoricalOrder, safeLoadLimitPool, safeLoadLimitPoolFactory, safeLoadSwap, safeLoadToken, safeLoadTotalSeasonReward, safeLoadTransaction, safeLoadTvlUpdateLog, safeLoadUserSeasonReward } from "../utils/loads"
import { BIGDECIMAL_ZERO, BIGINT_ONE, BIGINT_ZERO, convertTokenToDecimal } from "../utils/helpers"
import { ZERO_BD, TWO_BD, ONE_BI, FACTORY_ADDRESS } from "../../constants/constants"
import { AmountType, findEthPerToken, getAdjustedAmounts, getEthPriceInUSD, sqrtPriceX96ToTokenPrices } from "../utils/price"
import { updateDerivedTVLAmounts } from "../utils/tvl"
import { Swap, SwapLimit } from "../../../generated/LimitPoolFactory/LimitPool"
import { safeDiv } from "../utils/math"
import { updatePoolHourData } from "../utils/candles"

export function handleSwap(event: SwapLimit): void {
    let recipientParam = event.params.recipient
    let amountInParam = event.params.amountIn
    let amountOutParam = event.params.amountOut
    let feeGrowthGlobal0Param = event.params.feeGrowthGlobal0
    let feeGrowthGlobal1Param = event.params.feeGrowthGlobal1
    let priceParam = event.params.price
    let liquidityParam = event.params.liquidity
    let feeAmountParam = event.params.feeAmount
    let tickAtPriceParam = event.params.tickAtPrice
    let zeroForOneParam = event.params.zeroForOne
    let exactInParam = event.params.exactIn
    let poolAddress = event.address.toHex()
    let msgSender = event.transaction.from

    let loadLimitPool = safeLoadLimitPool(poolAddress) // 2
    let pool = loadLimitPool.entity

    let loadLimitPoolFactory = safeLoadLimitPoolFactory(pool.factory) // 3
    let loadToken0 = safeLoadToken(pool.token0) // 4
    let loadToken1 = safeLoadToken(pool.token1) // 5
    
    
    let factory = loadLimitPoolFactory.entity
    let token0 = loadToken0.entity
    let token1 = loadToken1.entity


    let amount0: BigDecimal; let amount1: BigDecimal;
    if (zeroForOneParam) {
        amount0 = convertTokenToDecimal(amountInParam, token0.decimals)
        amount1 = convertTokenToDecimal(amountOutParam.neg(), token1.decimals)
    } else {
        amount1 = convertTokenToDecimal(amountInParam, token1.decimals)
        amount0 = convertTokenToDecimal(amountOutParam.neg(), token0.decimals)
    }

    pool.liquidity = liquidityParam
    pool.tickAtPrice = BigInt.fromI32(tickAtPriceParam)
    pool.poolPrice = priceParam
    pool.feeGrowthGlobal0 = feeGrowthGlobal0Param
    pool.feeGrowthGlobal1 = feeGrowthGlobal1Param

    let prices = sqrtPriceX96ToTokenPrices(pool.poolPrice, token0, token1)
    pool.price0 = prices[0]
    pool.price1 = prices[1]
    pool.save()

    let loadBasePrice = safeLoadBasePrice('eth') // 1
    let basePrice = loadBasePrice.entity

    // price updates
    token0.ethPrice = findEthPerToken(token0, token1, pool, basePrice)
    token1.ethPrice = findEthPerToken(token1, token0, pool, basePrice)
    token0.usdPrice = token0.ethPrice.times(basePrice.USD)
    token1.usdPrice = token1.ethPrice.times(basePrice.USD)

    let oldPoolTVLEth = pool.totalValueLockedEth
    pool.totalValueLocked0 = pool.totalValueLocked0.plus(amount0)
    pool.totalValueLocked1 = pool.totalValueLocked1.plus(amount1)
    token0.totalValueLocked = token0.totalValueLocked.plus(amount0)
    token1.totalValueLocked = token1.totalValueLocked.plus(amount1)
    let updateTvlRet = updateDerivedTVLAmounts(token0, token1, pool, factory, basePrice, oldPoolTVLEth)
    token0 = updateTvlRet.token0
    token1 = updateTvlRet.token1
    pool = updateTvlRet.pool
    factory = updateTvlRet.factory

    // update volume and fees
    let amount0Abs = amount0.times(BigDecimal.fromString(amount0.lt(ZERO_BD) ? '-1' : '1'))
    let amount1Abs = amount1.times(BigDecimal.fromString(amount1.lt(ZERO_BD) ? '-1' : '1'))
    let volumeAmounts: AmountType = getAdjustedAmounts(amount0Abs, token0, amount1Abs, token1, basePrice)
    let volumeEth = volumeAmounts.eth.div(TWO_BD)
    let volumeUsd = volumeAmounts.usd.div(TWO_BD)

    let feesEth: BigDecimal
    let feesUsd: BigDecimal
    if (zeroForOneParam == exactInParam) {
        let feeAmount =  convertTokenToDecimal(feeAmountParam, token1.decimals)
        feesEth = (feeAmount).times(token1.ethPrice)
        feesUsd = (feeAmount).times(token1.usdPrice)
    } else {
        let feeAmount =  convertTokenToDecimal(feeAmountParam, token0.decimals)
        feesEth = (feeAmount).times(token0.ethPrice)
        feesUsd = (feeAmount).times(token0.usdPrice)
    }

    factory.txnCount = factory.txnCount.plus(ONE_BI)
    pool.txnCount = pool.txnCount.plus(ONE_BI)
    token0.txnCount = token0.txnCount.plus(ONE_BI)
    token1.txnCount = token1.txnCount.plus(ONE_BI)

    factory.feesEthTotal = factory.feesEthTotal.plus(feesEth)
    factory.feesUsdTotal = factory.feesUsdTotal.plus(feesUsd)
    pool.feesUsd = pool.feesUsd.plus(feesUsd)
    pool.feesEth = pool.feesEth.plus(feesEth)
    token0.feesEthTotal = token0.feesEthTotal.plus(feesEth)
    token0.feesUsdTotal = token0.feesUsdTotal.plus(feesUsd)
    token1.feesEthTotal = token1.feesEthTotal.plus(feesEth)
    token1.feesUsdTotal = token1.feesUsdTotal.plus(feesUsd)

    factory.volumeEthTotal = factory.volumeEthTotal.plus(volumeEth)
    factory.volumeUsdTotal = factory.volumeUsdTotal.plus(volumeUsd)
    pool.volumeToken0 = pool.volumeToken0.plus(amount0Abs)
    pool.volumeToken1 = pool.volumeToken1.plus(amount1Abs)
    pool.volumeUsd = pool.volumeUsd.plus(volumeUsd)
    pool.volumeEth = pool.volumeEth.plus(volumeEth)
    token0.volume = token0.volume.plus(amount0Abs)
    token0.volumeUsd = token0.volumeUsd.plus(volumeUsd)
    token0.volumeEth = token0.volumeEth.plus(volumeEth)
    token1.volume = token1.volume.plus(amount1Abs)
    token1.volumeUsd = token1.volumeUsd.plus(volumeUsd)
    token1.volumeEth = token1.volumeEth.plus(volumeEth)

    // save each hour until we reach 24 hours
    pool = updatePoolHourData(pool, event.block.timestamp, volumeUsd, feesUsd)
    
    // update next index on rotation

    // then chop off oldest hour and start tracking new one

    // query from client side and add up all volume and fees

    let loadTvlUpdateLog = safeLoadTvlUpdateLog(event.transaction.hash, poolAddress)
    let tvlUpdateLog = loadTvlUpdateLog.entity

    tvlUpdateLog.pool = poolAddress
    tvlUpdateLog.eventName = "Swap"
    tvlUpdateLog.txnHash = event.transaction.hash
    tvlUpdateLog.txnBlockNumber = event.block.number
    tvlUpdateLog.amount0Change = amount0
    tvlUpdateLog.amount1Change = amount1
    tvlUpdateLog.amount0Total = pool.totalValueLocked0
    tvlUpdateLog.amount1Total = pool.totalValueLocked1
    tvlUpdateLog.token0UsdPrice = token0.usdPrice
    tvlUpdateLog.token1UsdPrice = token1.usdPrice
    tvlUpdateLog.amountUsdChange = amount0
    .times(token0.ethPrice.times(basePrice.USD))
    .plus(amount1.times(token1.ethPrice.times(basePrice.USD)))
    tvlUpdateLog.amountUsdTotal = pool.totalValueLockedUsd

    tvlUpdateLog.save()
    
    // update historical order data
    if ((zeroForOneParam ? amount0Abs : amount1Abs).gt(BIGDECIMAL_ZERO)) {
        let loadOrder = safeLoadHistoricalOrder(
            zeroForOneParam ? token0.id : token1.id,
            zeroForOneParam ? token1.id : token0.id,
            poolAddress,
            event.transaction.hash.toHex()) // 6
        let order = loadOrder.entity
        if (!loadOrder.exists) {
            order.pool = poolAddress
            order.owner = recipientParam
            order.txnHash = event.transaction.hash
            order.completedAtTimestamp = event.block.timestamp   
        }
        order.touches = order.touches.plus(BIGINT_ONE)
        order.amountIn = order.amountIn.plus(zeroForOneParam ? amount0Abs : amount1Abs)
        order.amountOut = order.amountOut.plus(zeroForOneParam ? amount1Abs : amount0Abs)
        order.averagePrice = safeDiv(order.amountOut, order.amountIn)
        if (zeroForOneParam) {
            const amount1Usd = amount1Abs.times(token1.usdPrice)
            order.usdValue = order.usdValue.plus(amount1Usd)
        } else {
            const amount0Usd = amount0Abs.times(token0.usdPrice)
            order.usdValue = order.usdValue.plus(amount0Usd)
        }
        order.save()
    }

    // update season 1 rewards
    // if (event.block.timestamp.ge(SEASON_1_START_TIME) && event.block.timestamp.le(SEASON_1_END_TIME)) {
    //     let loadTotalSeasonReward = safeLoadTotalSeasonReward(FACTORY_ADDRESS)
    //     let loadUserSeasonReward = safeLoadUserSeasonReward(event.transaction.from.toHex())

    //     let totalSeasonReward = loadTotalSeasonReward.entity
    //     let userSeasonReward = loadUserSeasonReward.entity

    //     if (zeroForOneParam) {
    //         const amount1Usd = amount1Abs.times(token1.usdPrice)
    //         userSeasonReward.volumeTradedUsd = userSeasonReward.volumeTradedUsd.plus(amount1Usd)
    //         totalSeasonReward.volumeTradedUsd = totalSeasonReward.volumeTradedUsd.plus(amount1Usd)
    //     } else {
    //         const amount0Usd = amount0Abs.times(token0.usdPrice)
    //         userSeasonReward.volumeTradedUsd = userSeasonReward.volumeTradedUsd.plus(amount0Usd)
    //         totalSeasonReward.volumeTradedUsd = totalSeasonReward.volumeTradedUsd.plus(amount0Usd)
    //     }
    //     totalSeasonReward.save()
    //     userSeasonReward.save()
    // }

    //TODO: add hour and daily data
    basePrice.save()
    pool.save()
    factory.save()
    token0.save()
    token1.save()
}