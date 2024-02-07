/* eslint-disable */
import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'
import { LimitPoolFactory as FactoryContract } from '../../generated/templates/LimitPoolTemplate/LimitPoolFactory'

// -------------- START REQUIRED CONFIG PER DEPLOYMENT --------------
export let FACTORY_ADDRESS = '0x3fa761492f411ebc64a81fcf3292fdc0b677c00f'
export let RANGE_STAKER_ADDRESS = '0x58d8235108e12e6b725a53b57cd0b00c5edee0da'
// used for safe eth pricing
export const STABLE_POOL_ADDRESS = '0xb5fd40e12a35c6afe8dcc48544082ef2cc371aa5'
// --------------  END REQUIRED CONFIG PER DEPLOYMENT  --------------

// determines which token to use for eth <-> usd rate, true means stable is token0 in pool above 
export const STABLE_IS_TOKEN_0 = false
export const STABLE_TOKEN_DECIMALS = '6'

// chain WETH address
export let WETH_ADDRESS = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'

// tokens where USD value is safe to use for globals
export let WHITELISTED_TOKENS: string[] = [
  '0x4200000000000000000000000000000000000006', // WETH
  '0xe7798f023fc62146e8aa1b36da45fb70855a77ea', // DAI
  '0xd988097fb8612cc24eec14542bc03424c656005f', // USDC
  '0xf0f161fda2712db8b566946122a5af183995e2ed'  // USDT
]

//TODO: incentivizing only FIN - WETH 0.3% for now

export let WHITELISTED_PAIRS: string[] = [
]

export let SEASON_1_START_TIME = BigInt.fromString('1709794800') // 3-07-2024 0:00 GMT
export let SEASON_1_END_TIME = BigInt.fromString('1723010400') // 8-07-2024 0:00 GMT

// used for safe eth pricing 
export let STABLE_COINS: string[] = [
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
    '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', // USDC.e
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'  // USDT
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