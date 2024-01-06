import { BigInt } from "@graphprotocol/graph-ts"
import { Swap, Token } from "../../generated/schema"
import { STABLE_POOL_ADDRESS } from "../constants/arbitrum"
import { STABLE_IS_TOKEN_0 } from "../constants/arbitrum-goerli"
import { safeLoadBasePrice, safeLoadLimitPool } from "./utils/loads"
import { sqrtPriceX96ToTokenPrices } from "./utils/price"

export function handleV3Swap(event: Swap): void {
    let loadPool = safeLoadLimitPool(STABLE_POOL_ADDRESS)

    let pool = loadPool.entity

    pool.poolPrice = event.priceAfter

    let token0: Token; let token1: Token;

    if (STABLE_IS_TOKEN_0) {
        token0 = new Token('USDC')
        token0.decimals = BigInt.fromString('6')
        token1 = new Token('WETH')
        token1.decimals = BigInt.fromString('18')
    } else {
        token0 = new Token('WETH')
        token0.decimals = BigInt.fromString('18')
        token1 = new Token('USDC')
        token1.decimals = BigInt.fromString('6')
    }

    let prices = sqrtPriceX96ToTokenPrices(pool.poolPrice, token0, token1)
    pool.price0 = prices[0]
    pool.price1 = prices[1]

    let loadBasePrice = safeLoadBasePrice('eth', pool)
    let basePrice = loadBasePrice.entity
    basePrice.save()
}