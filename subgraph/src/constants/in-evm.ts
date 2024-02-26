/* eslint-disable */
import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'
import { LimitPoolFactory as FactoryContract } from '../../generated/templates/LimitPoolTemplate/LimitPoolFactory'

// -------------- START REQUIRED CONFIG PER DEPLOYMENT --------------
export let FACTORY_ADDRESS = '0x3fa761492f411ebc64a81fcf3292fdc0b677c00f'
export let RANGE_STAKER_ADDRESS = '0xde95e92dd151c39eb51cfae80fdff4d6c32c1fad'
// used for safe eth pricing
export const STABLE_POOL_ADDRESS = '0x4d08d9ef9322b7c179a6604256c67c4448647844'
// --------------  END REQUIRED CONFIG PER DEPLOYMENT  --------------

// determines which token to use for eth <-> usd rate, true means stable is token0 in pool above 
export const STABLE_IS_TOKEN_0 = false
export const STABLE_TOKEN_DECIMALS = '6'

// chain WETH address
export let WETH_ADDRESS = '0x4c3a213bd5e8c4bd70a8396d6f3c8302571598cd'

// tokens where USD value is safe to use for globals
export let WHITELISTED_TOKENS: string[] = [
  '0x4c3a213bd5e8c4bd70a8396d6f3c8302571598cd', // WINJ
  '0x8358d8291e3bedb04804975eea0fe9fe0fafb147', // USDC
  '0x97423a68bae94b5de52d767a17abcc54c157c0e5'  // USDT
]

export let WHITELISTED_PAIRS: string[] = [
]

export let BLACKLISTED_ADDRESSES: string[] = []

export let SEASON_1_START_TIME = BigInt.fromString('0') // 02-13-2024 0:00 GMT - 1707836400
export let SEASON_1_END_TIME = BigInt.fromString('1709996400') // 3-09-2024 0:00 GMT - 1709996400

// used for safe eth pricing 
export let STABLE_COINS: string[] = [
  '0x8358d8291e3bedb04804975eea0fe9fe0fafb147', // USDC
  '0x97423a68bae94b5de52d767a17abcc54c157c0e5'  // USDT
]

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