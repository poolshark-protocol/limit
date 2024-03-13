import { LimitPoolCreated } from '../../generated/LimitPoolFactory/LimitPoolFactory'
import { handlePoolCreated } from '../../src/mappings/limitpoolfactory'
import { ethereum, Address, BigInt, Bytes } from '@graphprotocol/graph-ts'
import { newMockEvent } from 'matchstick-as'

export function createLimitPoolCreated(
    pool: string, // Assuming it's already an address string
    poolToken: string, // Assuming it's already an address string
    token0: string, // Assuming it's already an address string
    token1: string, // Assuming it's already an address string
    swapFee: string, // Assuming conversion from i32 to string
    tickSpacing: string, // Assuming conversion from i32 to string
    poolTypeId: string // Assuming conversion from i32 to string
): LimitPoolCreated {
    let eventParamKeys = new Array<string>()
    let eventParamValues = new Array<ethereum.Value>()
    eventParamKeys.push('pool')
    eventParamValues.push(ethereum.Value.fromAddress(Address.fromString(pool)))
    eventParamKeys.push('token')
    eventParamValues.push(
        ethereum.Value.fromAddress(Address.fromString(poolToken))
    )
    eventParamKeys.push('token0')
    eventParamValues.push(
        ethereum.Value.fromAddress(Address.fromString(token0))
    )
    eventParamKeys.push('token1')
    eventParamValues.push(
        ethereum.Value.fromAddress(Address.fromString(token1))
    )
    eventParamKeys.push('swapFee')
    eventParamValues.push(
        ethereum.Value.fromI32(BigInt.fromString(swapFee).toI32())
    ) // Cast to i32 (assuming schema expects i32)
    eventParamKeys.push('tickSpacing')
    eventParamValues.push(
        ethereum.Value.fromI32(BigInt.fromString(tickSpacing).toI32())
    ) // Cast to i32 (assuming schema expects i32)
    eventParamKeys.push('poolTypeId')
    eventParamValues.push(
        ethereum.Value.fromI32(BigInt.fromString(poolTypeId).toI32())
    ) // Cast to i32 (assuming schema expects i32)

    let newLimitPoolCreatedEvent = createLimitPoolCreatedEvent(
        eventParamKeys,
        eventParamValues
    )
    handleNewLimitPoolCreated([newLimitPoolCreatedEvent])
    return newLimitPoolCreatedEvent
}

function handleNewLimitPoolCreated(events: LimitPoolCreated[]): void {
    events.forEach((event) => {
        handlePoolCreated(event)
    })
}

function createLimitPoolCreatedEvent(
    eventParamKeys: Array<string>,
    eventParamValues: Array<ethereum.Value>
): LimitPoolCreated {
    //let newLimitPoolCreatedEvent = (newMockEvent())
    let mockEvent = newMockEvent()
    let newLimitPoolCreatedEvent = new LimitPoolCreated(
        mockEvent.address,
        mockEvent.logIndex,
        mockEvent.transactionLogIndex,
        mockEvent.logType,
        mockEvent.block,
        mockEvent.transaction,
        mockEvent.parameters,
        mockEvent.receipt
    )
    newLimitPoolCreatedEvent.parameters = new Array()

    for (let i = 0, k = eventParamKeys.length; i < k; ++i) {
        let eventParam = new ethereum.EventParam(
            eventParamKeys[i],
            eventParamValues[i]
        )
        newLimitPoolCreatedEvent.parameters.push(eventParam)
    }

    return newLimitPoolCreatedEvent
}
