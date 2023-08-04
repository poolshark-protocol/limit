import { log } from '@graphprotocol/graph-ts'
import { PoolCreated } from '../../generated/LimitPoolFactory/LimitPoolFactory'
import { LimitPoolTemplate } from '../../generated/templates'
import {
    fetchTokenSymbol,
    fetchTokenName,
    fetchTokenDecimals,
} from './utils/helpers'
import { safeLoadLimitPool, safeLoadLimitPoolFactory, safeLoadTick, safeLoadToken, safeLoadFeeTier } from './utils/loads'
import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'
import { FACTORY_ADDRESS, ONE_BI } from './utils/constants'
import { FeeTier } from '../../generated/schema'

export function handlePoolCreated(event: PoolCreated): void {
    // grab event parameters
    let poolAddressParam = event.params.pool
    let implementationParam = event.params.implementation
    let token0Param = event.params.token0
    let token1Param = event.params.token1
    let tickSpacingParam = BigInt.fromI32(event.params.tickSpacing)

    // load from store
    let loadLimitPool = safeLoadLimitPool(poolAddressParam.toHex())
    let loadLimitPoolFactory = safeLoadLimitPoolFactory(FACTORY_ADDRESS)
    let loadToken0 = safeLoadToken(event.params.token0.toHexString())
    let loadToken1 = safeLoadToken(event.params.token1.toHexString())

    let token0 = loadToken0.entity
    let token1 = loadToken1.entity
    let pool = loadLimitPool.entity
    let factory = loadLimitPoolFactory.entity

    // fetch info if null
    if (!loadToken0.exists) {
        token0.symbol = fetchTokenSymbol(event.params.token0)
        token0.name = fetchTokenName(event.params.token0)
        let decimals = fetchTokenDecimals(event.params.token0)
        // bail if we couldn't figure out the decimals
        if (decimals === null) {
            log.debug('token0 decimals null', [])
            return
        }
        token0.decimals = decimals
    }

    if (!loadToken0.exists) {
        token1.symbol = fetchTokenSymbol(event.params.token1)
        token1.name = fetchTokenName(event.params.token1)
        let decimals = fetchTokenDecimals(event.params.token1)
        // bail if we couldn't figure out the decimals
        if (decimals === null) {
            log.debug('token1 decimals null', [])
            return
        }
        token1.decimals = decimals
    }

    pool.tickSpacing = tickSpacingParam
    pool.token0 = token0.id
    pool.token1 = token1.id
    pool.createdAtBlockNumber = event.block.number
    pool.createdAtTimestamp   = event.block.timestamp
    pool.updatedAtBlockNumber = event.block.number
    pool.updatedAtTimestamp   = event.block.timestamp

    factory.poolCount = factory.poolCount.plus(ONE_BI)
    factory.txnCount  = factory.txnCount.plus(ONE_BI)

    pool.save()
    factory.save()
    token0.save()
    token1.save()

    // create the tracked contract based on the template
    LimitPoolTemplate.create(event.params.pool)
}
