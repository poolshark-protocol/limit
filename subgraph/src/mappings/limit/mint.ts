import {
    BigInt,
    Bytes,
} from '@graphprotocol/graph-ts'
import { MintLimit } from "../../../generated/LimitPoolFactory/LimitPool"
import { ONE_BI } from "../utils/constants"
import { BIGINT_ONE, convertTokenToDecimal } from "../utils/helpers"
import { safeLoadBasePrice, safeLoadLimitPool, safeLoadLimitPoolFactory, safeLoadLimitPosition, safeLoadLimitTick, safeLoadToken } from "../utils/loads"
import { findEthPerToken } from '../utils/price'
import { updateDerivedTVLAmounts } from '../utils/tvl'

export function handleMintLimit(event: MintLimit): void {
    let ownerParam = event.params.to.toHex()
    let lowerParam = event.params.lower
    let upperParam = event.params.upper
    let positionIdParam = event.params.positionId
    let zeroForOneParam = event.params.zeroForOne
    let epochLastParam = event.params.epochLast
    let amountInParam = event.params.amountIn
    let liquidityMintedParam = event.params.liquidityMinted
    let amountFilledParam = event.params.amountFilled
    let poolAddress = event.address.toHex()
    let msgSender = event.transaction.from

    let lower = BigInt.fromI32(lowerParam)
    let upper = BigInt.fromI32(upperParam)

    let loadBasePrice = safeLoadBasePrice('eth') // 1
    let loadLimitPool = safeLoadLimitPool(poolAddress) // 2
    let pool          = loadLimitPool.entity
    let basePrice = loadBasePrice.entity

    let loadLimitPoolFactory = safeLoadLimitPoolFactory(pool.factory) // 3
    let loadPosition = safeLoadLimitPosition(poolAddress, positionIdParam) // 4
    let loadLowerTick = safeLoadLimitTick(poolAddress, lower) // 5
    let loadUpperTick = safeLoadLimitTick(poolAddress, upper) // 6
    let loadTokenIn = safeLoadToken(zeroForOneParam ? pool.token0 : pool.token1) // 7
    let loadTokenOut = safeLoadToken(zeroForOneParam ? pool.token1 : pool.token0) // 8

    let factory = loadLimitPoolFactory.entity
    let position  = loadPosition.entity
    let lowerTick = loadLowerTick.entity
    let upperTick = loadUpperTick.entity
    let tokenIn = loadTokenIn.entity
    let tokenOut = loadTokenOut.entity

    pool.txnCount = pool.txnCount.plus(ONE_BI)
    tokenIn.txnCount = tokenIn.txnCount.plus(ONE_BI)
    tokenOut.txnCount = tokenOut.txnCount.plus(ONE_BI)
    factory.txnCount = factory.txnCount.plus(ONE_BI)

    if (zeroForOneParam) {
        if (lowerTick.index == pool.tickAtPrice) {
            upperTick.active = false
        }
    } else {
        if (upperTick.index == pool.tickAtPrice) {
            upperTick.active = true
        }
    }

    // increase liquidity count
    if (!loadPosition.exists) {
        if (zeroForOneParam) {
            position.tokenIn = pool.token0
            position.tokenOut = pool.token1
        } else {
            position.tokenIn = pool.token1
            position.tokenOut = pool.token0
        }
        position.positionId = positionIdParam
        position.lower = lower
        position.upper = upper
        position.owner = Bytes.fromHexString(ownerParam) as Bytes
        position.epochLast = epochLastParam
        position.createdBy = msgSender
        position.createdAtTimestamp = event.block.timestamp
        position.txnHash = event.transaction.hash
        position.pool = poolAddress
    }
    pool.liquidityGlobal = pool.liquidityGlobal.plus(liquidityMintedParam)
    position.liquidity = position.liquidity.plus(liquidityMintedParam)
    position.amountIn = amountInParam
    position.amountFilled = amountFilledParam

    if (positionIdParam >= pool.positionIdNext) {
        pool.positionIdNext = positionIdParam.plus(BIGINT_ONE)
    }

    let amountIn = convertTokenToDecimal(amountInParam, tokenIn.decimals)
    let amountOut = convertTokenToDecimal(amountFilledParam, tokenOut.decimals)
    tokenIn.totalValueLocked = tokenIn.totalValueLocked.plus(amountIn)
    tokenOut.totalValueLocked = tokenOut.totalValueLocked.minus(amountOut)
    pool.totalValueLocked0 = pool.totalValueLocked0.plus(zeroForOneParam ? amountIn : amountOut.neg())
    pool.totalValueLocked1 = pool.totalValueLocked1.plus(zeroForOneParam ? amountOut.neg() : amountIn)

    // grab tick epochs
    let lowerTickEpoch = zeroForOneParam ? lowerTick.epochLast0 : lowerTick.epochLast1
    let upperTickEpoch = zeroForOneParam ? upperTick.epochLast0 : upperTick.epochLast1

    if (zeroForOneParam) {
        pool.totalValueLocked0 = pool.totalValueLocked0.plus(amountIn)
        if (lowerTickEpoch.le(position.epochLast)) {
            // lower tick has not been crossed yet
            lowerTick.liquidityDelta = lowerTick.liquidityDelta.plus(liquidityMintedParam)
            lowerTick.liquidityAbsolute = lowerTick.liquidityAbsolute.plus(liquidityMintedParam)
            lowerTick.save() // 1
        }
        // upper tick has not been crossed yet
        upperTick.liquidityDelta = upperTick.liquidityDelta.plus(liquidityMintedParam)
        upperTick.liquidityAbsolute = upperTick.liquidityAbsolute.minus(liquidityMintedParam)
        upperTick.save() // 2
    } else {
        pool.totalValueLocked1 = pool.totalValueLocked1.plus(amountIn)
        if (upperTickEpoch.le(position.epochLast)) {
            // upper tick has not been crossed yet
            upperTick.liquidityDelta = upperTick.liquidityDelta.plus(liquidityMintedParam)
            upperTick.liquidityAbsolute = upperTick.liquidityAbsolute.plus(liquidityMintedParam)
            upperTick.save() // 1
        }
        // lower tick has not been crossed yet
        lowerTick.liquidityDelta = lowerTick.liquidityDelta.plus(liquidityMintedParam)
        lowerTick.liquidityAbsolute = lowerTick.liquidityAbsolute.minus(liquidityMintedParam)
        lowerTick.save() // 2
    }

    // eth price updates
    tokenIn.ethPrice = findEthPerToken(tokenIn, tokenOut, basePrice)
    tokenOut.ethPrice = findEthPerToken(tokenOut, tokenIn, basePrice)
    tokenIn.usdPrice = tokenIn.ethPrice.times(basePrice.USD)
    tokenOut.usdPrice = tokenOut.ethPrice.times(basePrice.USD)

    // tvl updates
    let oldPoolTotalValueLockedEth = pool.totalValueLockedEth
    tokenIn.totalValueLocked = tokenIn.totalValueLocked.plus(amountIn)
    let updateTvlRet = updateDerivedTVLAmounts(
        zeroForOneParam ? tokenIn : tokenOut,
        zeroForOneParam ? tokenOut : tokenIn,
        pool,
        factory,
        oldPoolTotalValueLockedEth
    )
    if (zeroForOneParam) {
        tokenIn = updateTvlRet.token0
        tokenOut = updateTvlRet.token1
    } else {
        tokenIn = updateTvlRet.token1
        tokenOut = updateTvlRet.token0
    }
    pool = updateTvlRet.pool
    factory = updateTvlRet.factory

    basePrice.save() // 3
    pool.save() // 4
    factory.save() // 5
    position.save() // 6
    tokenIn.save() // 7
    tokenOut.save() // 8
}