import { RouterDeployed } from "../../generated/PoolsharkRouter/PoolsharkRouter";
import { Transfer } from "../../generated/vFIN/vFIN";
import { safeLoadPoolRouter, safeLoadVFinPosition } from "./utils/loads";

export function handleTransfer(event: Transfer): void {
    let fromParam = event.params.from
    let toParam = event.params.to
    let idParam = event.params.id
    let vFinAddress = event.address

    let loadVFinPosition = safeLoadVFinPosition(vFinAddress.toHex(), idParam)

    let vFinPosition = loadVFinPosition.entity

    if (!loadVFinPosition.exists) {
        vFinPosition.vFinAddress = vFinAddress
        vFinPosition.positionId = idParam
    }
    vFinPosition.owner = toParam

    vFinPosition.save()
}