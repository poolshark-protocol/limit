import { SampleCountIncreased, SyncRangeTick } from "../../../generated/LimitPoolFactory/LimitPool"
import { safeLoadLimitPool, safeLoadRangeTick } from "../utils/loads"
import { BigInt } from "@graphprotocol/graph-ts"

export function handleSampleCountIncreased(event: SampleCountIncreased): void {
    let newSamplesLength = event.params.newSampleCountMax
    let poolAddress = event.address.toHex()

    let loadPool = safeLoadLimitPool(poolAddress)

    let pool = loadPool.entity
    
    pool.samplesLength = BigInt.fromI32(newSamplesLength)

    pool.save()
}