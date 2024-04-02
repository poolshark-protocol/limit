import { MintLimit } from '../../generated/LimitPoolFactory/LimitPool'
import { handleMintLimit } from '../../src/mappings/limitpool'
import { Address, ethereum, BigInt } from '@graphprotocol/graph-ts'
import { log, newMockEvent } from 'matchstick-as'

// Mock the MintLimit class
export function createMintLimit(
    poolAddress: string,
    recipient: string,
    lower: string,
    upper: string,
    positionId: string,
    liquidityMinted: string,
    amount0Delta: string,
    amount1Delta: string
): MintLimit {
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
    let newMintLimitEvent = createMintLimitEvent(
        eventParamKeys,
        eventParamValues
    )
    newMintLimitEvent.address = Address.fromString(poolAddress)
    handleMintLimitMock([newMintLimitEvent])
    return newMintLimitEvent
}

function handleMintLimitMock(events: MintLimit[]): void {
    events.forEach((event) => {
        handleMintLimit(event)
    })
}

function createMintLimitEvent(
    eventParamKeys: Array<string>,
    eventParamValues: Array<ethereum.Value>
): MintLimit {
    let mockEvent = newMockEvent()
    //log.info('address mock event: {}', [mockEvent.address.toHex()])
    let newMintLimitEvent = new MintLimit(
        mockEvent.address,
        mockEvent.logIndex,
        mockEvent.transactionLogIndex,
        mockEvent.logType,
        mockEvent.block,
        mockEvent.transaction,
        mockEvent.parameters,
        mockEvent.receipt
    )
    newMintLimitEvent.parameters = new Array()
    for (let i = 0, k = eventParamKeys.length; i < k; ++i) {
        let eventParam = new ethereum.EventParam(
            eventParamKeys[i],
            eventParamValues[i]
        )
        newMintLimitEvent.parameters.push(eventParam)
    }
    return newMintLimitEvent
}
