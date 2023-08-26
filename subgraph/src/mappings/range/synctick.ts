import { SyncRangeTick } from "../../../generated/LimitPoolFactory/LimitPool"
import { safeLoadRangeTick } from "../utils/loads"
import { BigInt } from "@graphprotocol/graph-ts"

export function handleSyncRangeTick(event: SyncRangeTick): void {
    let feeGrowthOutside0Param = event.params.feeGrowthOutside0
    let feeGrowthOutside1Param = event.params.feeGrowthOutside1
    let tickParam = event.params.tick
    let poolAddress = event.address.toHex()

    let loadTick = safeLoadRangeTick(poolAddress, BigInt.fromI32(tickParam))

    let tick = loadTick.entity
    
    tick.feeGrowthOutside0 = feeGrowthOutside0Param
    tick.feeGrowthOutside1 = feeGrowthOutside1Param

    tick.save()
}