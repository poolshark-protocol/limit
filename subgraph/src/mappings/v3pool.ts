import { BigInt, log } from "@graphprotocol/graph-ts"
import { Token } from "../../generated/schema"
import { STABLE_POOL_ADDRESS, STABLE_IS_TOKEN_0 } from "../constants/constants"
import { safeLoadBasePrice, safeLoadLimitPool } from "./utils/loads"
import { sqrtPriceX96ToTokenPrices } from "./utils/price"
import { Initialize, Swap } from "../../generated/v3EthUsdcPool/v3Pool"

export function handleV3Initialize(event: Initialize): void {
    let loadPool = safeLoadLimitPool(STABLE_POOL_ADDRESS)

    log.warning("swap event process", [])

    let pool = loadPool.entity

    log.warning("pool entity", [])

    pool.poolPrice = event.params.sqrtPriceX96

    log.warning("price after", [])

    let token0: Token; let token1: Token;

    if (STABLE_IS_TOKEN_0) {
        log.warning("usdc token", [])
        token0 = new Token('USDC')
        log.warning("usdc decimals", [])
        token0.decimals = BigInt.fromString('6')
        log.warning("weth token", [])
        token1 = new Token('WETH')
        log.warning("weth decimals", [])
        token1.decimals = BigInt.fromString('18')
    } else {
        token0 = new Token('WETH')
        token0.decimals = BigInt.fromString('18')
        token1 = new Token('USDC')
        token1.decimals = BigInt.fromString('6')
    }

    log.warning("about to convert to prices", [])

    let prices = sqrtPriceX96ToTokenPrices(pool.poolPrice, token0, token1)
    pool.price0 = prices[0]
    pool.price1 = prices[1]

    log.warning("after price convert", [])

    let loadBasePrice = safeLoadBasePrice('eth', pool)
    let basePrice = loadBasePrice.entity
    basePrice.save()
}

export function handleV3Swap(event: Swap): void {
    let loadPool = safeLoadLimitPool(STABLE_POOL_ADDRESS)

    log.warning("swap event process", [])

    let pool = loadPool.entity

    log.warning("pool entity", [])

    pool.poolPrice = event.params.sqrtPriceX96

    log.warning("price after", [])

    let token0: Token; let token1: Token;

    if (STABLE_IS_TOKEN_0) {
        log.warning("usdc token", [])
        token0 = new Token('USDC')
        log.warning("usdc decimals", [])
        token0.decimals = BigInt.fromString('6')
        log.warning("weth token", [])
        token1 = new Token('WETH')
        log.warning("weth decimals", [])
        token1.decimals = BigInt.fromString('18')
    } else {
        token0 = new Token('WETH')
        token0.decimals = BigInt.fromString('18')
        token1 = new Token('USDC')
        token1.decimals = BigInt.fromString('6')
    }

    log.warning("about to convert to prices", [])

    let prices = sqrtPriceX96ToTokenPrices(pool.poolPrice, token0, token1)
    pool.price0 = prices[0]
    pool.price1 = prices[1]

    log.warning("after price convert", [])

    let loadBasePrice = safeLoadBasePrice('eth', pool)
    let basePrice = loadBasePrice.entity
    basePrice.save()
}