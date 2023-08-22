import { handleInitialize as handleInitializeHelper } from './pool/initialize'
import { handleSwap as handleSwapHelper } from './pool/swap'
import { handleMintLimit as handleMintLimitHelper } from './limit/mint'
import { handleBurnLimit as handleBurnLimitHelper } from './limit/burn'
import { handleSync as handleSyncHelper } from './limit/sync'
import { handleMintRange as handleMintRangeHelper } from './range/mint'
import { handleBurnRange as handleBurnRangeHelper } from './range/burn'
import { handleCompoundRange as handleCompoundRangeHelper } from './range/compound'
import { handleCollectRange as handleCollectRangeHelper } from './range/collect'
import { BurnLimit, BurnRange, CollectRange, CompoundRange, Initialize, MintLimit, MintRange, Swap, Sync } from '../../generated/LimitPoolFactory/LimitPool'

// pool
export function handleInitialize(event: Initialize): void {
  handleInitializeHelper(event)
}

export function handleSwap(event: Swap): void {
    handleSwapHelper(event)
}
  
// range
export function handleMintRange(event: MintRange): void {
    handleMintRangeHelper(event)
}

export function handleBurnRange(event: BurnRange): void {
    handleBurnRangeHelper(event)
}

export function handleCompoundRange(event: CompoundRange): void {
    handleCompoundRangeHelper(event)
}

export function handleCollectRange(event: CollectRange): void {
    handleCollectRangeHelper(event)
}

// limit
export function handleMintLimit(event: MintLimit): void {
    handleMintLimitHelper(event)
}
  
export function handleBurnLimit(event: BurnLimit): void {
    handleBurnLimitHelper(event)
}

export function handleSync(event: Sync): void {
    handleSyncHelper(event)
}

