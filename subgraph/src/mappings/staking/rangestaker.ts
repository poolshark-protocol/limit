import { safeLoadLimitPool, safeLoadRangePosition, safeLoadToken, safeLoadTotalSeasonReward, safeLoadUserSeasonReward } from '../utils/loads'
import { FeeToTransfer, OwnerTransfer, StakeRange, StakeRangeAccrued, UnstakeRange } from '../../../generated/templates/RangeStakerTemplate/RangeStaker'
import { SEASON_0_BLOCK_1, SEASON_0_BLOCK_2, FACTORY_ADDRESS } from '../../constants/constants'
import { convertTokenToDecimal } from '../utils/helpers'
import { log } from '@graphprotocol/graph-ts'

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

    if (!loadPosition.exists) {
        position.pool = poolAddressParam
        position.positionId = positionIdParam
        position.createdAtBlockNumber = event.block.number
        position.createdAtTimestamp = event.block.timestamp
    }

    position.owner = recipientParam
    position.staked = true

    position.save()
}

export function handleStakeRangeAccrued(event: StakeRangeAccrued): void {
    let poolAddressParam = event.params.pool.toHex()
    let positionIdParam = event.params.positionId
    let feeGrowth0AccruedParam = event.params.feeGrowth0Accrued
    let feeGrowth1AccruedParam = event.params.feeGrowth1Accrued

    let loadPool = safeLoadLimitPool(poolAddressParam)
    let loadPosition = safeLoadRangePosition(poolAddressParam, positionIdParam)

    let pool = loadPool.entity
    let position = loadPosition.entity

    let loadToken0 = safeLoadToken(pool.token0)
    let loadToken1 = safeLoadToken(pool.token1)

    let token0 = loadToken0.entity
    let token1 = loadToken1.entity

    let token0Fees = convertTokenToDecimal(feeGrowth0AccruedParam, token0.decimals)
    let token1Fees = convertTokenToDecimal(feeGrowth1AccruedParam, token1.decimals)

    const feeGrowthAccruedUsd = token0Fees.times(token0.usdPrice).plus(token1Fees.times(token1.usdPrice))

    // season 0 - block 1
    if (event.block.timestamp.ge(SEASON_0_BLOCK_1.START_TIME) && event.block.timestamp.le(SEASON_0_BLOCK_1.END_TIME)) {
        if (SEASON_0_BLOCK_1.WHITELISTED_PAIRS.includes(pool.id) && !SEASON_0_BLOCK_1.BLACKLISTED_ADDRESSES.includes(position.owner.toHex())) {
            let loadUserSeasonReward = safeLoadUserSeasonReward(position.owner.toHex(), "0", "1") // 1
            let loadTotalSeasonReward = safeLoadTotalSeasonReward(FACTORY_ADDRESS, "0", "1") // 2

            let userSeasonReward = loadUserSeasonReward.entity
            let totalSeasonReward = loadTotalSeasonReward.entity

            // whitelisted pairs
            userSeasonReward.whitelistedFeesUsd = userSeasonReward.whitelistedFeesUsd.plus(feeGrowthAccruedUsd)
            totalSeasonReward.whitelistedFeesUsd = totalSeasonReward.whitelistedFeesUsd.plus(feeGrowthAccruedUsd)

            totalSeasonReward.save() // 1
            userSeasonReward.save() // 2
        }
    }

    // season 0 - block 2
    if (event.block.timestamp.ge(SEASON_0_BLOCK_2.START_TIME) && event.block.timestamp.le(SEASON_0_BLOCK_2.END_TIME)) {
        if (SEASON_0_BLOCK_2.WHITELISTED_PAIRS.includes(pool.id) && !SEASON_0_BLOCK_2.BLACKLISTED_ADDRESSES.includes(position.owner.toHex())) {
            let loadUserSeasonReward = safeLoadUserSeasonReward(position.owner.toHex(), "0", "2") // 1
            let loadTotalSeasonReward = safeLoadTotalSeasonReward(FACTORY_ADDRESS, "0", "2") // 2

            let userSeasonReward = loadUserSeasonReward.entity
            let totalSeasonReward = loadTotalSeasonReward.entity

            // whitelisted pairs
            userSeasonReward.whitelistedFeesUsd = userSeasonReward.whitelistedFeesUsd.plus(feeGrowthAccruedUsd)
            totalSeasonReward.whitelistedFeesUsd = totalSeasonReward.whitelistedFeesUsd.plus(feeGrowthAccruedUsd)

            totalSeasonReward.save() // 1
            userSeasonReward.save() // 2
        }
    }
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

