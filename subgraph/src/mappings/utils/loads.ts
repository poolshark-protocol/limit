import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'
import { LimitPool, LimitPoolFactory, LimitPoolManager, LimitPosition, Tick, Token, FeeTier } from '../../../generated/schema'
import { ONE_BD, ONE_BI } from './constants'
import {
    fetchTokenSymbol,
    fetchTokenName,
    fetchTokenDecimals,
    BIGINT_ZERO,
    BIGINT_ONE,
} from './helpers'
import { bigDecimalExponated, safeDiv } from './math'

class LoadTokenRet {
    entity: Token
    exists: boolean
}
export function safeLoadToken(address: string): LoadTokenRet {
    let exists = true

    let tokenEntity = Token.load(address)

    if (!tokenEntity) {
        tokenEntity = new Token(address)
        log.info('{}', [address])
        let tokenAddress = Address.fromString(address)
        tokenEntity.symbol = fetchTokenSymbol(tokenAddress)
        tokenEntity.name = fetchTokenName(tokenAddress)
        tokenEntity.decimals = fetchTokenDecimals(tokenAddress)

        exists = false
    }

    return {
        entity: tokenEntity,
        exists: exists,
    }
}

class LoadManagerRet {
    entity: LimitPoolManager
    exists: boolean
}
export function safeLoadManager(address: string): LoadManagerRet {
    let exists = true

    let managerEntity = LimitPoolManager.load(address)

    if (!managerEntity) {
        managerEntity = new LimitPoolManager(address)
        exists = false
    }

    return {
        entity: managerEntity,
        exists: exists,
    }
}

class LoadFeeTierRet {
    entity: FeeTier
    exists: boolean
}
export function safeLoadFeeTier(feeTier: BigInt): LoadFeeTierRet {
    let exists = true

    let feeTierId = feeTier.toString()
    log.debug('pool volatility tier id: {}', [feeTierId])

    let feeTierEntity = FeeTier.load(feeTierId)

    if (!feeTierEntity) {
        feeTierEntity = new FeeTier(feeTierId)
        exists = false
    }

    return {
        entity: feeTierEntity,
        exists: exists,
    }
}

class LoadTickRet {
    entity: Tick
    exists: boolean
}
export function safeLoadTick(address: string, index: BigInt): LoadTickRet {
    let exists = true

    let tickId = address
    .concat(index.toString())

    let tickEntity = Tick.load(tickId)

    if (!tickEntity) {
        tickEntity = new Tick(tickId)
        tickEntity.pool = address
        tickEntity.index = index
        tickEntity.epochLast = ONE_BI
        // 1.0001^tick is token1/token0.
        tickEntity.price0 = bigDecimalExponated(BigDecimal.fromString('1.0001'), BigInt.fromI32(tickEntity.index.toI32()))
        tickEntity.price1 = safeDiv(ONE_BD, tickEntity.price0)
        exists = false
    }

    return {
        entity: tickEntity,
        exists: exists,
    }
}

class LoadLimitPoolFactoryRet {
    entity: LimitPoolFactory
    exists: boolean
}
export function safeLoadLimitPoolFactory(factoryAddress: string): LoadLimitPoolFactoryRet {
    let exists = true
    let coverPoolFactoryEntity = LimitPoolFactory.load(factoryAddress)

    if (!coverPoolFactoryEntity) {
        coverPoolFactoryEntity = new LimitPoolFactory(factoryAddress)
        coverPoolFactoryEntity.poolCount = BIGINT_ZERO
        exists = false
    }

    return {
        entity: coverPoolFactoryEntity,
        exists: exists,
    }
}

class LoadLimitPoolRet {
    entity: LimitPool
    exists: boolean
}
export function safeLoadLimitPool(poolAddress: string): LoadLimitPoolRet {
    let exists = true
    let coverPoolEntity = LimitPool.load(poolAddress)

    if (!coverPoolEntity) {
        coverPoolEntity = new LimitPool(poolAddress)
        exists = false
    }

    return {
        entity: coverPoolEntity,
        exists: exists,
    }
}

class LoadLimitPositionRet {
    entity: LimitPosition
    exists: boolean
}
export function safeLoadLimitPosition(
    poolAddress: string,
    owner: string,
    lower: BigInt,
    upper: BigInt,
    zeroForOne: boolean
): LoadLimitPositionRet {
    let exists = true
    let fromToken: string

    let positionId = poolAddress
        .concat(owner)
        .concat(lower.toString())
        .concat(upper.toString())
        .concat(zeroForOne.toString())

    let positionEntity = LimitPosition.load(positionId)

    if (!positionEntity) {
        positionEntity = new LimitPosition(positionId)
        positionEntity.epochLast = ONE_BI
        exists = false
    }

    return {
        entity: positionEntity,
        exists: exists,
    }
}
