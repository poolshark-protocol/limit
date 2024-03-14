import { MintRange } from '../../generated/LimitPoolFactory/LimitPool'
import { handleMintRange } from '../../src/mappings/limitpool'
import { ethereum } from '@graphprotocol/graph-ts'
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
    eventParamValues.push(ethereum.Value.fromString(recipient))
    eventParamKeys.push('lower')
    eventParamValues.push(ethereum.Value.fromI32(parseInt(lower, 10)))
    eventParamKeys.push('upper')
    eventParamValues.push(ethereum.Value.fromI32(parseInt(upper, 10)))
    eventParamKeys.push('positionId')
    eventParamValues.push(ethereum.Value.fromString(positionId))
    eventParamKeys.push('liquidityMinted')
    eventParamValues.push(ethereum.Value.fromI32(parseInt(liquidityMinted, 10)))
    eventParamKeys.push('amount0Delta')
    eventParamValues.push(ethereum.Value.fromI32(parseInt(amount0Delta, 10)))
    eventParamKeys.push('amount1Delta')
    eventParamValues.push(ethereum.Value.fromI32(parseInt(amount1Delta, 10)))
    let newMintRangeEvent = createMintRangeEvent(
        eventParamKeys,
        eventParamValues
    )
    handleMintRangeMock([newMintRangeEvent])

    return
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
