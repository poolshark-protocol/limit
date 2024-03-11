/* eslint-disable */
import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'
import { LimitPoolFactory as FactoryContract } from '../../generated/templates/LimitPoolTemplate/LimitPoolFactory'
import { SeasonReward } from '../mappings/utils/types'

// -------------- START REQUIRED CONFIG PER DEPLOYMENT --------------
export let FACTORY_ADDRESS = '0xd506193e48f13438e35a1edc4ef5394876b5efa4'
export let RANGE_STAKER_ADDRESS = '0x83eea57c3536a7ec64ead2c67d5b6bfeb6593720'
// used for safe eth pricing
export const STABLE_POOL_ADDRESS = '0xea578474c65f859739c8ec362543eedc04f0d48e'
// --------------  END REQUIRED CONFIG PER DEPLOYMENT  --------------

// determines which token to use for eth <-> usd rate, true means stable is token0 in pool above 
export const STABLE_IS_TOKEN_0 = false

// chain WETH address
export let WETH_ADDRESS = '0xf04bf4e3e8157ba5b91bfda16e21be770e7ac790'

// tokens where USD value is safe to use for globals
export let WHITELISTED_TOKENS: string[] = [
  '0xf04bf4e3e8157ba5b91bfda16e21be770e7ac790', // WETH
  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
]

export let SEASON_0_BLOCK_1: SeasonReward = {
  WHITELISTED_PAIRS: [
  ],
  BLACKLISTED_ADDRESSES: [],
  START_TIME: BigInt.fromString('1707490800'), // 2-09-2024 15:00 GMT - 1707490800
  END_TIME: BigInt.fromString('1710514800')    // 3-15-2024 15:00 GMT - 1710514800
}

export let SEASON_0_BLOCK_2: SeasonReward = {
  WHITELISTED_PAIRS: [
  ],
  BLACKLISTED_ADDRESSES: [],
  START_TIME: BigInt.fromString('1710514800'), // 3-15-2024 15:00 GMT - 1710514800
  END_TIME: BigInt.fromString('1712674800')    // 4-09-2024 15:00 GMT - 1712674800
}

// used for safe eth pricing 
export let STABLE_COINS: string[] = [
    '0xa9e1ab5e6878621F80E03A4a5F8FB3705F4FFA2B', // DAI
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