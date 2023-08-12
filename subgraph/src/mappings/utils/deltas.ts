import { BIGINT_ZERO } from "./helpers";
import { BigInt } from '@graphprotocol/graph-ts'

export function safeMinus(deltaMax: BigInt, change: BigInt) : BigInt {
    if (deltaMax < change) {
        return BIGINT_ZERO
    }
    return deltaMax.minus(change)
}