import { BigInt } from "@graphprotocol/graph-ts"
import { Initialize } from "../../../generated/LimitPoolFactory/LimitPool"
import { safeLoadLimitPool, safeLoadLimitTick, safeLoadRangeTick } from "../utils/loads"

export function handleInitialize(event: Initialize): void {
    let minTickParam = event.params.minTick
    let maxTickParam = event.params.maxTick
    let startPriceParam = event.params.startPrice
    let startTickParam = event.params.startTick
    let poolAddress = event.address.toHex()

    let min = BigInt.fromI32(minTickParam)
    let max = BigInt.fromI32(maxTickParam)

    let loadLimitPool = safeLoadLimitPool(poolAddress)
    let loadMinRangeTick = safeLoadRangeTick(poolAddress, min)
    let loadMaxRangeTick = safeLoadRangeTick(poolAddress, max)
    let loadMinLimitTick = safeLoadLimitTick(poolAddress, min)
    let loadMaxLimitTick = safeLoadLimitTick(poolAddress, max)

    let pool = loadLimitPool.entity
    let minRangeTick = loadMinRangeTick.entity
    let maxRangeTick = loadMaxRangeTick.entity
    let minLimitTick = loadMinLimitTick.entity
    let maxLimitTick = loadMaxLimitTick.entity

    pool.poolPrice = startPriceParam
    pool.pool0Price = startPriceParam
    pool.pool1Price = startPriceParam
    pool.tickAtPrice = BigInt.fromI32(startTickParam)

    pool.save()
    minRangeTick.save()
    maxRangeTick.save()
    minLimitTick.save()
    maxLimitTick.save()
}