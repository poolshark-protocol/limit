import { SampleLengthIncreased, SyncRangeTick } from "../../../generated/LimitPoolFactory/LimitPool"
import { safeLoadLimitPool, safeLoadRangeTick } from "../utils/loads"
import { BigInt } from "@graphprotocol/graph-ts"

export function handleSampleLengthIncreased(event: SampleLengthIncreased): void {
    let newSamplesLength = event.params.sampleLengthNext
    let poolAddress = event.address.toHex()

    let loadPool = safeLoadLimitPool(poolAddress)

    let pool = loadPool.entity
    
    pool.samplesLength = BigInt.fromI32(newSamplesLength)

    pool.save()
}