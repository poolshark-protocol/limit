import { safeLoadManager, safeLoadLimitPoolFactory, safeLoadFeeTier } from './utils/loads'
import { BigInt, log } from '@graphprotocol/graph-ts'
import { FACTORY_ADDRESS } from '../constants/constants'
import { FactoryChanged, FeeTierEnabled, FeeToTransfer, PoolTypeEnabled, OwnerTransfer, ProtocolSwapFeesModified, ProtocolFeesCollected, ProtocolFillFeesModified } from '../../generated/LimitPoolManager/LimitPoolManager'
import { FeeTier } from '../../generated/schema'

export function handleFeeTierEnabled(event: FeeTierEnabled): void {
    let swapFeeParam     = event.params.swapFee
    let tickSpacingParam = event.params.tickSpacing

    let loadManager = safeLoadManager(event.address.toHex())
    let loadFeeTier = safeLoadFeeTier(BigInt.fromI32(swapFeeParam))

    let manager = loadManager.entity
    let feeTier = loadFeeTier.entity

    if(!loadFeeTier.exists) {
        feeTier.feeAmount = BigInt.fromString(feeTier.id)
        feeTier.tickSpacing = BigInt.fromI32(tickSpacingParam)
        feeTier.createdAtTimestamp = event.block.timestamp
        feeTier.createdAtBlockNumber = event.block.number
        feeTier.save()
        let managerFeeTiers = manager.feeTiers
        managerFeeTiers.push(feeTier.id)
        manager.feeTiers = managerFeeTiers
        manager.save()
    } else {
        //something went wrong

    }
}

export function handlePoolTypeEnabled(event: PoolTypeEnabled): void {

}

export function handleFactoryChanged(event: FactoryChanged): void {
    let loadLimitPoolFactory = safeLoadLimitPoolFactory(FACTORY_ADDRESS)
    let loadManager = safeLoadManager(event.address.toHex())
    
    let manager = loadManager.entity
    let factory = loadLimitPoolFactory.entity
    
    manager.factory = factory.id
    factory.manager = manager.id
    
    manager.save()
    factory.save()
}

export function handleFeeToTransfer(event: FeeToTransfer): void {
    let previousFeeToParam = event.params.previousFeeTo
    let newFeeToParam      = event.params.newFeeTo

    let loadManager = safeLoadManager(event.address.toHex())

    let manager = loadManager.entity

    manager.feeTo = newFeeToParam
 
    manager.save()
}

export function handleOwnerTransfer(event: OwnerTransfer): void {
    let previousOwnerParam = event.params.previousOwner
    let newOwnerParam      = event.params.newOwner

    let loadManager = safeLoadManager(event.address.toHex())
    let loadFactory = safeLoadLimitPoolFactory(FACTORY_ADDRESS)

    let manager = loadManager.entity
    let factory = loadFactory.entity

    if(!loadManager.exists) {
        manager.feeTo = newOwnerParam
    }
    if(!loadFactory.exists) {
        factory.manager = manager.id
    }

    manager.owner = newOwnerParam

    manager.save()
    factory.save()
}

export function handleProtocolFeesCollected(event: ProtocolFeesCollected): void {

}

export function handleProtocolFillFeesModified(event: ProtocolFillFeesModified): void {
    // -1 means no change
}

export function handleProtocolSwapFeesModified(event: ProtocolSwapFeesModified): void {
    // -1 means no change
}