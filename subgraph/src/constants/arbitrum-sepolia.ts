/* eslint-disable */
import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'
import { LimitPoolFactory as FactoryContract } from '../../generated/templates/LimitPoolTemplate/LimitPoolFactory'
import { SeasonReward } from '../mappings/utils/types'

// -------------- START REQUIRED CONFIG PER DEPLOYMENT --------------
export let FACTORY_ADDRESS = '0x8e40c68b7546efd009a1a300c92e25da3c8725dc'
export let RANGE_STAKER_ADDRESS = '0x62e0671022af1b2e705f08b282767c57d29c7c4c'
// used for safe eth pricing
export const STABLE_POOL_ADDRESS = '0x58801ff62fdff4e23007a563c8c0e7ce799d598b'
// --------------  END REQUIRED CONFIG PER DEPLOYMENT  --------------

// determines which token to use for eth <-> usd rate, true means stable is token0 in pool above 
export const STABLE_IS_TOKEN_0 = false
export const STABLE_TOKEN_DECIMALS = '18'

// chain WETH address
export let WETH_ADDRESS = '0x414b73f989e7ca0653b5c98186749a348405e6d5'

export let SEASON_0_BLOCK_1: SeasonReward = {
  WHITELISTED_PAIRS: [],
  BLACKLISTED_ADDRESSES: [],
  START_TIME: BigInt.fromString('1707490800'), // 2-09-2024 15:00 GMT - 1707490800
  END_TIME: BigInt.fromString('1710514800')    // 3-15-2024 15:00 GMT - 1710514800
}

export let SEASON_0_BLOCK_2: SeasonReward = {
  WHITELISTED_PAIRS: [],
  BLACKLISTED_ADDRESSES: [],
  START_TIME: BigInt.fromString('1710514800'), // 3-15-2024 15:00 GMT - 1710514800
  END_TIME: BigInt.fromString('1712674800')    // 4-09-2024 15:00 GMT - 1712674800
}

// tokens where USD value is safe to use for globals
export let WHITELISTED_TOKENS: string[] = [
  '0x414b73f989e7ca0653b5c98186749a348405e6d5', // WETH
  '0x9f479560cd8a531e6c0fe04521cb246264fe6b71', // DAI
]

// used for safe eth pricing 
export let STABLE_COINS: string[] = [
    '0x9f479560cd8a531e6c0fe04521cb246264fe6b71', // DAI
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