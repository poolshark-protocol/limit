import { safeLoadRangePosition } from '../utils/loads'
import { FeeToTransfer, OwnerTransfer, StakeRange, StakeRangeAccrued, StakeRangeBurn, UnstakeRange } from '../../../generated/RangeStaker/RangeStaker'

export function handleFeeToTransfer(event: FeeToTransfer): void {

}

export function handleOwnerTransfer(event: OwnerTransfer): void {
    
}

export function handleStakeRange(event: StakeRange): void {
    let recipientParam = event.params.recipient
    let poolAddressParam = event.params.pool.toHex()
    let positionIdParam = event.params.positionId

    let loadPosition = safeLoadRangePosition(
        poolAddressParam,
        positionIdParam
    )
    let position = loadPosition.entity

    position.owner = recipientParam
    position.staked = true

    position.save()
}

export function handleStakeRangeAccrued(event: StakeRangeAccrued): void {
    
}

export function handleStakeRangeBurn(event: StakeRangeBurn): void {

}

export function handleUnstakeRange(event: UnstakeRange): void {
    let recipientParam = event.params.recipient
    let poolAddressParam = event.params.pool.toHex()
    let positionIdParam = event.params.positionId

    let loadPosition = safeLoadRangePosition(
        poolAddressParam,
        positionIdParam
    )
    let position = loadPosition.entity

    position.owner = recipientParam
    position.staked = false

    position.save()
}

