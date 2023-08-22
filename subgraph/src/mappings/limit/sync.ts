import {
    BigInt,
    Bytes,
    store,
} from '@graphprotocol/graph-ts'
import { MintLimit, Sync } from "../../../generated/LimitPoolFactory/LimitPool"
import { ONE_BI } from "../utils/constants"
import { convertTokenToDecimal } from "../utils/helpers"
import { safeLoadLimitPool, safeLoadLimitPosition, safeLoadLimitTick, safeLoadToken } from "../utils/loads"

export function handleSync(event: Sync): void {
    let priceParam = event.params.price
    let liquidityParam = event.params.liquidity
    let tickAtPriceParam = event.params.tickAtPrice
    let isPool0Param = event.params.isPool0
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