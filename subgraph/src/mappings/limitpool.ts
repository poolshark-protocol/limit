import {
    Address,
    BigInt,
    Bytes,
    ethereum,
    log,
    store,
} from '@graphprotocol/graph-ts'
import {
    safeLoadLimitPool,
    safeLoadLimitPosition,
    safeLoadTick,
    safeLoadToken,
} from './utils/loads'
import { ONE_BI } from './utils/constants'
import { bigInt1e38, convertTokenToDecimal } from './utils/math'
import { safeMinus } from './utils/deltas'
import { BIGINT_ONE, BIGINT_ZERO } from './utils/helpers'
import { BurnLimit, Initialize, MintLimit, Swap } from '../../generated/LimitPoolFactory/LimitPool'

export function handleInitialize(event: Initialize): void {
    let minTickParam = event.params.minTick
    let maxTickParam = event.params.maxTick
    let startPriceParam = event.params.startPrice
    let poolAddress = event.address.toHex()

    let min = BigInt.fromI32(minTickParam)
    let max = BigInt.fromI32(maxTickParam)

    let loadLimitPool = safeLoadLimitPool(poolAddress)
    let loadMinTick = safeLoadTick(poolAddress, min)
    let loadMaxTick = safeLoadTick(poolAddress, max)

    let pool = loadLimitPool.entity
    let minTick = loadMinTick.entity
    let maxTick = loadMaxTick.entity

    pool.genesisTime = event.block.timestamp
    pool.pool0Price = startPriceParam
    pool.pool1Price = startPriceParam

    pool.save()
    minTick.save()
    maxTick.save()
}

export function handleMintLimit(event: MintLimit): void {
    let ownerParam = event.params.to.toHex()
    let lowerParam = event.params.lower
    let upperParam = event.params.upper 
    let zeroForOneParam = event.params.zeroForOne
    let epochLastParam = event.params.epochLast
    let amountInParam = event.params.amountIn
    let liquidityMintedParam = event.params.liquidityMinted
    let amountFilledParam = event.params.amountFilled
    let poolAddress = event.address.toHex()
    let msgSender = event.transaction.from

    let lower = BigInt.fromI32(lowerParam)
    let upper = BigInt.fromI32(upperParam)

    let loadLimitPool = safeLoadLimitPool(poolAddress)
    let loadPosition = safeLoadLimitPosition(poolAddress, ownerParam, lower, upper, zeroForOneParam)
    let loadLowerTick = safeLoadTick(poolAddress, lower)
    let loadUpperTick = safeLoadTick(poolAddress, upper)

    let position  = loadPosition.entity
    let pool      = loadLimitPool.entity
    let lowerTick = loadLowerTick.entity
    let upperTick = loadUpperTick.entity

    pool.liquidityGlobal = pool.liquidityGlobal.plus(liquidityMintedParam)
    pool.txnCount = pool.txnCount.plus(ONE_BI)
    // increase liquidity count
    if (!loadPosition.exists) {
        if (zeroForOneParam) {
            position.tokenIn = pool.token0
            position.tokenOut = pool.token1
        } else {
            position.tokenIn = pool.token1
            position.tokenOut = pool.token0
        }
        position.lower = lower
        position.upper = upper
        position.owner = Bytes.fromHexString(ownerParam) as Bytes
        position.epochLast = epochLastParam
        position.createdBy = msgSender
        position.createdAtTimestamp = event.block.timestamp
        position.txnHash = event.transaction.hash
        position.pool = poolAddress
    }
    position.liquidity = position.liquidity.plus(liquidityMintedParam)
    position.amountIn = amountInParam
    position.amountFilled = amountFilledParam
    // increase tvl count
    if (zeroForOneParam) {
        let tokenIn = safeLoadToken(pool.token0).entity
        pool.totalValueLocked0 = pool.totalValueLocked0.plus(convertTokenToDecimal(amountInParam, tokenIn.decimals))
        //TODO: update USD/ETH tvl
    } else {
        let tokenIn = safeLoadToken(pool.token1).entity
        pool.totalValueLocked1 = pool.totalValueLocked1.plus(convertTokenToDecimal(amountInParam, tokenIn.decimals))
        //TODO: update USD/ETH tvl
    }
    pool.save()
    position.save()
    lowerTick.save()
    upperTick.save()
}

export function handleBurnLimit(event: BurnLimit): void {
    let msgSender = event.transaction.from.toHex()
    let lowerParam = event.params.lower
    let claimParam = event.params.claim
    let upperParam = event.params.upper
    let zeroForOneParam = event.params.zeroForOne
    let liquidityBurnedParam = event.params.liquidityBurned
    let tokenInClaimedParam = event.params.tokenInClaimed
    let tokenOutBurnedParam = event.params.tokenOutBurned
    let poolAddress = event.address.toHex()
    let senderParam = event.transaction.from

    let lower = BigInt.fromI32(lowerParam)
    let claim = BigInt.fromI32(claimParam)
    let upper = BigInt.fromI32(upperParam)

    let loadLimitPool = safeLoadLimitPool(poolAddress)
    let loadPosition = safeLoadLimitPosition(
        poolAddress,
        msgSender,
        lower,
        upper,
        zeroForOneParam
    )

    let position  = loadPosition.entity
    let pool      = loadLimitPool.entity

    if (!loadPosition.exists) {
        //throw an error
    }
    if (position.liquidity == liquidityBurnedParam || 
            (zeroForOneParam ? claim.equals(upper) : claim.equals(lower))) {
        store.remove('Position', position.id)
    } else {
        // update id if position is shrunk
        if (claim != (zeroForOneParam ? lower : upper)) {
            position.id = poolAddress
                            .concat(msgSender)
                            .concat(zeroForOneParam ? lower.toString() : claim.toString())
                            .concat(zeroForOneParam ? claim.toString() : upper.toString())
                            .concat(zeroForOneParam.toString())
        }
        position.liquidity = position.liquidity.minus(liquidityBurnedParam)
        position.amountFilled = position.amountFilled.minus(tokenInClaimedParam)
        position.amountIn = position.amountIn.minus(tokenOutBurnedParam)
    }
    // update pool stats
    pool.liquidityGlobal = pool.liquidityGlobal.minus(liquidityBurnedParam)
    pool.txnCount = pool.txnCount.plus(ONE_BI)
    if (zeroForOneParam) {
        let tokenIn = safeLoadToken(pool.token1).entity
        let tokenOut = safeLoadToken(pool.token0).entity
        pool.totalValueLocked0 = pool.totalValueLocked0.minus(convertTokenToDecimal(tokenOutBurnedParam, tokenOut.decimals))
        pool.totalValueLocked1 = pool.totalValueLocked1.minus(convertTokenToDecimal(tokenInClaimedParam, tokenIn.decimals))
    } else {
        let tokenIn = safeLoadToken(pool.token0).entity
        let tokenOut = safeLoadToken(pool.token1).entity
        pool.totalValueLocked1 = pool.totalValueLocked1.minus(convertTokenToDecimal(tokenOutBurnedParam, tokenOut.decimals))
        pool.totalValueLocked0 = pool.totalValueLocked0.minus(convertTokenToDecimal(tokenInClaimedParam, tokenIn.decimals))
    }

    // shrink position to new size
    if (zeroForOneParam) {
        position.lower = claim
    } else {
        position.upper = claim
    }
    pool.save()
    position.save()
}

export function handleSwap(event: Swap): void {
    let msgSender = event.transaction.from
    let recipientParam = event.params.recipient
    let amountInParam = event.params.amountIn
    let amountOutParam = event.params.amountOut
    let newPriceParam = event.params.price
    let zeroForOneParam = event.params.zeroForOne
    let poolAddress = event.address.toHex()

    let loadLimitPool = safeLoadLimitPool(poolAddress)

    let pool = loadLimitPool.entity


    if (zeroForOneParam) {
        let tokenIn = safeLoadToken(pool.token0).entity
        let tokenOut = safeLoadToken(pool.token1).entity
        pool.pool1Price = newPriceParam
        pool.volumeToken1 = pool.volumeToken1.plus(convertTokenToDecimal(amountOutParam, tokenOut.decimals))
        pool.totalValueLocked0 = pool.totalValueLocked0.plus(convertTokenToDecimal(amountInParam, tokenIn.decimals))
        pool.totalValueLocked1 = pool.totalValueLocked1.minus(convertTokenToDecimal(amountOutParam, tokenOut.decimals))
    } else {
        let tokenIn = safeLoadToken(pool.token1).entity
        let tokenOut = safeLoadToken(pool.token0).entity
        pool.pool0Price = newPriceParam
        pool.volumeToken0 = pool.volumeToken0.plus(convertTokenToDecimal(amountOutParam, tokenOut.decimals))
        pool.totalValueLocked1 = pool.totalValueLocked1.plus(convertTokenToDecimal(amountInParam, tokenIn.decimals))
        pool.totalValueLocked0 = pool.totalValueLocked0.minus(convertTokenToDecimal(amountOutParam, tokenOut.decimals))
    }
    pool.txnCount = pool.txnCount.plus(BIGINT_ONE)

    pool.save()
}
