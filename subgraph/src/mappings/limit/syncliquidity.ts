import { SyncLimitLiquidity, SyncLimitPool } from "../../../generated/LimitPoolFactory/LimitPool"
import { safeLoadLimitPool, safeLoadLimitTick } from "../utils/loads"
import { BigInt } from "@graphprotocol/graph-ts"

export function handleSyncLimitLiquidity(event: SyncLimitLiquidity): void {
    let liquidityAddedParam = event.params.liquidityAdded
    let tickParam = event.params.tick
    let zeroForOneParam = event.params.zeroForOne
    let poolAddress = event.address.toHex()
    let msgSender = event.transaction.from

    let loadTick = safeLoadLimitTick(poolAddress, BigInt.fromI32(tickParam))

    let tick = loadTick.entity

    tick.liquidityDelta = tick.liquidityDelta.plus(liquidityAddedParam)
    tick.liquidityAbsolute = tick.liquidityAbsolute.plus(liquidityAddedParam)

    tick.save()
}