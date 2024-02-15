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
export let WETH_ADDRESS = '0x4200000000000000000000000000000000000006'

// tokens where USD value is safe to use for globals
export let WHITELISTED_TOKENS: string[] = [
  '0x4200000000000000000000000000000000000006', // WETH
  '0xd988097fb8612cc24eec14542bc03424c656005f', // USDC
  '0xf0f161fda2712db8b566946122a5af183995e2ed', // USDT
  '0xe7798f023fc62146e8aa1b36da45fb70855a77ea', // DAI
]

export let WHITELISTED_PAIRS: string[] = [
  // Type 0
  '0xb5fd40e12a35c6afe8dcc48544082ef2cc371aa5', // WETH-USDT 0.1%
  '0xe0691e6803d4fa0d8fa8ee8da7667eb4a6b99415', // WETH-USDC 0.1%
  '0x1a4cadc783f06829df1cff5db0df7288d716c5a1',  // USDC-USDT 0.1%
  // Type 1
  '0x6c827ff250027187a180c059b20299fe3fd35622', // WETH-USDT 0.1%
  '0x3ce675d43195e506e7da2ad4905b178371124eba', // WETH-USDC 0.1%
  '0xe63a6865626c6cfdfcb559ef9592df86d7b0e8e7', // USDC-USDT 0.1%
  // Type 2
  '0xfc16003afdff37580c9de7deeeb87f9c65b6908a', // WETH-USDT 0.1%
  '0xc20b141edd79f912897651eba9a2bca6b17dc7f1', // WETH-USDC 0.1%
  '0x7efec766f18d4b79abf5b550bfe59a1bffb37d95', // USDC-USDT 0.1%
]

export let SEASON_1_START_TIME = BigInt.fromString('1707490800') // 2-09-2024 15:00 GMT - 1707490800
export let SEASON_1_END_TIME = BigInt.fromString('1709996400')   // 3-09-2024 15:00 GMT - 1709996400

// used for safe eth pricing 
export let STABLE_COINS: string[] = [
  '0xd988097fb8612cc24eec14542bc03424c656005f', // USDC
  '0xf0f161fda2712db8b566946122a5af183995e2ed', // USDT
  '0xe7798f023fc62146e8aa1b36da45fb70855a77ea', // DAI
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