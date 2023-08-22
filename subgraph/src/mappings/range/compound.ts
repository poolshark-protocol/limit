import { safeLoadRangePosition, safeLoadLimitPool, safeLoadLimitPoolFactory, safeLoadToken, safeLoadCompoundRangeLog, safeLoadRangeTick } from "../utils/loads"
import {
    BigInt
} from '@graphprotocol/graph-ts'
import { BIGINT_ONE, convertTokenToDecimal } from "../utils/helpers"
import { CompoundRange } from "../../../generated/LimitPoolFactory/LimitPool"

export function handleCompoundRange(event: CompoundRange): void {
    let ownerParam = event.address.toHex()
    let positionIdParam = event.params.positionId
    let liquidityCompoundedParam = event.params.liquidityCompounded
    let poolAddress = event.address.toHex()
    let senderParam = event.transaction.from

    let loadPosition = safeLoadRangePosition(
        poolAddress,
        positionIdParam
    )
    let position = loadPosition.entity

    let lower = BigInt.fromI32(position.lower)
    let upper = BigInt.fromI32(position.upper)

    // log compound action
    let loadCompoundRangeLog = safeLoadCompoundRangeLog(event.transaction.hash, poolAddress, positionIdParam)
    let compoundLog = loadCompoundRangeLog.entity
    if (!loadCompoundRangeLog.exists) {
        compoundLog.sender = senderParam
        compoundLog.pool = poolAddress
        compoundLog.positionId = position.positionId
    }
    compoundLog.liquidityCompounded = compoundLog.liquidityCompounded.plus(liquidityCompoundedParam)

    let loadRangePool = safeLoadLimitPool(poolAddress)
    let pool = loadRangePool.entity
    let loadRangePoolFactory = safeLoadLimitPoolFactory(pool.factory)
    let loadToken0 = safeLoadToken(pool.token0)
    let loadToken1 = safeLoadToken(pool.token1)
    let loadLowerTick = safeLoadRangeTick(poolAddress, lower)
    let loadUpperTick = safeLoadRangeTick(poolAddress, upper)

    let lowerTick = loadLowerTick.entity
    let upperTick = loadUpperTick.entity
    let factory = loadRangePoolFactory.entity
    let token0 = loadToken0.entity
    let token1 = loadToken1.entity

    if (!loadPosition.exists) {
        //throw an error
    }

    lowerTick.liquidityAbsolute = lowerTick.liquidityAbsolute.plus(liquidityCompoundedParam)
    upperTick.liquidityAbsolute = upperTick.liquidityAbsolute.plus(liquidityCompoundedParam)

    lowerTick.liquidityDelta = lowerTick.liquidityDelta.plus(liquidityCompoundedParam)
    upperTick.liquidityDelta = upperTick.liquidityDelta.minus(liquidityCompoundedParam)

    // convert amounts to decimal values
    position.liquidity = position.liquidity.plus(liquidityCompoundedParam)
    if (
        pool.tickAtPrice !== null &&
        lower.le(pool.tickAtPrice) &&
        upper.gt(pool.tickAtPrice)
      ) {
        pool.liquidity = pool.liquidity.plus(liquidityCompoundedParam)
        pool.poolLiquidity = pool.poolLiquidity.plus(liquidityCompoundedParam)
    }
    pool.liquidityGlobal = pool.liquidityGlobal.plus(liquidityCompoundedParam)
    pool.txnCount = pool.txnCount.plus(BIGINT_ONE)
    token0.txnCount = token0.txnCount.plus(BIGINT_ONE)
    token1.txnCount = token1.txnCount.plus(BIGINT_ONE)
    factory.txnCount = factory.txnCount.plus(BIGINT_ONE)

    pool.save()
    token0.save()
    token1.save()
    factory.save()
    position.save()
    lowerTick.save()
    upperTick.save()
    compoundLog.save()
}