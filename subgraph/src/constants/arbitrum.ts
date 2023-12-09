/* eslint-disable */
import { BigInt, BigDecimal, Address } from '@graphprotocol/graph-ts'
import { LimitPoolFactory as FactoryContract } from '../../generated/templates/LimitPoolTemplate/LimitPoolFactory'

export let FACTORY_ADDRESS = '0x9f479560cd8a531e6c0fe04521cb246264fe6b71'
export let RANGE_STAKER_ADDRESS = '0xde95e92dd151c39eb51cfae80fdff4d6c32c1fad'
export let WETH_ADDRESS = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'

// tokens where USD value is safe to use for globals
export let WHITELISTED_TOKENS: string[] = [
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // WETH
  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', // USDC.e
  '0x5979d7b546e38e414f7e9822514be443a4800529', // wstETH
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'  // USDT
]

export let WHITELISTED_PAIRS: string[] = [
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1-0xaf88d065e77c8cc2239327c5edb3a432268e5831', // WETH - USDC
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831-0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', // USDC - USDC.e
  '0x5979d7b546e38e414f7e9822514be443a4800529-0x82af49447d8a07e3bd95bd0d56f35241523fbab1', // wstETH - WETH
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1-0x912ce59144191c1204e64559fe8253a0e49e6548', // WETH - ARB
  '0x912ce59144191c1204e64559fe8253a0e49e6548-0xaf88d065e77c8cc2239327c5edb3a432268e5831', // ARB - USDC
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'  // USDT - USDC
]

export let SEASON_1_START_TIME = BigInt.fromString('1674345600') // 1-22-2024 0:00 GMT
export let SEASON_1_END_TIME = BigInt.fromString('1684713600') // 5-22-2024 0:00 GMT

// used for safe eth pricing 
export let STABLE_COINS: string[] = [
    '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', // DAI
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC
    '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8', // USDC.e
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'  // USDT
]

// used for safe eth pricing 
export const STABLE_POOL_ADDRESS = '0xb3db76a4e1986a433dc3f8fcb7fdc3b2cdcf490f'

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