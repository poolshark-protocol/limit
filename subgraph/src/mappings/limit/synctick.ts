import { SyncLimitTick } from "../../../generated/LimitPoolFactory/LimitPool"
import { BIGINT_ZERO } from "../utils/helpers"
import { safeLoadLimitTick } from "../utils/loads"
import { BigInt } from "@graphprotocol/graph-ts"

export function handleSyncLimitTick(event: SyncLimitTick): void {
    let epochParam = event.params.epoch
    let tickParam = event.params.tick
    let zeroForOneParam = event.params.zeroForOne
    let poolAddress = event.address.toHex()

    let loadTick = safeLoadLimitTick(poolAddress, BigInt.fromI32(tickParam))

    let tick = loadTick.entity
    
    if (zeroForOneParam) {
        tick.epochLast0 = epochParam
    } else {
        tick.epochLast1 = epochParam
    }
    tick.active = false
    tick.liquidityDelta = BIGINT_ZERO
    tick.liquidityAbsolute = BIGINT_ZERO

    tick.save()
}