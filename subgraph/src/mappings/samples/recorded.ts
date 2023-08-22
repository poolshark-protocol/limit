import { SampleLengthIncreased, SampleRecorded, SyncRangeTick } from "../../../generated/LimitPoolFactory/LimitPool"
import { safeLoadLimitPool, safeLoadRangeTick } from "../utils/loads"
import { BigInt } from "@graphprotocol/graph-ts"

export function handleSampleRecorded(event: SampleRecorded): void {
}