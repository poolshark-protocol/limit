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
describe('TickQuoter Tests', function () {
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

  it('pool - Should quote ticks', async function () {
    // 82169065928981720851271231910
    // 177159557114295710296101716160
    if (debugMode) await getPrice()
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('7705754408611783555308')
    const bobLiquidity = BigNumber.from('12891478442546858467877')
    const bobLiquidity2 = BigNumber.from('4901161634764542438930')

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: true,
        amount: tokenAmount,
        sqrtPriceLimitX96: BigNumber.from('82169065928981720851271231910'),
        balanceInDecrease: BigNumber.from('0'), // token1 increase in pool
        balanceOutIncrease: BigNumber.from('0'), // token0 decrease in pool
        revertMessage: '',
    })
  
    if (debugMode) await getPrice()
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('90970905615086187051'),
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount,
      sqrtPriceLimitX96: BigNumber.from('82255474610179467046984074964'),
      balanceInDecrease: BigNumber.from('8404133769503785680'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('7801206245756322179'), // token0 decrease in pool
      revertMessage: '',
    })

    const bobId = await validateMint({
      signer: hre.props.bob,
      recipient: hre.props.bob.address,
      lower: '600',
      upper: '800',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('31002239349424966834'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      liquidityIncrease: bobLiquidity,
      revertMessage: '',
    })

    // quote ticks
    const populatedTicks = await hre.props.tickQuoter.getTickDataInWord(hre.props.limitPool.address, 0)

    expect(populatedTicks[0][0]).to.be.equal(1000)
    expect(populatedTicks[1][0]).to.be.equal(800)
    expect(populatedTicks[2][0]).to.be.equal(600)
    expect(populatedTicks[3][0]).to.be.equal(500)
    expect(populatedTicks.length).to.be.equal(4)

    if (debugMode) await getSnapshot(bobId)
    if (debugMode) console.log('FIRST BURN')
    await validateBurn({
      signer: hre.props.bob,
      lower: '600',
      upper: '800',
      positionId: bobId,
      liquidityAmount: BigNumber.from('3867443532764057540363'),
      burnPercent: ethers.utils.parseUnits('3', 37),
      balance0Increase: BigNumber.from('9300671804827490049'),
      balance1Increase: BigNumber.from('29999999999999999999'),
      revertMessage: '',
    })
    if (debugMode) await getSnapshot(bobId)
    if (debugMode) console.log('SECOND BURN')
    await validateBurn({
      signer: hre.props.bob,
      lower: '600',
      upper: '800',
      positionId: bobId,
      liquidityAmount: BigNumber.from('9024034909782800927514'),
      burnPercent: ethers.utils.parseUnits('1', 38),
      balance0Increase: BigNumber.from('21701567544597476783'),
      balance1Increase: BigNumber.from('69999999999999999999'),
      revertMessage: '',
    })
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity,
      burnPercent: ethers.utils.parseUnits('1', 38),
      balance0Increase: BigNumber.from('92198793754243677819'),
      balance1Increase: BigNumber.from('99375039384589972730'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })
})