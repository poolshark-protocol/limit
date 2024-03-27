import { MintRange } from '../../generated/LimitPoolFactory/LimitPool'
import { handleMintRange } from '../../src/mappings/limitpool'
import { Address, ethereum, BigInt } from '@graphprotocol/graph-ts'
import { newMockEvent } from 'matchstick-as'

// Mock the MintRange class
export function createMintRange(
    recipient: string,
    lower: string,
    upper: string,
    positionId: string,
    liquidityMinted: string,
    amount0Delta: string,
    amount1Delta: string
): MintRange {
    let eventParamKeys = new Array<string>()
    let eventParamValues = new Array<ethereum.Value>()
    eventParamKeys.push('recipient')
    eventParamValues.push(
        ethereum.Value.fromAddress(Address.fromString(recipient))
    )
    eventParamKeys.push('lower')
    eventParamValues.push(
        ethereum.Value.fromI32(BigInt.fromString(lower).toI32())
    )
    eventParamKeys.push('upper')
    eventParamValues.push(
        ethereum.Value.fromI32(BigInt.fromString(upper).toI32())
    )
    eventParamKeys.push('positionId')
    eventParamValues.push(
        ethereum.Value.fromUnsignedBigInt(BigInt.fromString(positionId))
    )
    eventParamKeys.push('liquidityMinted')
    eventParamValues.push(
        ethereum.Value.fromUnsignedBigInt(BigInt.fromString(liquidityMinted))
    )
    eventParamKeys.push('amount0Delta')
    eventParamValues.push(
        ethereum.Value.fromUnsignedBigInt(BigInt.fromString(amount0Delta))
    )
    eventParamKeys.push('amount1Delta')
    eventParamValues.push(
        ethereum.Value.fromUnsignedBigInt(BigInt.fromString(amount1Delta))
    )
    let newMintRangeEvent = createMintRangeEvent(
        eventParamKeys,
        eventParamValues
    )
    handleMintRangeMock([newMintRangeEvent])

    return newMintRangeEvent
}

function handleMintRangeMock(events: MintRange[]): void {
    events.forEach((event) => {
        handleMintRange(event)
    })
}

function createMintRangeEvent(
    eventParamKeys: Array<string>,
    eventParamValues: Array<ethereum.Value>
): MintRange {
    let mockEvent = newMockEvent()
    let newMintRangeEvent = new MintRange(
        mockEvent.address,
        mockEvent.logIndex,
        mockEvent.transactionLogIndex,
        mockEvent.logType,
        mockEvent.block,
        mockEvent.transaction,
        mockEvent.parameters,
        mockEvent.receipt
    )
    return newMintRangeEvent
}
