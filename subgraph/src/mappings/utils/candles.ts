import { LimitPool } from "../../../generated/schema";
import { BIGINT_ONE } from "./helpers";
import { safeLoadLimitPoolHourData } from "./loads";
import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"


export function updatePoolHourData(
    pool: LimitPool,
    blockTimestamp: BigInt,
    volumeUSD: BigDecimal,
    feesUSD: BigDecimal
): LimitPool {
    let loadCurrentHourData = safeLoadLimitPoolHourData(pool.id, blockTimestamp)

    let currentHourData = loadCurrentHourData.entity
    currentHourData.volumeUSD = currentHourData.volumeUSD.plus(volumeUSD)
    currentHourData.feesUSD = currentHourData.feesUSD.plus(feesUSD)

    if (!loadCurrentHourData.exists) {
        // load existing array
        let last24HoursPoolData = pool.last24HoursPoolData
        if (pool.last24HoursPoolData.length < 25) {
            // push onto array until 25 hour samples exist
            last24HoursPoolData.push(currentHourData.id)
        } else {
            // replace array items on rotating basis
            let nextIndex = BigInt.fromI64(pool.last24HoursNextIndex).toI32()
            last24HoursPoolData[nextIndex] = currentHourData.id
        }
        // update array
        pool.last24HoursPoolData = last24HoursPoolData

        // increment next index
        pool.last24HoursNextIndex = (pool.last24HoursNextIndex + 1) % 25
    }

    currentHourData.save()

    return pool
}