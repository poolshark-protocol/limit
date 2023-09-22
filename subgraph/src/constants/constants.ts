/* eslint-disable */
import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'
import { LimitPoolFactory as FactoryContract } from '../../generated/templates/LimitPoolTemplate/LimitPoolFactory'
export let FACTORY_ADDRESS = '0x2d21b6f89779f32b9632cea38c650dad3b925ed9'
export let WETH_ADDRESS = '0x0bfaaafa6e8fb009cd4e2bd3693f2eec2d18b053'

// tokens where USD value is safe to use for globals
export let WHITELIST_TOKENS: string[] = [
  '0x0bfaaafa6e8fb009cd4e2bd3693f2eec2d18b053', //WETH
  '0x19bee8e887a5db5cf20a841eb4daacbcacf14b1b', //DAI
]

// used for safe eth pricing 
export let STABLE_COINS: string[] = [
  '0x19bee8e887a5db5cf20a841eb4daacbcacf14b1b', //DAI
]

// used for safe eth pricing 
export const STABLE_POOL_ADDRESS = '0x269f5926e2c2dac208ca0d2bb0ed624287e8237d'

// determines which token to use for eth <-> usd rate, true means stable is token0 in pool above 
export const STABLE_IS_TOKEN_0 = false

// minimum eth required in pool to count usd values towards global prices 
export let MINIMUM_ETH_LOCKED = BigDecimal.fromString('0')

// pool that breaks with subgraph logic 
export const ERROR_POOL = '0x0000000000000000000000000000000000000000'

export let ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)
export let ZERO_BD = BigDecimal.fromString('0')
export let ONE_BD = BigDecimal.fromString('1')
export let TWO_BD = BigDecimal.fromString('2')
export let BI_18 = BigInt.fromI32(18)

export let factoryContract = FactoryContract.bind(Address.fromString(FACTORY_ADDRESS))