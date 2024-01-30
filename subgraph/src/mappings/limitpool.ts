import { handleInitialize as handleInitializeHelper } from './pool/initialize'
import { handleSwap as handleSwapHelper } from './pool/swap'
import { handleSampleCountIncreased as handleSampleCountIncreasedHelper } from './samples/lengthincreased'
import { handleSampleRecorded as handleSampleRecordedHelper } from './samples/recorded'
import { handleMintLimit as handleMintLimitHelper } from './limit/mint'
import { handleBurnLimit as handleBurnLimitHelper } from './limit/burn'
import { handleSyncLimitPool as handleSyncLimitPoolHelper } from './limit/syncpool'
import { handleSyncLimitLiquidity as handleSyncLimitLiquidityHelper } from './limit/syncliquidity'
import { handleSyncLimitTick as handleSyncLimitTickHelper } from './limit/synctick'
import { handleMintRange as handleMintRangeHelper } from './range/mint'
import { handleBurnRange as handleBurnRangeHelper } from './range/burn'
import { handleCompoundRange as handleCompoundRangeHelper } from './range/compound'
import { handleSyncRangeTick as handleSyncRangeTickHelper } from './range/synctick'
import { BurnLimit, BurnRange, Collect, CompoundRange, InitializeLimit, MintLimit, MintRange, SampleCountIncreased, SampleRecorded, Swap, SwapLimit, SyncLimitLiquidity, SyncLimitPool, SyncLimitTick, SyncRangeTick } from '../../generated/LimitPoolFactory/LimitPool'
import { handleCollect as handleCollectHelper } from './range/collect'

// pool
export function handleInitialize(event: InitializeLimit): void {
  handleInitializeHelper(event)
}

export function handleSwap(event: SwapLimit): void {
    handleSwapHelper(event)
}

// samples
export function handleSampleCountIncreased(event: SampleCountIncreased): void {
    handleSampleCountIncreasedHelper(event)
}

export function handleSampleRecorded(event: SampleRecorded): void {
    handleSampleRecordedHelper(event)
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

export function handleSyncRangeTick(event: SyncRangeTick): void {
    handleSyncRangeTickHelper(event)
}

export function handleCollect(event: Collect): void {
    handleCollectHelper(event)
}

// limit positions
export function handleMintLimit(event: MintLimit): void {
    handleMintLimitHelper(event)
}
  
export function handleBurnLimit(event: BurnLimit): void {
    handleBurnLimitHelper(event)
}

// limit sync
export function handleSyncLimitPool(event: SyncLimitPool): void {
    handleSyncLimitPoolHelper(event)
}

export function handleSyncLimitLiquidity(event: SyncLimitLiquidity): void {
    handleSyncLimitLiquidityHelper(event)
}

export function handleSyncLimitTick(event: SyncLimitTick): void {
    handleSyncLimitTickHelper(event)
}
