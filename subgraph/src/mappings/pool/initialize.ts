import { BigInt, log } from "@graphprotocol/graph-ts"
import { Initialize, InitializeLimit } from "../../../generated/LimitPoolFactory/LimitPool"
import { safeLoadBasePrice, safeLoadLimitPool, safeLoadLimitTick, safeLoadRangeTick, safeLoadToken } from "../utils/loads"
import { sqrtPriceX96ToTokenPrices, findEthPerToken } from "../utils/price"

export function handleInitialize(event: InitializeLimit): void {
    // EVENT PARAMS
    let minTickParam = event.params.minTick
    let maxTickParam = event.params.maxTick
    let startPriceParam = event.params.startPrice
    let startTickParam = event.params.startTick
    let poolAddress = event.address.toHex()

    let min = BigInt.fromI32(minTickParam)
    let max = BigInt.fromI32(maxTickParam)

    // LOAD ENTITIES
    let loadLimitPool = safeLoadLimitPool(poolAddress)

    let pool = loadLimitPool.entity

    let loadToken0 = safeLoadToken(pool.token0)
    let loadToken1 = safeLoadToken(pool.token1)
    // let loadMinRangeTick = safeLoadRangeTick(poolAddress, min)
    // let loadMaxRangeTick = safeLoadRangeTick(poolAddress, max)
    let loadMinLimitTick = safeLoadLimitTick(poolAddress, min)
    let loadMaxLimitTick = safeLoadLimitTick(poolAddress, max)

    let token0 = loadToken0.entity
    let token1 = loadToken1.entity
    // let minRangeTick = loadMinRangeTick.entity
    // let maxRangeTick = loadMaxRangeTick.entity
    let minLimitTick = loadMinLimitTick.entity
    let maxLimitTick = loadMaxLimitTick.entity

    pool.poolPrice = startPriceParam
    pool.pool0Price = startPriceParam
    pool.pool1Price = startPriceParam
    pool.tickAtPrice = BigInt.fromI32(startTickParam)

    let prices = sqrtPriceX96ToTokenPrices(pool.poolPrice, token0, token1)
    pool.price0 = prices[0]
    pool.price1 = prices[1]
    pool.save()

    let loadBasePrice = safeLoadBasePrice('eth')
    let basePrice = loadBasePrice.entity

    // price updates
    token0.ethPrice = findEthPerToken(token0, token1, pool, basePrice)
    token1.ethPrice = findEthPerToken(token1, token0, pool, basePrice)
    token0.usdPrice = token0.ethPrice.times(basePrice.USD)
    token1.usdPrice = token1.ethPrice.times(basePrice.USD)

    pool.save()
    token0.save()
    token1.save()
    basePrice.save()
    // minRangeTick.save()
    // maxRangeTick.save()
    minLimitTick.save()
    maxLimitTick.save()
}