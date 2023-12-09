import { RouterDeployed } from "../../generated/PoolsharkRouter/PoolsharkRouter";
import { TransferBatch, TransferSingle } from "../../generated/templates/PositionERC1155Template/PositionERC1155";
import { RANGE_STAKER_ADDRESS } from "../constants/arbitrum";
import { safeLoadLimitPoolToken, safeLoadLimitPosition, safeLoadPoolRouter, safeLoadRangePosition } from "./utils/loads";

export function handleTransferSingle(event: TransferSingle): void {
    let idParam = event.params.id
    let fromParam = event.params.from
    let toParam = event.params.to

    let loadPoolToken = safeLoadLimitPoolToken(event.address.toHex())
    let poolToken = loadPoolToken.entity

    let loadRangePosition = safeLoadRangePosition(poolToken.pool, idParam)
    let loadLimitPosition = safeLoadLimitPosition(poolToken.pool, idParam)

    if (loadRangePosition.exists) {
        let rangePosition = loadRangePosition.entity
        if (rangePosition.owner.toHex() != toParam.toHex() && toParam.toHex() != RANGE_STAKER_ADDRESS.toLowerCase()) {
            rangePosition.owner = toParam
            rangePosition.save()
        }
    } else if (loadLimitPosition.exists) {
        let limitPosition = loadLimitPosition.entity
        if (limitPosition.owner.toHex() != toParam.toHex() && toParam.toHex() != RANGE_STAKER_ADDRESS.toLowerCase()) {
            limitPosition.owner = toParam
            limitPosition.save()
        }
    }
}

export function handleTransferBatch(event: TransferBatch): void {
}