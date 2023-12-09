import {
    BigInt, log,
} from '@graphprotocol/graph-ts'
import {
    safeLoadLimitPool,
    safeLoadRangePosition,
    safeLoadRangeTick,
    safeLoadToken,
    safeLoadBasePrice,
    safeLoadLimitPoolFactory,
    safeLoadMintRangeLog,
    safeLoadTvlUpdateLog,
} from '../utils/loads'
import { BIGINT_ONE, convertTokenToDecimal } from '../utils/helpers'
import { ONE_BI } from '../../constants/arbitrum'
import { updateDerivedTVLAmounts } from '../utils/tvl'
import { findEthPerToken } from '../utils/price'
import { MintRange } from '../../../generated/LimitPoolFactory/LimitPool'

export function handleMintRange(event: MintRange): void {
    //TODO: fix event to emit 'recipient' and make new deployment
    let recipientParam = event.params.recipient
    let lowerParam = event.params.lower
    let upperParam = event.params.upper 
    let positionIdParam = event.params.positionId
    let liquidityMintedParam = event.params.liquidityMinted
    let amount0DeltaParam = event.params.amount0Delta
    let amount1DeltaParam = event.params.amount1Delta
    let poolAddress = event.address.toHex()
    let msgSender = event.transaction.from

    let lower = BigInt.fromI32(lowerParam)
    let upper = BigInt.fromI32(upperParam)

    let loadBasePrice = safeLoadBasePrice('eth')
    let loadLimitPool = safeLoadLimitPool(poolAddress)
    let basePrice = loadBasePrice.entity
    let pool = loadLimitPool.entity

    let loadLimitPoolFactory = safeLoadLimitPoolFactory(pool.factory)
    let loadToken0 = safeLoadToken(pool.token0)
    let loadToken1 = safeLoadToken(pool.token1)
    let factory = loadLimitPoolFactory.entity
    let token0 = loadToken0.entity
    let token1 = loadToken1.entity

    // log mint action
    // let loadMintLog = safeLoadMintRangeLog(event.transaction.hash, poolAddress, positionIdParam)
    // let mintLog = loadMintLog.entity
    // if (!loadMintLog.exists) {
    //     mintLog.sender = msgSender
    //     mintLog.recipient = recipientParam
    //     mintLog.lower = lower
    //     mintLog.upper = upper
    //     mintLog.positionId = positionIdParam
    //     mintLog.pool = poolAddress
    // }
    // mintLog.liquidityMinted = mintLog.liquidityMinted.plus(liquidityMintedParam)
    // mintLog.save()

    let loadLowerTick = safeLoadRangeTick(
        poolAddress,
        lower
    )
    let loadUpperTick = safeLoadRangeTick(
        poolAddress,
        upper
    )
    let loadPosition = safeLoadRangePosition(
        poolAddress,
        positionIdParam
    )
    let position = loadPosition.entity
    let lowerTick = loadLowerTick.entity
    let upperTick = loadUpperTick.entity

    lowerTick.liquidityDelta = lowerTick.liquidityDelta.plus(liquidityMintedParam)
    upperTick.liquidityDelta = upperTick.liquidityDelta.minus(liquidityMintedParam)
    lowerTick.liquidityAbsolute = lowerTick.liquidityAbsolute.plus(liquidityMintedParam)
    upperTick.liquidityAbsolute = upperTick.liquidityAbsolute.plus(liquidityMintedParam)

    position.lower = lower
    position.upper = upper
    if (!loadPosition.exists) {
        position.owner = recipientParam
        position.staked = false
        position.pool = pool.id
        position.positionId = positionIdParam
        position.createdAtBlockNumber = event.block.number
        position.createdAtTimestamp = event.block.timestamp
    }
    position.updatedAtBlockNumber = event.block.number
    position.updatedAtTimestamp = event.block.timestamp

    if (positionIdParam >= pool.positionIdNext) {
        pool.positionIdNext = positionIdParam.plus(BIGINT_ONE)
    }

    let amount0 = convertTokenToDecimal(amount0DeltaParam, token0.decimals)
    let amount1 = convertTokenToDecimal(amount1DeltaParam, token1.decimals)
    let amountUsd = amount0
    .times(token0.ethPrice.times(basePrice.USD))
    .plus(amount1.times(token1.ethPrice.times(basePrice.USD)))
    
    token0.txnCount = token0.txnCount.plus(ONE_BI)
    token1.txnCount = token1.txnCount.plus(ONE_BI)
    pool.txnCount = pool.txnCount.plus(ONE_BI)
    factory.txnCount = factory.txnCount.plus(ONE_BI)

    // eth price updates
    token0.ethPrice = findEthPerToken(token0, token1, pool, basePrice)
    token1.ethPrice = findEthPerToken(token1, token0, pool, basePrice)
    token0.usdPrice = token0.ethPrice.times(basePrice.USD)
    token1.usdPrice = token1.ethPrice.times(basePrice.USD)

    let oldPoolTVLETH = pool.totalValueLockedEth
    token0.totalValueLocked = token0.totalValueLocked.plus(amount0)
    token1.totalValueLocked = token1.totalValueLocked.plus(amount1)
    pool.totalValueLocked0 = pool.totalValueLocked0.plus(amount0)
    pool.totalValueLocked1 = pool.totalValueLocked1.plus(amount1)
    let updateTvlRet = updateDerivedTVLAmounts(token0, token1, pool, factory, basePrice, oldPoolTVLETH)
    token0 = updateTvlRet.token0
    token1 = updateTvlRet.token1
    pool = updateTvlRet.pool
    factory = updateTvlRet.factory

    // let loadTvlUpdateLog = safeLoadTvlUpdateLog(event.transaction.hash, poolAddress)
    // let tvlUpdateLog = loadTvlUpdateLog.entity

    // tvlUpdateLog.pool = poolAddress
    // tvlUpdateLog.eventName = "MintRange"
    // tvlUpdateLog.txnHash = event.transaction.hash
    // tvlUpdateLog.txnBlockNumber = event.block.number
    // tvlUpdateLog.amount0Change = amount0
    // tvlUpdateLog.amount1Change = amount1
    // tvlUpdateLog.amount0Total = pool.totalValueLocked0
    // tvlUpdateLog.amount1Total = pool.totalValueLocked1
    // tvlUpdateLog.token0UsdPrice = token0.usdPrice
    // tvlUpdateLog.token1UsdPrice = token1.usdPrice
    // tvlUpdateLog.amountUsdChange = amountUsd
    // tvlUpdateLog.amountUsdTotal = pool.totalValueLockedUsd

    // tvlUpdateLog.save()

    if (
        pool.tickAtPrice !== null &&
        lower.le(pool.tickAtPrice) &&
        upper.gt(pool.tickAtPrice)
      ) {
        pool.liquidity = pool.liquidity.plus(liquidityMintedParam)
        pool.poolLiquidity = pool.poolLiquidity.plus(liquidityMintedParam)
    }
    position.liquidity = position.liquidity.plus(liquidityMintedParam)
    pool.liquidityGlobal = pool.liquidityGlobal.plus(liquidityMintedParam)

    if (token1.symbol == 'USDC') {
        log.info('USDC price at mint time: {}', [token1.usdPrice.toString()])
    }
    
    basePrice.save()
    pool.save()
    factory.save()
    token0.save()
    token1.save()
    lowerTick.save()
    upperTick.save()
    position.save() 
}
