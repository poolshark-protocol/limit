/* eslint-disable */
import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'
import { LimitPoolFactory as FactoryContract } from '../../generated/templates/LimitPoolTemplate/LimitPoolFactory'
import { SeasonReward } from '../mappings/utils/types'

// -------------- START REQUIRED CONFIG PER DEPLOYMENT --------------
export let FACTORY_ADDRESS = '0x3fa761492f411ebc64a81fcf3292fdc0b677c00f'
export let RANGE_STAKER_ADDRESS = '0xebf57cb31ed38e6ccb53fb71ba246ea549c42e51'
// used for safe eth pricing
export const STABLE_POOL_ADDRESS = '0x118a84e97620829a6a9666d41acc9e91edf32bd6'
// --------------  END REQUIRED CONFIG PER DEPLOYMENT  --------------

// determines which token to use for eth <-> usd rate, true means stable is token0 in pool above 
export const STABLE_IS_TOKEN_0 = true
export const STABLE_TOKEN_DECIMALS = '6'

// chain WETH address
export let WETH_ADDRESS = '0x5300000000000000000000000000000000000004'

// tokens where USD value is safe to use for globals
export let WHITELISTED_TOKENS: string[] = [
  '0x5300000000000000000000000000000000000004', // WETH
  '0xca77eb3fefe3725dc33bccb54edefc3d9f764f97', // DAI
  '0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4', // USDC
  '0xf610a9dfb7c89644979b4a0f27063e9e7d7cda32', // wstETH
  '0xf55bec9cafdbe8730f096aa55dad6d22d44099df'  // USDT
]

export let SEASON_0_BLOCK_1: SeasonReward = {
  WHITELISTED_PAIRS: [
    '0x622fa26556cbc082816311c0b22c668a4a566fe5', // WETH-USDT 0.1%
    '0xb14917888ba92937be3d89094f83a62904ebc9dd', // WETH-USDT 0.1%
  ],
  BLACKLISTED_ADDRESSES: [],
  START_TIME: BigInt.fromString('1707490800'), // 2-09-2024 15:00 GMT - 1707490800
  END_TIME: BigInt.fromString('1709996400')    // 3-09-2024 15:00 GMT - 1709996400
}

export let SEASON_0_BLOCK_2: SeasonReward = {
  WHITELISTED_PAIRS: [
    // Type 2
    '0xb14917888ba92937be3d89094f83a62904ebc9dd', // WETH-USDT 0.1%
  ],
  BLACKLISTED_ADDRESSES: [],
  START_TIME: BigInt.fromString('1709996400'), // 3-09-2024 15:00 GMT - 1709996400
  END_TIME: BigInt.fromString('1712674800')    // 4-09-2024 15:00 GMT - 1712674800
}

// used for safe eth pricing 
export let STABLE_COINS: string[] = [
    '0xca77eb3fefe3725dc33bccb54edefc3d9f764f97', // DAI
    '0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4', // USDC
    '0xf55bec9cafdbe8730f096aa55dad6d22d44099df'  // USDT 
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