/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { gBefore } from '../utils/hooks.test'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { mintSigners20 } from '../utils/token'
import {
  validateMint,
  BN_ZERO,
  validateSwap,
  validateBurn,
  getTickAtPrice,
  getRangeBalanceOf,
  getSnapshot,
  getPrice,
  getRangeLiquidity,
  getTickLiquidity,
} from '../utils/contracts/rangepool'
import { RangePoolState, ZERO_ADDRESS } from '../utils/contracts/limitpool'
import { parseUnits } from 'ethers/lib/utils'
import { validateDeployTge } from '../utils/contracts/poolsharkrouter'

alice: SignerWithAddress
describe('TGE Deployment Tests', function () {
  let tokenAmount: BigNumber
  let token0Decimals: number
  let token1Decimals: number
  let minPrice: BigNumber
  let maxPrice: BigNumber

  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let carol: SignerWithAddress

  ////////// DEBUG FLAGS //////////
  let debugMode           = false
  let balanceCheck        = false

  const liquidityAmount = BigNumber.from('49902591570441687020675')
  const liquidityAmount2 = BigNumber.from('50102591670431696268925')
  const liquidityAmount3 = BigNumber.from('3852877204305891777654')
  const minTickIdx = BigNumber.from('-887272')
  const maxTickIdx = BigNumber.from('887272')

  before(async function () {
    await gBefore()
    let currentBlock = await ethers.provider.getBlockNumber()
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const liquidity = pool.liquidity
    const feeGrowthGlobal0 = pool.feeGrowthGlobal0
    const feeGrowthGlobal1 = pool.feeGrowthGlobal1
    const price = pool.price
    const nearestTick = pool.tickAtPrice

    expect(liquidity).to.be.equal(BN_ZERO)

    minPrice = BigNumber.from('4295128739')
    maxPrice = BigNumber.from('1461446703485210103287273052203988822378723970341')
    token0Decimals = await hre.props.token0.decimals()
    token1Decimals = await hre.props.token1.decimals()
    tokenAmount = ethers.utils.parseUnits('100', token0Decimals)
    tokenAmount = ethers.utils.parseUnits('100', token1Decimals)
    alice = hre.props.alice
    bob = hre.props.bob
    carol = hre.props.carol
  })

  this.beforeEach(async function () {
    await mintSigners20(hre.props.token0, tokenAmount.mul(10), [hre.props.alice, hre.props.bob])
    await mintSigners20(hre.props.token1, tokenAmount.mul(10), [hre.props.alice, hre.props.bob])
  })

  it.skip('token1 - Should calculate liquidity for TGE position', async function () {

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount.div(10),
      sqrtPriceLimitX96: BigNumber.from('2358285847295149069702956253974'), // 2.50 USD per FIN
      balanceInDecrease: BigNumber.from('0'),
      balanceOutIncrease: BigNumber.from('0'),
      revertMessage: '',
    })

    await mintSigners20(hre.props.token0, tokenAmount.mul(1000), [hre.props.alice, hre.props.bob])
    await mintSigners20(hre.props.token1, tokenAmount.mul(1000), [hre.props.alice, hre.props.bob])

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '44850',
      upper: '77040',
      amount0: parseUnits('52000', 18),
      amount1: parseUnits('52000', 18),
      balance0Decrease: BigNumber.from('31568903742987611804'), // 49.84 = ~110495.28 USD
      balance1Decrease: BigNumber.from('51999999999999999999996'), // 40000 = 100000 USD
      liquidityIncrease: BigNumber.from('2555287091759866264142'),
      revertMessage: '',
    })
  })

  it('token1 - Should deploy TGE position', async function () {

    await mintSigners20(hre.props.token0, tokenAmount.mul(55000), [hre.props.alice, hre.props.bob])
    await mintSigners20(hre.props.token1, tokenAmount.mul(55000), [hre.props.alice, hre.props.bob])

    const aliceLiquidity = BigNumber.from('2572549719381782803480')

    const amount0 = BigNumber.from('39168000000000000000')
    const amount1 = BigNumber.from('32271546804490624383438')

    const aliceId = await validateDeployTge({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        lower: '54000', // $10 per FIN
        upper: '77040', // $1 per FIN
        amount0: parseUnits('41', 18),
        amount1: parseUnits('34000', 18),
        balance0Decrease: amount0, // TODO: change to correct value
        balance1Decrease: amount1, // 52k FIN
        liquidityIncrease: aliceLiquidity,
        revertMessage: '',
        stake: true
    })

    await validateBurn({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        lower: '54000', // $10 per FIN
        upper: '77040', // $1 per FIN,
        positionId: aliceId,
        liquidityAmount: aliceLiquidity,
        balance0Increase: amount0.sub(1), // 39.168 ETH
        balance1Increase: amount1.sub(1), // 52k FIN
        revertMessage: '',
        staked: true
    })
  })
});