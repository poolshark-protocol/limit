import { SyncLimitPool } from "../../../generated/LimitPoolFactory/LimitPool"
import { safeLoadLimitPool, safeLoadLimitTick } from "../utils/loads"
import { BigInt } from "@graphprotocol/graph-ts"

export function handleSyncLimitPool(event: SyncLimitPool): void {
    let priceParam = event.params.price
    let liquidityParam = event.params.liquidity
    let epochLastParam = event.params.epoch
    let tickAtPriceParam = event.params.tickAtPrice
    let isPool0Param = event.params.isPool0
    let poolAddress = event.address.toHex()
    let msgSender = event.transaction.from

    let loadLimitPool = safeLoadLimitPool(poolAddress)
    let loadTick = safeLoadLimitTick(poolAddress, BigInt.fromI32(tickAtPriceParam))

    let tick = loadTick.entity
    let pool      = loadLimitPool.entity

    // increase tvl count
    if (isPool0Param) {
        tick.epochLast0 = epochLastParam
        pool.pool0Price = priceParam
        pool.pool0Liquidity = liquidityParam
    } else {
        tick.epochLast1 = epochLastParam
        pool.pool1Price = priceParam
        pool.pool1Liquidity = liquidityParam
    }
    pool.save()
    tick.save()
}