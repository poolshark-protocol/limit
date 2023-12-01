import { Address, log } from '@graphprotocol/graph-ts'
import { PoolCreated } from '../../generated/LimitPoolFactory/LimitPoolFactory'
import { LimitPoolTemplate, PositionERC1155Template, RangeStakerTemplate } from '../../generated/templates'
import {
    fetchTokenSymbol,
    fetchTokenName,
    fetchTokenDecimals,
    BIGINT_ONE,
} from './utils/helpers'
import { safeLoadLimitPool, safeLoadLimitPoolFactory, safeLoadLimitPoolToken, safeLoadToken } from './utils/loads'
import { BigInt } from '@graphprotocol/graph-ts'
import { FACTORY_ADDRESS, ONE_BI, RANGE_STAKER_ADDRESS, STABLE_COINS, WETH_ADDRESS } from '../constants/constants'

export function handlePoolCreated(event: PoolCreated): void {
    // grab event parameters
    let poolAddressParam = event.params.pool
    let poolTokenParam = event.params.token
    let poolTypeParam = event.params.poolTypeId.toString()
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

    let token0Pools = token0.pools
    token0Pools.push(poolAddressParam.toHex())
    token0.pools = token0Pools
    
    let token1Pools = token1.pools
    token1Pools.push(poolAddressParam.toHex())
    token1.pools = token1Pools

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
    pool.poolType = poolTypeParam
    pool.poolToken = poolTokenParam
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

    // update token0 whitelisted pools for usd price
    if (STABLE_COINS.includes(token1.id) || token1.id == WETH_ADDRESS) {
        if (!STABLE_COINS.includes(token0.id) && token0.id != WETH_ADDRESS) {
            let whitelistPools = token0.whitelistPools
            whitelistPools.push(poolAddressParam.toHex())
            token0.whitelistPools = whitelistPools
        }
    }

    // update token1 whitelisted pools for usd price
    if (STABLE_COINS.includes(token0.id) || token0.id == WETH_ADDRESS) {
        if (!STABLE_COINS.includes(token1.id) && token1.id != WETH_ADDRESS) {
            let whitelistPools = token1.whitelistPools
            whitelistPools.push(poolAddressParam.toHex())
            token1.whitelistPools = whitelistPools
        }
    }

    let loadPoolToken = safeLoadLimitPoolToken(poolTokenParam.toHex())
    let poolToken = loadPoolToken.entity
    poolToken.pool = poolAddressParam.toHex()

    pool.save()
    factory.save()
    token0.save()
    token1.save()
    poolToken.save()

    // tracked events based on template
    LimitPoolTemplate.create(poolAddressParam)
    PositionERC1155Template.create(poolTokenParam)
    if (factory.poolCount.equals(BIGINT_ONE)) {
        RangeStakerTemplate.create(Address.fromString(RANGE_STAKER_ADDRESS))
    }
}
