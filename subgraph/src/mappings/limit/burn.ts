import { store, BigInt } from "@graphprotocol/graph-ts"
import { BurnLimit } from "../../../generated/LimitPoolFactory/LimitPool"
import { ONE_BI } from "../utils/constants"
import { convertTokenToDecimal } from "../utils/helpers"
import { safeLoadLimitPool, safeLoadLimitPosition, safeLoadToken } from "../utils/loads"

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