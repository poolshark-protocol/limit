/* eslint-disable */
import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'
import { LimitPoolFactory as FactoryContract } from '../../generated/templates/LimitPoolTemplate/LimitPoolFactory'
export let FACTORY_ADDRESS = '0x1b215002e688135549cc0290d6cf1f94e3aa425c'
export let WETH_ADDRESS = '0xefb283ef3167ca2ee9d93b201af15e2af3f6e8c7'

// tokens where USD value is safe to use for globals
export let WHITELIST_TOKENS: string[] = [
  '0xefb283ef3167ca2ee9d93b201af15e2af3f6e8c7', //WETH
  '0x19bee8e887a5db5cf20a841eb4daacbcacf14b1b', //DAI
  '0xebff7a98149b4774c9743c5d1f382305fe5422c9' //USDC
]

export let WHITELISTED_PAIRS: string[] = [
  '0xebff7a98149b4774c9743c5d1f382305fe5422c9-0xefb283ef3167ca2ee9d93b201af15e2af3f6e8c7' // WETH - USDC
]

export let SEASON_1_START_TIME = BigInt.fromString('0')
export let SEASON_1_END_TIME = BigInt.fromString('2000707154')

// used for safe eth pricing 
export let STABLE_COINS: string[] = [
  '0x19bee8e887a5db5cf20a841eb4daacbcacf14b1b', //DAI
  '0xebff7a98149b4774c9743c5d1f382305fe5422c9' //USDC
]

// used for safe eth pricing 
export const STABLE_POOL_ADDRESS = '0x4998545e13a668a884272aaebff14ab21c5b4e89'

// determines which token to use for eth <-> usd rate, true means stable is token0 in pool above 
export const STABLE_IS_TOKEN_0 = true

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