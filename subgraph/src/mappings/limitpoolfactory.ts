import { log } from '@graphprotocol/graph-ts'
import { PoolCreated } from '../../generated/LimitPoolFactory/LimitPoolFactory'
import { LimitPoolTemplate, PositionERC1155Template } from '../../generated/templates'
import {
    fetchTokenSymbol,
    fetchTokenName,
    fetchTokenDecimals,
} from './utils/helpers'
import { safeLoadBasePrice, safeLoadLimitPool, safeLoadLimitPoolFactory, safeLoadToken } from './utils/loads'
import { BigInt } from '@graphprotocol/graph-ts'
import { FACTORY_ADDRESS, ONE_BI } from './utils/constants'
import { sqrtPriceX96ToTokenPrices, findEthPerToken } from './utils/price'

export function handlePoolCreated(event: PoolCreated): void {
    // grab event parameters
    let poolAddressParam = event.params.pool
    let poolTokenParam = event.params.token
    let poolImplParam = event.params.poolImpl.toHex()
    let tokenImplParam = event.params.tokenImpl.toHex()
    let token0Param = event.params.token0.toHex()
    let token1Param = event.params.token1.toHex()
    let swapFeeParam = BigInt.fromI32(event.params.swapFee)
    let tickSpacingParam = BigInt.fromI32(event.params.tickSpacing)

    // load from store
    let loadLimitPool = safeLoadLimitPool(poolAddressParam.toHex())
    let loadLimitPoolFactory = safeLoadLimitPoolFactory(FACTORY_ADDRESS)
    let loadToken0 = safeLoadToken(token0Param)
    let loadToken1 = safeLoadToken(token1Param)

    let token0 = loadToken0.entity
    let token1 = loadToken1.entity
    let pool = loadLimitPool.entity
    let factory = loadLimitPoolFactory.entity

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

    // pool tokens
    pool.token0 = token0.id
    pool.token1 = token1.id

    // pool setup
    pool.feeTier = swapFeeParam.toString()
    pool.swapFee = swapFeeParam
    pool.tickSpacing = tickSpacingParam
    pool.factory = factory.id
    pool.implementation = poolImplParam.concat(tokenImplParam)
    pool.samplesLength = BigInt.fromString('5')

    // creation stats
    pool.createdAtBlockNumber = event.block.number
    pool.createdAtTimestamp   = event.block.timestamp
    pool.updatedAtBlockNumber = event.block.number
    pool.updatedAtTimestamp   = event.block.timestamp

    token0.txnCount = token0.txnCount.plus(ONE_BI)
    token1.txnCount = token1.txnCount.plus(ONE_BI)
    factory.poolCount = factory.poolCount.plus(ONE_BI)
    factory.txnCount  = factory.txnCount.plus(ONE_BI)

    pool.save()
    factory.save()
    token0.save()
    token1.save()

    // tracked events based on template
    LimitPoolTemplate.create(poolAddressParam)
    PositionERC1155Template.create(poolTokenParam)
}
