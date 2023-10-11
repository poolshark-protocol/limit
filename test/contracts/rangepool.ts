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
import { RangePoolState } from '../utils/contracts/limitpool'

alice: SignerWithAddress
describe('RangePool Exact In Tests', function () {
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

//   it.skip('token1 - test dynamic fee', async function () {
//     const aliceLiquidity = BigNumber.from('44721359549995793929')

//     await validateMint({
//       signer: hre.props.alice,
//       recipient: hre.props.alice.address,
//       lower: '-887260',
//       upper: '887260',
//       amount0: tokenAmount,
//       amount1: tokenAmount,
//       balance0Decrease: BigNumber.from('19999999999999999998'),
//       balance1Decrease: tokenAmount,
//       liquidityIncrease: aliceLiquidity,
//       revertMessage: '',
//     })

//     // console.log('before swap')
//     if (debugMode) await getPrice()
//     await validateSwap({
//       signer: hre.props.alice,
//       recipient: hre.props.alice.address,
//       zeroForOne: true,
//       amount: tokenAmount,
//       sqrtPriceLimitX96: BigNumber.from('79386769463160146968577785965'), 
//       balanceInDecrease: BigNumber.from('24632010676919545389'),
//       balanceOutIncrease: BigNumber.from('55051139927543752558'),
//       revertMessage: '',
//     })
//     if (debugMode) await getPrice()

//     await validateSwap({
//         signer: hre.props.alice,
//         recipient: hre.props.alice.address,
//         zeroForOne: false,
//         amount: tokenAmount,
//         sqrtPriceLimitX96: BigNumber.from('79545693927487839655804034729'), 
//         balanceInDecrease: BigNumber.from('89706966373347543'),
//         balanceOutIncrease: BigNumber.from('89170362825211319'),
//         revertMessage: '',
//     })

//     await validateSwap({
//         signer: hre.props.alice,
//         recipient: hre.props.alice.address,
//         zeroForOne: true,
//         amount: tokenAmount,
//         sqrtPriceLimitX96: BigNumber.from('79386769463160146968577785965'), 
//         balanceInDecrease: BigNumber.from('89170362825211320'),
//         balanceOutIncrease: BigNumber.from('89482698957414173'),
//         revertMessage: '',
//       })

//     // console.log('after swap')
//     if (debugMode) await getPrice()
//     if (debugMode) await getSnapshot(hre.props.alice.address, 20, 60)

//     // if (debugMode) await getSample()

//     if (debugMode) await getRangeBalanceOf(hre.props.alice.address, 20, 60)
//     if (debugMode) await getSnapshot(hre.props.alice.address, 20, 60)
//     await validateBurn({
//       signer: hre.props.alice,
//       lower: '-887260',
//       upper: '887260',
//       liquidityAmount: aliceLiquidity,
//       balance0Increase: BigNumber.from('44632010676919545386'),
//       balance1Increase: BigNumber.from('44949084339872180808'),
//       revertMessage: '',
//     })
//     // if (debugMode) await getSample()
//     if (debugMode) await getSnapshot(hre.props.alice.address, 20, 60)
//     if (debugMode){
//       console.log('after burn')
//       await getRangeBalanceOf(hre.props.alice.address, 20, 60)
//     }

//     if (balanceCheck) {
//       console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
//       console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
//     }
//   })

  it('token1 - Should mint, swap, and burn 14', async function () {

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '20',
      upper: '60',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BN_ZERO,
      balance1Decrease: tokenAmount,
      liquidityIncrease: liquidityAmount,
      revertMessage: '',
    })

    // console.log('before swap')
    if (debugMode) await getPrice()
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount.div(10),
      sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650'),
      balanceInDecrease: BigNumber.from('10000000000000000000'),
      balanceOutIncrease: BigNumber.from('10053126651581942488'),
      revertMessage: '',
    })

    // console.log('after swap')
    if (debugMode) await getPrice()
    if (debugMode) await getSnapshot(aliceId)

    // if (debugMode) await getSample()

    if (debugMode) await getRangeBalanceOf(hre.props.alice.address, aliceId)
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '20',
      upper: '60',
      positionId: aliceId,
      liquidityAmount: liquidityAmount,
      balance0Increase: tokenAmount.div(10).sub(1),
      balance1Increase: BigNumber.from('89946873348418057510'),
      revertMessage: '',
    })
    // if (debugMode) await getSample()
    if (debugMode) await getSnapshot(aliceId)
    if (debugMode){
      console.log('after burn')
      await getRangeBalanceOf(hre.props.alice.address, aliceId)
    }

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token0 - Should mint, swap, and burn 14', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('55483175795606442088768')

    if (debugMode) await getPrice()

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '20',
      upper: '60',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('11118295473149384055'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    if (debugMode) await getTickAtPrice()

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount,
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('99620837864637861357'),
      balanceOutIncrease: BigNumber.from('99949999999999999999'),
      revertMessage: '',
    })

    if (debugMode) await getTickAtPrice()

    if (debugMode) await getRangeBalanceOf(hre.props.alice.address, aliceId)
    if (debugMode) await getSnapshot(aliceId)
    // if (debugMode) await getSample()
    await validateBurn({
      signer: hre.props.alice,
      lower: '20',
      upper: '60',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity,
      balance0Increase: BigNumber.from('110739133337787245411'),
      balance1Increase: BigNumber.from('49999999999999999'),
      revertMessage: '',
    })

    if (debugMode){
      console.log('after burn')
      await getRangeBalanceOf(hre.props.alice.address, aliceId)
    }

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token0 - Should mint and burn position 14', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('419027207938949970576')
    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: true,
        amount: tokenAmount.div(10),
        sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650'),
        balanceInDecrease: BigNumber.from('0'),
        balanceOutIncrease: BigNumber.from('0'),
        revertMessage: '',
    })
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '10000',
      upper: '20000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('0'),
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount,
      sqrtPriceLimitX96: ((await hre.props.limitPool.globalState()).pool).price.add(3),
      balanceInDecrease: BigNumber.from('0'),
      balanceOutIncrease: BigNumber.from('0'),
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount,
      sqrtPriceLimitX96: ((await hre.props.limitPool.globalState()).pool).price,
      balanceInDecrease: BigNumber.from('0'),
      balanceOutIncrease: BigNumber.from('0'),
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount,
      sqrtPriceLimitX96: ((await hre.props.limitPool.globalState()).pool).price.sub(2),
      balanceInDecrease: BigNumber.from('0'),
      balanceOutIncrease: BigNumber.from('0'),
      revertMessage: '',
    })

 //   if (debugMode) await getSample()
    if (debugMode) await getRangeBalanceOf(hre.props.alice.address, aliceId)
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '10000',
      upper: '20000',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity,
      balance0Increase: tokenAmount.sub(1),
      balance1Increase: BN_ZERO,
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token0 - Should add in-range liquidity 17', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '10000',
      upper: '20000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('0'),
      liquidityIncrease: BigNumber.from('419027207938949970576'),
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount,
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('100000000000000000000'),
      balanceOutIncrease: BigNumber.from('32121736932093337716'),
      revertMessage: '',
    })

 //   if (debugMode) await getSample()
    if (debugMode) await getTickAtPrice()
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '10000',
      upper: '20000',
      positionId: aliceId,
      liquidityAmount: BigNumber.from('419027207938949970576'),
      balance0Increase: BigNumber.from('67878263067906662282'),
      balance1Increase: BigNumber.from('100000000000000000000').sub(1),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token1 - Should mint, swap, and burn 17', async function () {
    const liquidityAmount2 = BigNumber.from('690841800621472456980')

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '20000',
      upper: '30000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: tokenAmount,
      balance1Decrease: BN_ZERO,
      liquidityIncrease: liquidityAmount2,
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount.div(10),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('10000000000000000000'),
      balanceOutIncrease: BigNumber.from('1345645380966504669'),
      revertMessage: '',
    })
 //   if (debugMode) await getSample()
    if (debugMode) await getRangeBalanceOf(hre.props.alice.address, aliceId)
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '20000',
      upper: '30000',
      liquidityAmount: liquidityAmount2,
      positionId: aliceId,
      balance0Increase: BigNumber.from('98654354619033495329'),
      balance1Increase: tokenAmount.div(10).sub(1),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token1 - Should mint, swap, and burn position while in range 17', async function () {
    if (debugMode) await getTickAtPrice()
    const aliceLiquidity = BigNumber.from('1577889144107833733009')
    const aliceTokenAmount = BigNumber.from('1577889144107833733009')
    const aliceLiquidity2 = BigNumber.from('1590926220637829792707')
    const aliceTokenAmount2 = BigNumber.from('1590919832480500238123')
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '25000',
      upper: '30000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: tokenAmount,
      balance1Decrease: BN_ZERO,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount.div(10),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('10000000000000000000'),
      balanceOutIncrease: BigNumber.from('819054826219841040'),
      revertMessage: '',
    })

    if (debugMode) await getSnapshot(aliceId)

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '25000',
      upper: '30000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('99999590267720750455'), // collects fees
      balance1Decrease: BigNumber.from('10082623526365456124'),
      liquidityIncrease: aliceLiquidity2,
      positionId: aliceId,
      revertMessage: '',
    })

    if (debugMode) await getRangeBalanceOf(hre.props.alice.address, aliceId)
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '25000',
      upper: '30000',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity.add(aliceLiquidity2),
      burnPercent: ethers.utils.parseUnits('1',38),
      balance0Increase: BigNumber.from('199180535441500909413'),
      balance1Increase: BigNumber.from('20082623526365456123'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token0 - Should autocompound fungible position 17', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('3852877204305891777654')
    const aliceToken2 = BigNumber.from('7703597268822239417406')
    const aliceLiquidity2 = BigNumber.from('7705754408611783555308')
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BN_ZERO,
      balance1Decrease: tokenAmount,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount.div(2),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('50000000000000000000'),
      balanceOutIncrease: BigNumber.from('54487289918860678020'),
      revertMessage: '',
    })

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('90943648341489958598'),
      positionId: aliceId,
      liquidityIncrease: BigNumber.from('7705754408611783555308'),
      revertMessage: '',
      collectRevertMessage: ''
    })

    if (debugMode) await getSnapshot(aliceId)
 //   if (debugMode) await getSample()
    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity.add(aliceLiquidity2),
      burnPercent: ethers.utils.parseUnits('1',38),
      balance0Increase: BigNumber.from('150000000000000000000').sub(1),
      balance1Increase: BigNumber.from('136456358422629280576'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token0 - Should autocompound fungible position and add liquidity 17', async function () {
    const aliceLiquidity = BigNumber.from('7705754408611783555308')
    const aliceLiquidity2 = BigNumber.from('3852877204305891777654')
    const aliceToken2 = BigNumber.from('3851350676919383233343')

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: true,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: BigNumber.from('82169065928981720851271231910'),
        balanceInDecrease: BN_ZERO,
        balanceOutIncrease: BN_ZERO,
        revertMessage: '',
    })

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
      amount: tokenAmount.div(2),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('50000000000000000000'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('46172841786879071879'), // token0 decrease in pool
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount.div(4),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('25000000000000000000'),
      balanceOutIncrease: BigNumber.from('27122499921707680271'),
      revertMessage: '',
    })
 //   if (debugMode) await getSample()
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount.mul(2),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('86165162340599335983'),
      balanceOutIncrease: BigNumber.from('78764658213120928119'),
      revertMessage: '',
    })
    if (debugMode) await getSnapshot(aliceId)
    if (debugMode) await getTickAtPrice()

    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId, 
      liquidityAmount: BigNumber.from('-522759688204781649'), // liquidity increase
      burnPercent: ethers.utils.parseUnits('0',38),
      balance0Increase: BigNumber.from('62500000000000000'), // fees collected
      balance1Increase: BigNumber.from('0'),
      revertMessage: '',
    })

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('0'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      positionId: aliceId,
      liquidityIncrease: aliceLiquidity2,
      revertMessage: '',
      collectRevertMessage: ''
    })

    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId, 
      liquidityAmount: BigNumber.from('11559154372605880114611'),
      burnPercent: ethers.utils.parseUnits('1',38),
      balance0Increase: BigNumber.from('0'), // fees collected on second mint
      balance1Increase: BigNumber.from('300013568033977842760'),
      revertMessage: '',
    })
 //   if (debugMode) await getSample()
    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token1 - Should mint position inside the other 17', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: false,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: maxPrice,
        balanceInDecrease: BN_ZERO,
        balanceOutIncrease: BN_ZERO,
        revertMessage: '',
    })

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('0'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      liquidityIncrease: BigNumber.from('3852877204305891777654'),
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount.div(2),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('50000000000000000000'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('54487289918860678020'), // token0 decrease in pool
      revertMessage: '',
    })

    if (debugMode) await getTickAtPrice()

    const bobId = await validateMint({
      signer: hre.props.bob,
      recipient: hre.props.bob.address,
      lower: '200',
      upper: '600',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('0'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      liquidityIncrease: BigNumber.from('4901161634764542438934'),
      revertMessage: '',
    })
    if (debugMode) await getSnapshot(aliceId)

    await validateBurn({
      signer: hre.props.bob,
      lower: '200',
      upper: '600',
      positionId: bobId,
      liquidityAmount: BigNumber.from('4901161634764542438934'),
      burnPercent: ethers.utils.parseUnits('1',38),
      balance0Increase: BigNumber.from('0'),
      balance1Increase: tokenAmount.sub(1),
      revertMessage: '',
    })
    if (debugMode) await getSnapshot(aliceId)

    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId,
      liquidityAmount: BigNumber.from('3852877204305891777654'),
      balance0Increase: BigNumber.from('50000000000000000000').sub(1),
      balance1Increase: BigNumber.from('45512710081139321979').sub(1),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('pool - Should mint position inside the other 17', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('7705754408611783555308')
    const bobLiquidity = BigNumber.from('12891478442546858467877')
    const bobLiquidity2 = BigNumber.from('4901161634764542438930')

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

  it('pool - Should mint position inside the other and not steal fee share 17:: KEBABSEC', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('3852877204305891777654')
    const bobLiquidity = BigNumber.from('10356653617731432349576')
    // console.log('FIRST SWAP')
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount,
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('0'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('0'), // token0 decrease in pool
      revertMessage: '',
    })

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('0'),
      balance1Decrease: tokenAmount,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })
    // console.log('SECOND SWAP')
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount,
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('92774696514123048139'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('99949999999999999999'), // token0 decrease in pool
      revertMessage: '',
    })

    const bobId = await validateMint({
      signer: hre.props.bob,
      recipient: hre.props.bob.address,
      lower: '600',
      upper: '800',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: tokenAmount,
      balance1Decrease: BN_ZERO,
      liquidityIncrease: bobLiquidity,
      revertMessage: '',
    })
    if (debugMode) await getSnapshot(bobId)
    await validateBurn({
      signer: hre.props.bob,
      lower: '600',
      upper: '800',
      positionId: bobId,
      liquidityAmount: bobLiquidity.div(2),
      burnPercent: ethers.utils.parseUnits('5', 37),
      balance0Increase: BigNumber.from('50000000000000000000').sub(1),
      balance1Increase: BN_ZERO,
      revertMessage: '',
    })
    if (debugMode) await getSnapshot(bobId)
    await validateBurn({
      signer: hre.props.bob,
      lower: '600',
      upper: '800',
      positionId: bobId,
      liquidityAmount: bobLiquidity.div(2),
      balance0Increase: BigNumber.from('50000000000000000000').sub(1),
      balance1Increase: BN_ZERO,
      revertMessage: '',
    })
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity,
      balance0Increase: BigNumber.from('92774696514123048138'),
      balance1Increase: BigNumber.from('49999999999999999'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('pool - Should not underflow when crossing when exiting and entering position range 17:: KEBABSEC', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('4152939701311089823384')
    const bobLiquidity = BigNumber.from('10356653617731432349576')

    if (debugMode) await getPrice()
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: tokenAmount,
      balance1Decrease: BN_ZERO,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount.mul(2),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('107788010909609440040'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('99949999999999999999'), // token0 decrease in pool
      revertMessage: '',
    })

    // if (debugMode) await getSnapshot(hre.props.bob.address, 600, 800)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount.mul(2),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('100000000000000000000'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('107734116904154635318'), // token0 decrease in pool
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount.mul(2),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('107788010909609440040'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('99949999999999999999'), // token0 decrease in pool
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity,
      burnPercent: ethers.utils.parseUnits('1', 38), 
      balance0Increase: BigNumber.from('99999999999999999'),
      balance1Increase: BigNumber.from('107841904915064244759'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('pool - Should not skip crossing tickAtPrice 111', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('288859894188086395983120')
    const aliceLiquidity2 = BigNumber.from('130948265789136120265')
    const aliceTokenAmount3 = BigNumber.from('289238769153527571630')
    const aliceLiquidity3 = BigNumber.from('289244426214719608262')
    const aliceTokenAmount4 = BigNumber.from('867716307460582714869')
    const aliceLiquidity4 = BigNumber.from('867733278644158824788')

    if (debugMode) await getPrice()

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: false,
        amount: BigNumber.from('1000120000000000000000'),
        sqrtPriceLimitX96: maxPrice,
        balanceInDecrease: BigNumber.from('0'), // token1 increase in pool
        balanceOutIncrease: BigNumber.from('0'), // token0 decrease in pool
        revertMessage: '',
    })

    await mintSigners20(hre.props.token0, tokenAmount.mul(1e6), [hre.props.alice, hre.props.bob])
    await mintSigners20(hre.props.token1, tokenAmount.mul(1e6), [hre.props.alice, hre.props.bob])
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('1000120000000000000000'),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('0'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('0'), // token0 decrease in pool
      revertMessage: '',
    })
    //console.log(0xdec118d63b65cfd3e8598a0a993fe6d455bf6b6ad8e30603b9bfe83b3c31d2c5)   
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '73140',
      upper: '76020',
      amount0: tokenAmount.mul(10),
      amount1: BN_ZERO,
      balance0Decrease: tokenAmount.mul(10),
      balance1Decrease: BN_ZERO,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })
    // await getTickFeeGrowth(73140)
    // await getTickFeeGrowth(76020)
    // await getFeeGrowthGlobal()
    // await getRangeFeeGrowth(73140, 76020)
    // await getPositionFeeGrowth(73140, 76020)

    //console.log(0x0ce063e85ccdeea4f80aed91034aab9310cec387ac572e7366fdf2264741c4d1)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('1000120000000000000000'),
      sqrtPriceLimitX96: BigNumber.from('3077067665772502614228114341887'),
      balanceInDecrease: BigNumber.from('1000120000000000000000'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('666077964566722076'), // token0 decrease in pool
      revertMessage: '',
    })
    // await getTickFeeGrowth(73140)
    // await getTickFeeGrowth(76020)
    // await getFeeGrowthGlobal()
    // await getRangeFeeGrowth(73140, 76020)
    // await getPositionFeeGrowth(73140, 76020)

    //console.log(0x11fa356690c58c71c0abaedd6400f5011f624cdcf657c569d623e97d6592187e)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('1000120000000000000000'),
      sqrtPriceLimitX96: BigNumber.from('3077067665772502614228114341887'),
      balanceInDecrease: BigNumber.from('1000120000000000000000'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('665958920765498692'), // token0 decrease in pool
      revertMessage: '',
    })
    //console.log(0xf0df1cade6825075311fbaf6a7c15b73478fc9ff0cfaa1e52185c3d908e827fb)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('1496453379000000000000'),
      sqrtPriceLimitX96: BigNumber.from('3077754393416758970167012098048'),
      balanceInDecrease: BigNumber.from('1496453379000000000000'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('996234651079624794'), // token0 decrease in pool
      revertMessage: '',
    })
    //console.log(0x560d01f19e9cdb296813ee610cbd6d7c8a0fb78e9e8740697aa7bc10ad7f1e4e)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('1000000000000000000'),
      sqrtPriceLimitX96: BigNumber.from('3061995978261174520047757950975'),
      balanceInDecrease: BigNumber.from('0'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('0'), // token0 decrease in pool
      revertMessage: '',
    })
    //console.log(0x256395b982182064b119c1971988dd9808c7d65b9d444ec20ccdd055193b5b02)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('1000000000000000000'),
      sqrtPriceLimitX96: BigNumber.from('3061995978261174520047757950975'),
      balanceInDecrease: BigNumber.from('1000000000000000000'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('1500606953415818538340'), // token0 decrease in pool
      revertMessage: '',
    })
    //console.log(0x2d6ccd80a36be175bfbaa6b967563d1b90a3bb7411adf1d28d90475c2c060216)
    await validateBurn({
      signer: hre.props.alice,
      lower: '73140',
      upper: '76020',
      positionId: aliceId,
      liquidityAmount: BN_ZERO.sub(BigNumber.from('336888226423966071')),
      burnPercent: BN_ZERO,
      balance0Increase: BigNumber.from('0'),
      balance1Increase: BigNumber.from('748351718674010363'),
      revertMessage: '',
    })
    //console.log(0xe3140e07b139361118b959e57cefe2a2992d991a35bb73f14c302eeac78bf9b5)
    const aliceId2 = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '66120',
      upper: '80160',
      amount0: BigNumber.from('1000000000000000000'),
      amount1: BigNumber.from('1502429956147627474636'),
      balance0Decrease: BigNumber.from('1000000000000000000'),
      balance1Decrease: BigNumber.from('1502429956147627474624'),
      liquidityIncrease: aliceLiquidity2,
      revertMessage: '',
      collectRevertMessage: ''
    })
    //console.log(0x87cc302dd8d81d41c6d59fd1519e95ab900139af01d6934b0fd3bd313c98a337)
    await validateBurn({
      signer: hre.props.alice,
      lower: '66120',
      upper: '80160',
      positionId: aliceId2,
      liquidityAmount: BN_ZERO,
      balance0Increase: BigNumber.from('0'),
      balance1Increase: BigNumber.from('0'),
      revertMessage: '',
    })
    //console.log(0xdbccb0a55ff2841f7d0778f80fded3b48c0493202b21bac0ab071b619ac836bd)

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '73140',
      upper: '76020',
      amount0: BigNumber.from('1000000000000000000'),
      amount1: BigNumber.from('1997991949702276994'),
      balance0Decrease: BigNumber.from('1000000000000000000'),
      balance1Decrease: BigNumber.from('1997991949702276994'),
      positionId: aliceId,
      liquidityIncrease: aliceLiquidity3,
      revertMessage: '',
      collectRevertMessage: ''
    })

    //console.log(0x3657fa31430cc2cdb4b8576cbc07fe3b0765562ef5a02774d096702d3ba0c092)
    await validateBurn({
      signer: hre.props.alice,
      lower: '73140',
      upper: '76020',
      positionId: aliceId,
      liquidityAmount: BN_ZERO,
      balance0Increase: BigNumber.from('0'),
      balance1Increase: BigNumber.from('0'),
      revertMessage: '',
    })
    //console.log(0x6ecc898e89ba37480f21d02d998af048690115c142cefc32028321b6599004de)
    if (debugMode) await getTickAtPrice()
    await validateBurn({
      signer: hre.props.alice,
      lower: '73140',
      upper: '76020',
      positionId: aliceId,
      burnPercent: BigNumber.from('100032954481854984095420499972189286'),
      liquidityAmount: BigNumber.from('289244763213965801677'),
      // positionLiquidityChange: BigNumber.from('130991419111625017'),
      balance0Increase: BigNumber.from('1000001165101954093'),
      balance1Increase: BigNumber.from('1997994277566601854'),
      revertMessage: '',
    })
    //console.log(0xf56c6732aec4578f3068358f213ac61548744890c9b59a9b4d94deea7095e007)
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '73140',
      upper: '76020',
      amount0: BigNumber.from('3000000000000000000'),
      amount1: BigNumber.from('5993975849106830981'),
      balance0Decrease: BigNumber.from('3000000000000000000'),
      balance1Decrease: BigNumber.from('5993975849106830981'),
      positionId: aliceId,
      liquidityIncrease: aliceLiquidity4,
      revertMessage: '',
      collectRevertMessage: ''
    })

    //console.log(0xe5d03332de5694a46b370f9423dbd8008f148445d32a3e6d810dafc2ad10c830)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('1000000000000000000'),
      sqrtPriceLimitX96: BigNumber.from('3061588000433258657988919427072'),
      balanceInDecrease: BigNumber.from('1000000000000000000'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('1500205148221113272257'), // token0 decrease in pool
      revertMessage: '',
    })

    //console.log('0x5e9bdcfaedba76aa371e1877dd10b998f20fcc243ff739320ef6deff77ee2704')
    const aliceTokenAmount5 = BigNumber.from('866834175038504185339')
    const aliceLiquidity5 = BigNumber.from('866868248112395911647')
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '73140',
      upper: '76020',
      amount0: BigNumber.from('3000000000000000000'),
      amount1: BigNumber.from('5993975849106830981'),
      balance0Decrease: BigNumber.from('3000000000000000000'),
      balance1Decrease: BigNumber.from('749020064777949622'),
      positionId: aliceId,
      liquidityIncrease: aliceLiquidity5,
      revertMessage: '',
      collectRevertMessage: ''
    })

    //console.log('0xa05d59b9bd417d6489d1aff5c5b6efe5e61443e30a6a2f0d40482c2683a40d7e')
    const aliceTokenAmount6 = BigNumber.from('2879560327228172705714')
    const aliceLiquidity6 = BigNumber.from('2879560960970776983364')
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '66120',
      upper: '80160',
      amount0: BigNumber.from('22000000000000000000'),
      amount1: BigNumber.from('33023622513667392995848'),
      balance0Decrease: BigNumber.from('22000000000000000000'),
      balance1Decrease: BigNumber.from('33023622001503280340587'),
      positionId: aliceId2,
      liquidityIncrease: aliceLiquidity6,
      revertMessage: '',
      collectRevertMessage: ''
    })

    //console.log('0xd4e4fb14cc804685f0c35893cea7171a1dfa37b28f4719bf1cacc80321d2fa6e')
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '66120',
      upper: '80160',
      amount0: BigNumber.from('22000000000000000000'),
      amount1: BigNumber.from('33023622513667392995848'),
      balance0Decrease: BigNumber.from('22000000000000000000'),
      balance1Decrease: BigNumber.from('33023622340543288990059'),
      positionId: aliceId2,
      liquidityIncrease: aliceLiquidity6,
      revertMessage: '',
      collectRevertMessage: ''
    })

    //console.log('0x0c2cf2c87629df41bc1472e3984cded9df86aec0e4e3398ef9ab1f30cd7a6afc')
    await validateBurn({
      signer: hre.props.alice,
      lower: '66120',
      upper: '80160',
      burnPercent: BigNumber.from('0'),
      liquidityAmount: BigNumber.from('0'),
      positionId: aliceId2,
      balance0Increase: BigNumber.from('0'),
      balance1Increase: BigNumber.from('0'),
      revertMessage: '',
    })
    // await getFeeGrowthGlobal()
    // await getRangeFeeGrowth(73140, 76020)
    // console.log('BEFORE SWAP')
    //console.log('0x4d3e3bb5150a0874e0764067579d7ec5f09a72ae6686c3712c9095e9af067222')
    // This swap causes the underflow on snapshot
    // await getTickAtPrice()
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('5000000000000000000'),
      sqrtPriceLimitX96: BigNumber.from('3059588122704193012744629256192'),
      balanceInDecrease: BigNumber.from('815798405335420362'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('1221404429444282149253'), // token0 decrease in pool
      revertMessage: '',
    })

    // await getTickAtPrice()
    // await getFeeGrowthGlobal()
    // await getRangeFeeGrowth(73140, 76020)
    // console.log('END SWAP')
    // await getSnapshot(hre.props.alice.address, 73140, 76020)
    //console.log('0xfac2526e6bb1b4a3906826cf3e2f152c6fb0f2f0d7affe8fc69701f848d71897')
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('5000000000000000000'),
      sqrtPriceLimitX96: BigNumber.from('3075057850633752459897890406400'),
      balanceInDecrease: BigNumber.from('5000000000000000000'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('3351015920029701'), // token0 decrease in pool
      revertMessage: '',
    })

    //console.log('0x4950b3696a62cdc4e9584c81911a4c3b6f6cc5c4013ea8454286a27d150d6f69')
    const aliceTokenAmount7 = BigNumber.from('621480049120650311492')
    const aliceLiquidity7 = BigNumber.from('621480049120650311492')
    const aliceId3 = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '66960',
      upper: '80520',
      amount0: BigNumber.from('5000000000000000000'),
      amount1: BigNumber.from('6437962369913333422010'),
      balance0Decrease: BigNumber.from('5000000000000000000'),
      balance1Decrease: BigNumber.from('6324961650864055083801'),
      liquidityIncrease: aliceLiquidity7,
      revertMessage: '',
      collectRevertMessage: ''
    })

    // await getSnapshot(hre.props.alice.address, 73140, 76020)
    await validateBurn({
      signer: hre.props.alice,
      lower: '73140',
      upper: '76020',
      positionId: aliceId,
      burnPercent: ethers.utils.parseUnits('1', 38),
      liquidityAmount: BigNumber.from('290594832266070128492211'),
      balance0Increase: BigNumber.from('1006006157700985848708'),
      balance1Increase: BigNumber.from('251276830103852465'),
      revertMessage: '',
    })
    await validateBurn({
      signer: hre.props.alice,
      lower: '66120',
      upper: '80160',
      positionId: aliceId2,
      burnPercent: ethers.utils.parseUnits('1', 38),
      liquidityAmount: BigNumber.from('5890070187730690086993'),
      balance0Increase: BigNumber.from('45478016986915742291'),
      balance1Increase: BigNumber.from('66834894511150225438327'),
      revertMessage: '',
    })
    await validateBurn({
      signer: hre.props.alice,
      lower: '66960',
      upper: '80520',
      positionId: aliceId3,
      burnPercent: ethers.utils.parseUnits('1', 38),
      liquidityAmount: aliceLiquidity7,
      balance0Increase: BigNumber.from('4999999999999999999'),
      balance1Increase: BigNumber.from('6324961650864055083800'),
      revertMessage: '',
    })
    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  // tests adding liquidity when pool price is at tick price for lower
  // 1. move price to lower
  // 2. mint / burn / mint
  // 3. cross up on swap
  // 4. cross up to tick price at upper
  // 5. remove liquidity
    // tests adding liquidity when pool price is at tick price for upper
  // 1. move price to upper
  // 2. mint / burn / mint
  // 3. cross down on swap
  // 4. cross down to tick price at lower
  // 5. remove liquidity
  it('pool - Should skip crossing tick when swap ends on range tick 23', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('4152939701311089823384')
    const bobLiquidity = BigNumber.from('10356653617731432349576')

    if (debugMode) await getPrice()

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: true,
        amount: tokenAmount.mul(2),
        sqrtPriceLimitX96: BigNumber.from('81233731461783161732293370115'),
        balanceInDecrease: BigNumber.from('0'), //1
        balanceOutIncrease: BigNumber.from('0'),
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
      balance0Decrease: tokenAmount,
      balance1Decrease: BN_ZERO,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount.mul(2),
      sqrtPriceLimitX96: BigNumber.from('83290069058676223003182343270'),
      balanceInDecrease: BigNumber.from('107788010909609440040'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('99949999999999999999'), // token0 decrease in pool
      revertMessage: '',
    })

    const bobLiquidity2 =  BigNumber.from('3852877204305891777654')
    const bobTokenAmount = BigNumber.from('3850999243092097547693')

    const bobId = await validateMint({
        signer: hre.props.bob,
        recipient: hre.props.bob.address,
        lower: '500',
        upper: '1000',
        amount0: tokenAmount,
        amount1: tokenAmount,
        balance0Decrease: BN_ZERO,
        balance1Decrease: tokenAmount,
        liquidityIncrease: bobLiquidity2,
        revertMessage: '',
        collectRevertMessage: ''
      })

    // if (debugMode) await getSnapshot(hre.props.bob.address, 600, 800)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount.mul(2),
      sqrtPriceLimitX96: BigNumber.from('81233731461783161732293370115'),
      balanceInDecrease: BigNumber.from('192774696514123048139'), // 100000000000000000002
      balanceOutIncrease: BigNumber.from('207684116904154635318'), // 107734116904154635317
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId,
      liquidityAmount: BigNumber.from('4152939701311089823384'),
      burnPercent: ethers.utils.parseUnits('1', 38),
      balance0Increase: BigNumber.from('100049999999999999998'),
      balance1Increase: BigNumber.from('53894005454804720'),
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.bob,
      lower: '500',
      upper: '1000',
      positionId: bobId,
      liquidityAmount: BigNumber.from('3852877204305891777654'),
      burnPercent: ethers.utils.parseUnits('1', 38),
      balance0Increase: BigNumber.from('92774696514123048138'),
      balance1Increase: BigNumber.from('50000000000000000'),
      revertMessage: '',
    })

    if (debugMode) {
        await getRangeLiquidity()
        await getTickLiquidity(500)
        await getTickLiquidity(1000)
    }

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('Steal Fees From existing Liquidity Providers ', async function () {

    if (debugMode) await getPrice()

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: true,
        amount: tokenAmount.mul(2),
        sqrtPriceLimitX96: BigNumber.from('177159557114295710296101716160'),
        balanceInDecrease: BigNumber.from('0'), //1
        balanceOutIncrease: BigNumber.from('0'),
        revertMessage: '',
    })

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: false,
        amount: tokenAmount.mul(2),
        sqrtPriceLimitX96: BigNumber.from('177159557114295710296101716160'),
        balanceInDecrease: BigNumber.from('0'), //1
        balanceOutIncrease: BigNumber.from('0'),
        revertMessage: '',
    })

    const aliceId = await validateMint({ // Regualr user mints position
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        lower: '-800000',
        upper: '800000',
        amount0: tokenAmount,
        amount1: tokenAmount,
        balance0Decrease: BigNumber.from('19999999999999999848'),
        balance1Decrease: BigNumber.from('100000000000000000000'),
        liquidityIncrease: BigNumber.from('44721359549995794013'),
        revertMessage: '',
    })

    await validateSwap({ // Next 11 swaps are just to increase the total fees
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: true,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650'),
        balanceInDecrease: BigNumber.from('24596364934905253800'),
        balanceOutIncrease: BigNumber.from('55125718852470931154'),
        revertMessage: '',
    })

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: false,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650000'),
        balanceInDecrease: BigNumber.from('50000000000000000000'),
        balanceOutIncrease: BigNumber.from('23497952294453035875'),
        revertMessage: '',
    })
    if (debugMode) console.log("COMPLETED SWAP 1");
    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: true,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650'),
        balanceInDecrease: BigNumber.from('23509707148027049401'),
        balanceOutIncrease: BigNumber.from('49974999999999999999'),
        revertMessage: '',
    })
    if (debugMode) console.log("COMPLETED SWAP 2");
    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: false,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650000'),
        balanceInDecrease: BigNumber.from('50000000000000000000'),
        balanceOutIncrease: BigNumber.from('23497952294453035875'),
        revertMessage: '',
    })
    if (debugMode) console.log("COMPLETED SWAP 3");
    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: true,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650'),
        balanceInDecrease: BigNumber.from('23509707148027049401'),
        balanceOutIncrease: BigNumber.from('49974999999999999999'),
        revertMessage: '',
    })


    if (debugMode) console.log("COMPLETED SWAP 4");

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: false,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650000'),
        balanceInDecrease: BigNumber.from('50000000000000000000'),
        balanceOutIncrease: BigNumber.from('23497952294453035875'),
        revertMessage: '',
    })
    if (debugMode) console.log("COMPLETED SWAP 5");
    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: true,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650'),
        balanceInDecrease: BigNumber.from('23509707148027049401'),
        balanceOutIncrease: BigNumber.from('49974999999999999999'),
        revertMessage: '',
    })

    if (debugMode) console.log("COMPLETED SWAP 6");

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: false,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650000'),
        balanceInDecrease: BigNumber.from('50000000000000000000'),
        balanceOutIncrease: BigNumber.from('23497952294453035875'),
        revertMessage: '',
    })
    if (debugMode) console.log("COMPLETED SWAP 7");
    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: true,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650'),
        balanceInDecrease: BigNumber.from('23509707148027049401'),
        balanceOutIncrease: BigNumber.from('49974999999999999999'),
        revertMessage: '',
    })

    if (debugMode) console.log("COMPLETED SWAP 8");

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: false,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650000'),
        balanceInDecrease: BigNumber.from('50000000000000000000'),
        balanceOutIncrease: BigNumber.from('23497952294453035875'),
        revertMessage: '',
    })
    if (debugMode) console.log("COMPLETED SWAP 9");
    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: true,
        amount: tokenAmount.div(2),
        sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650'),
        balanceInDecrease: BigNumber.from('23509707148027049401'),
        balanceOutIncrease: BigNumber.from('49974999999999999999'),
        revertMessage: '',
    })


    if (debugMode) console.log("COMPLETED SWAP 10");

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: true,
        amount: tokenAmount.mul(10),
        sqrtPriceLimitX96: BigNumber.from('79228162514264337593543950336'),
        // price of 0.0100561345224524713899788940744814759251857394238956922671728497
        // 99.441788270362343889826722172121635503849758386463058323384720125 token1 per token0
        // token0 - 1.00
        // token1 - 0.0100561345224524713899788940744814759251857394238956922671728497
        balanceInDecrease: BigNumber.from('124994615090540176'),
        balanceOutIncrease: BigNumber.from('125282277308272918'),
        revertMessage: '',
    })

    if (debugMode) console.log("COMPLETED SWAP 11");

    if (debugMode) await getTickAtPrice()

    const bobId = await validateMint({ // Attacker mints position
        signer: hre.props.bob,
        recipient: hre.props.bob.address,
        lower: '-800000',
        upper: '800000',
        amount0: tokenAmount,
        amount1: tokenAmount,
        balance0Decrease: BigNumber.from('100000000000000000000'),
        balance1Decrease: BigNumber.from('100000000000000000000'),
        liquidityIncrease: BigNumber.from('100000000000000000425'),
        revertMessage: '',
    })

    await validateBurn({ // Attacker burns and get out more then they put in ~0.077 eth  with 11 swaps
        signer: hre.props.bob,
        lower: '-800000',
        upper: '800000',
        liquidityAmount: BigNumber.from('100000000000000000425'),
        positionId: bobId,
        burnPercent: ethers.utils.parseUnits('1', 38),
        balance0Increase: BigNumber.from('99999999999999999999'),
        balance1Increase: BigNumber.from('99999999999999999999'),
        revertMessage: '',
    })

    await validateBurn({ // Attacker burns and get out more then they put in ~0.077 eth  with 11 swaps
        signer: hre.props.alice,
        lower: '-800000',
        upper: '800000',
        liquidityAmount: BigNumber.from('44721359549995794013'),
        positionId: aliceId,
        burnPercent: ethers.utils.parseUnits('1', 38),
        balance0Increase: BigNumber.from('44780133817865861446'),
        balance1Increase: BigNumber.from('44873998870220795925'),
        revertMessage: '',
    })

    if (debugMode) console.log("COMPLETED BURN");
    if (balanceCheck) {
        console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
        console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it.only('token0 - Should add out-of-range liquidity 17', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool

    let positionCount = 0

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount.div(2),
      sqrtPriceLimitX96: BigNumber.from('79228162514264337593543950336'),
      balanceInDecrease: BigNumber.from('0'),
      balanceOutIncrease: BigNumber.from('0'),
      revertMessage: '',
    })

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '-510',
      upper: '13500',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('5129385544815469135'),
      liquidityIncrease: BigNumber.from('203738023811206695441'),
      revertMessage: '',
      collectRevertMessage: ''
    })

    ++positionCount;

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount.mul(2),
      sqrtPriceLimitX96: BigNumber.from('3169126500570573503741758013440'),
      balanceInDecrease: BigNumber.from('196396669539406744346'),
      balanceOutIncrease: BigNumber.from('99949999999999999999'),
      revertMessage: '',
    })

    console.log('pool price:', (await hre.props.limitPool.globalState()).pool.price.toString())

    const snapshot = await getSnapshot(aliceId)

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '-510',
      upper: '13500',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('-49999999999999999'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      liquidityIncrease: BigNumber.from('101097609302211592992'),
      revertMessage: '',
      collectRevertMessage: '',
      positionId: aliceId
    })

    // for
    return

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '-510',
      upper: '13500',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('0'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      liquidityIncrease: BigNumber.from('101097609302211592992'),
      revertMessage: '',
      collectRevertMessage: '',
      positionId: aliceId
    })
  })

})

describe('RangePool Exact Out Tests', function () {
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

  it('token1 - Should mint, swap, and burn 27', async function () {
    if (debugMode) await getPrice()
    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: false,
        amount: BigNumber.from('10053126651581942488'),
        sqrtPriceLimitX96: BigNumber.from('177159557114295710296101716160'),
        balanceInDecrease: BN_ZERO,
        balanceOutIncrease: BN_ZERO,
        revertMessage: '',
        exactIn: false
    })
    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: false,
        amount: BigNumber.from('10053126651581942488'),
        sqrtPriceLimitX96: BigNumber.from('177159557114295710296101716160'),
        balanceInDecrease: BN_ZERO,
        balanceOutIncrease: BN_ZERO,
        revertMessage: '',
        exactIn: false
    })
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '20',
      upper: '60',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BN_ZERO,
      balance1Decrease: tokenAmount,
      liquidityIncrease: liquidityAmount,
      revertMessage: '',
    })
    if (debugMode) console.log('before swap')

    //177159557114295710296101716160
    //177159557114295710296101716160
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('10053126651581942488'),
      sqrtPriceLimitX96: BigNumber.from('79450223072165328185028130650'),
      balanceInDecrease: BigNumber.from('9999996495038162400'),
      balanceOutIncrease: BigNumber.from('10053126651581942488'),
      revertMessage: '',
      exactIn: false
    })

    if (debugMode) console.log('after swap')
    if (debugMode) await getPrice()

    //79450223072165328185028130650
    //79450223072165328185028600164
    // after swap pool prices slightly different between exactIn vs. exactOut
    if (debugMode) await getPrice()
    if (debugMode) await getSnapshot(aliceId)

 //   if (debugMode) await getSample()

    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '20',
      upper: '60',
      positionId: aliceId,
      liquidityAmount: liquidityAmount,
      balance0Increase: BigNumber.from('9999996495038162398'),
      balance1Increase: BigNumber.from('89946873348418057511'),
      revertMessage: '',
    })
 //   if (debugMode) await getSample()
    if (debugMode) await getSnapshot(aliceId)
    if (debugMode){
      console.log('after burn')
      await getRangeBalanceOf(hre.props.alice.address, aliceId)
    }

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token0 - Should mint, swap, and burn 27', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
                                         //55483175795606442088768
    const aliceLiquidity = BigNumber.from('55480073639846370355193')

    if (debugMode) await getPrice()

    //79450223072165328185028130650
    //79450223072165328185028600164
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '20',
      upper: '60',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('11112113877292633490'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    if (debugMode) await getTickAtPrice()

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('99949999999999999999').add(1),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('99620713257021056821'),
      balanceOutIncrease: BigNumber.from('99950000000000000000'),
      revertMessage: '',
      exactIn: false
    })
    //79450223072165328185028130650
    //79450223072165328185028600164
    if (debugMode) await getTickAtPrice()

    if (debugMode) await getRangeBalanceOf(hre.props.alice.address, aliceId)
    if (debugMode) await getSnapshot(aliceId)
 //   if (debugMode) await getSample()
    await validateBurn({
      signer: hre.props.alice,
      lower: '20',
      upper: '60',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity,
      balance0Increase: BigNumber.from('110732827134313690308'),
      balance1Increase: BigNumber.from('49999999999999999'),
      revertMessage: '',
    })

    if (debugMode){
      console.log('after burn')
      await getRangeBalanceOf(hre.props.alice.address, aliceId)
    }

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token0 - Should mint and burn fungible position 27', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('419027207938949970576')
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '10000',
      upper: '20000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('0'),
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount,
      sqrtPriceLimitX96: ((await hre.props.limitPool.globalState()).pool).price.add(3),
      balanceInDecrease: BigNumber.from('0'),
      balanceOutIncrease: BigNumber.from('0'),
      revertMessage: '',
      exactIn: false
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount,
      sqrtPriceLimitX96: ((await hre.props.limitPool.globalState()).pool).price,
      balanceInDecrease: BigNumber.from('0'),
      balanceOutIncrease: BigNumber.from('0'),
      revertMessage: '',
      exactIn: false
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount,
      sqrtPriceLimitX96: ((await hre.props.limitPool.globalState()).pool).price.sub(2),
      balanceInDecrease: BigNumber.from('0'),
      balanceOutIncrease: BigNumber.from('0'),
      revertMessage: '',
      exactIn: false
    })

 //   if (debugMode) await getSample()
    if (debugMode) await getRangeBalanceOf(hre.props.alice.address, aliceId)
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '10000',
      upper: '20000',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity,
      balance0Increase: tokenAmount.sub(1),
      balance1Increase: BN_ZERO,
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token0 - Should add in-range fungible liquidity 27', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '10000',
      upper: '20000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('0'),
      liquidityIncrease: BigNumber.from('419027207938949970576'),
      revertMessage: '',
      collectRevertMessage: ''
    })
    // newPrice should be 
    //149529532964933956329726026822
    //149518711477920329243524244887
    //130621891405341611593710811006
    //130621891405341611593710811006
    //32137805835010843138
    //32137805835010843138 <--- this is the number we need
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('32121736932093337716'),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('99992737978594473994'),
      balanceOutIncrease: BigNumber.from('32121736932093337716'),
      revertMessage: '',
      exactIn: false
    })

 //   if (debugMode) await getSample()
    if (debugMode) await getTickAtPrice()
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '10000',
      upper: '20000',
      positionId: aliceId,
      liquidityAmount: BigNumber.from('419027207938949970576'),
      balance0Increase: BigNumber.from('67878263067906662283'),
      balance1Increase: BigNumber.from('99992737978594473994').sub(2),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token1 - Should mint, swap, and burn 27', async function () {
    const liquidityAmount2 = BigNumber.from('690841800621472456980')

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '20000',
      upper: '30000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: tokenAmount,
      balance1Decrease: BN_ZERO,
      liquidityIncrease: liquidityAmount2,
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('1345645380966504669'),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('9999970873298888311'),
      balanceOutIncrease: BigNumber.from('1345645380966504669'),
      revertMessage: '',
      exactIn: false
    })
 //   if (debugMode) await getSample()
    if (debugMode) await getRangeBalanceOf(hre.props.alice.address, aliceId)
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '20000',
      upper: '30000',
      liquidityAmount: liquidityAmount2,
      positionId: aliceId,
      balance0Increase: BigNumber.from('98654354619033495330'),
      balance1Increase: BigNumber.from('9999970873298888309'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token1 - Should mint, swap, and burn position while in range 27', async function () {
    if (debugMode) await getTickAtPrice()
    const aliceLiquidity = BigNumber.from('1577889144107833733009')
    const aliceLiquidity2 = BigNumber.from('1590919648268254591971')
    const aliceTokenAmount = BigNumber.from('3168803709036157621537')
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '25000',
      upper: '30000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: tokenAmount,
      balance1Decrease: BN_ZERO,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('819054826219841040'),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('9999988420706563158'),
      balanceOutIncrease: BigNumber.from('819054826219841040'),
      revertMessage: '',
      exactIn: false
    })

    if (debugMode) await getSnapshot(aliceId)

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '25000',
      upper: '30000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      positionId: aliceId,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('10072533937345556097'), // fees earned
      liquidityIncrease: aliceLiquidity2,
      revertMessage: '',
    })

 //   if (debugMode) await getSample()
    if (debugMode) await getRangeBalanceOf(hre.props.alice.address, aliceId)
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '25000',
      upper: '30000',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity.add(aliceLiquidity2),
      burnPercent: ethers.utils.parseUnits('1', 38),
      balance0Increase: BigNumber.from('199180945173780158959'),
      balance1Increase: BigNumber.from('20072522358052119252'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token0 - Should autocompound fungible position 27', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('3852877204305891777654')
    const aliceToken2 = BigNumber.from('7707585892198226745783')
    const aliceLiquidity2 = BigNumber.from('7709661802936670729190')

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BN_ZERO,
      balance1Decrease: tokenAmount,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
    })
    
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('54487289918860678020'),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('49999646436367931756'),
      balanceOutIncrease: BigNumber.from('54487289918860678020'),
      revertMessage: '',
      exactIn: false
    })

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('99975012670446592738'), // fees earned
      balance1Decrease: BigNumber.from('91071576864309669836'),
      positionId: aliceId,
      liquidityIncrease: aliceLiquidity2,
      revertMessage: '',
      collectRevertMessage: ''
    })

    if (debugMode) await getSnapshot(aliceId)
 //   if (debugMode) await getSample()
    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity.add(aliceLiquidity2),
      balance0Increase: BigNumber.from('149974659106814524492'),
      balance1Increase: BigNumber.from('136584286945448991815'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token0 - Should autocompound fungible position and add liquidity 27', async function () {
    const aliceLiquidity = BigNumber.from('7709661802936670729190')
    const aliceLiquidity2 = BigNumber.from('3852877204305891777654')
    const aliceToken2 = BigNumber.from('3851307766638370338521')
    const compoundedLiquidity = BigNumber.from('2622891197525561771')

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('54487289918860678020'),
      sqrtPriceLimitX96: BigNumber.from('82169626430546568102374149457'),
      balanceInDecrease: BigNumber.from('0'),
      balanceOutIncrease: BigNumber.from('0'),
      revertMessage: '',
      exactIn: false
    })

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('91071576864309669836'),
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('46172841786879071879'),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('50000356889087798629'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('46172841786879071879'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('27122499921707680271'),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('24999880178757095042'),
      balanceOutIncrease: BigNumber.from('27122499921707680271'),
      revertMessage: '',
      exactIn: false
    })
 //   if (debugMode) await getSample()
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount.mul(2),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('86220057308985928921'),
      balanceOutIncrease: BigNumber.from('78814544698635265993'),
      revertMessage: '',
      exactIn: false
    })
    if (debugMode) await getSnapshot(aliceId)

    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId, 
      liquidityAmount: BigNumber.from('-2622891197525561771'), // liquidity increase
      burnPercent: ethers.utils.parseUnits('0',38),
      balance0Increase: BigNumber.from('12493693242757168'), // fees collected
      balance1Increase: BigNumber.from('0'),
      revertMessage: '',
    })

    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('0'), // earned fees
      balance1Decrease: BigNumber.from('100000000000000000000'),
      positionId: aliceId,
      liquidityIncrease: aliceLiquidity2,
      revertMessage: '',
      collectRevertMessage: ''
    })

    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity.add(aliceLiquidity2).add(compoundedLiquidity),
      burnPercent: ethers.utils.parseUnits('1', 38),
      balance0Increase: BigNumber.from('0'),
      balance1Increase: BigNumber.from('300169491140675717112'),
      revertMessage: '',
    })
 //   if (debugMode) await getSample()
    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('token1 - Should mint position inside the other 27', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('0'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      liquidityIncrease: BigNumber.from('3852877204305891777654'),
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('54487289918860678020'),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('49999646436367931756'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('54487289918860678020'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })

    if (debugMode) await getTickAtPrice()

    const bobId = await validateMint({
      signer: hre.props.bob,
      recipient: hre.props.bob.address,
      lower: '200',
      upper: '600',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('0'),
      balance1Decrease: BigNumber.from('100000000000000000000'),
      liquidityIncrease: BigNumber.from('4901161634764542438934'),
      revertMessage: '',
    })
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.bob,
      lower: '200',
      upper: '600',
      positionId: bobId,
      liquidityAmount: BigNumber.from('4901161634764542438934'),
      balance0Increase: BigNumber.from('0'),
      balance1Increase: tokenAmount.sub(1),
      revertMessage: '',
    })
    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId,
      liquidityAmount: BigNumber.from('3852877204305891777654'),
      balance0Increase: BigNumber.from('49999646436367931756').sub(2),
      balance1Increase: BigNumber.from('45512710081139321979'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('pool - Should mint position inside the other 27', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('7709661802936670729190')
    const bobLiquidity = BigNumber.from('12891478442546858467877')
    const bobLiquidity2 = BigNumber.from('4901161634764542438930')

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('100000000000000000000'),
      balance1Decrease: BigNumber.from('91071576864309669836'),
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
      balanceInDecrease: BigNumber.from('8358030030847538517'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('7758359088764708356'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
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
    if (debugMode) await getSnapshot(bobId)
    // console.log('FIRST BURN')
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
    // console.log('SECOND BURN')
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
      balance0Increase: BigNumber.from('92241640911235291643'),
      balance1Increase: BigNumber.from('99429606895157208351'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('pool - Should mint position inside the other and not steal fee share 27:: KEBABSEC', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('3852877204305891777654')
    const bobLiquidity = BigNumber.from('10356653617731432349576') // 211360277912886374481
    const bobTokenAmount = BigNumber.from('211360277912886374481')
    // console.log('FIRST SWAP')
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount,
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('0'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('0'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('0'),
      balance1Decrease: tokenAmount,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })
    // console.log('SECOND SWAP')
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount,
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('92821083862380109664'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('99999999999999999999'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })
    if (debugMode) {
        await getTickLiquidity(600)
        await getTickLiquidity(800)
        console.log('MINT #2')
    }
    const bobId = await validateMint({
      signer: hre.props.bob,
      recipient: hre.props.bob.address,
      lower: '600',
      upper: '800',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: tokenAmount,
      balance1Decrease: BN_ZERO,
      liquidityIncrease: bobLiquidity,
      revertMessage: '',
    })

    if (debugMode) await getSnapshot(bobId)
    await validateBurn({
      signer: hre.props.bob,
      lower: '600',
      upper: '800',
      positionId: bobId,
      liquidityAmount: bobLiquidity.div(2),
      burnPercent: ethers.utils.parseUnits('5', 37),
      balance0Increase: BigNumber.from('50000000000000000000').sub(1),
      balance1Increase: BN_ZERO,
      revertMessage: '',
    })

    if (debugMode) await getSnapshot(bobId)
    await validateBurn({
      signer: hre.props.bob,
      lower: '600',
      upper: '800',
      positionId: bobId,
      liquidityAmount: bobLiquidity.div(2),
      burnPercent: ethers.utils.parseUnits('1', 38),
      balance0Increase: BigNumber.from('49999999999999999999'),
      balance1Increase: BigNumber.from('0'), // this comes off a previous deposit
      revertMessage: '',
    })

    if (debugMode) await getSnapshot(aliceId)
    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity,
      balance0Increase: BigNumber.from('92821083862380109662'),
      balance1Increase: BigNumber.from('0'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('pool - Should not underflow when crossing when exiting and entering position range 27:: KEBABSEC', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('3852877204305891777654')
    const bobLiquidity = BigNumber.from('10356653617731432349576')

    await validateSwap({
        signer: hre.props.alice,
        recipient: hre.props.alice.address,
        zeroForOne: false,
        amount: tokenAmount,
        sqrtPriceLimitX96: maxPrice,
        balanceInDecrease: BigNumber.from('0'), // token1 increase in pool
        balanceOutIncrease: BigNumber.from('0'), // token0 decrease in pool
        revertMessage: '',
        exactIn: false
    })

    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '500',
      upper: '1000',
      amount0: tokenAmount,
      amount1: tokenAmount,
      balance0Decrease: BigNumber.from('0'),
      balance1Decrease: tokenAmount,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: tokenAmount.mul(2),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('92821083862380109664'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('99999999999999999999'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })

    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: tokenAmount.mul(2),
      sqrtPriceLimitX96: maxPrice,
      balanceInDecrease: BigNumber.from('100050000000000000000'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('92774696514123048138'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '500',
      upper: '1000',
      positionId: aliceId,
      liquidityAmount: aliceLiquidity,
      balance0Increase: BigNumber.from('46387348257061524'),
      balance1Increase: BigNumber.from('100049999999999999998'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })

  it('pool - Should not skip crossing tickAtPrice', async function () {
    const pool: RangePoolState = (await hre.props.limitPool.globalState()).pool
    const aliceLiquidity = BigNumber.from('288859894188086395983120')
    const aliceLiquidity2 = BigNumber.from('130948226315249229782')
    const aliceTokenAmount3 = BigNumber.from('289243797392388928270')
    const aliceLiquidity3 = BigNumber.from('289244233621838891538')
    const aliceTokenAmount4 = BigNumber.from('867731392177166784813')
    const aliceLiquidity4 = BigNumber.from('867732700865516674615')

    await mintSigners20(hre.props.token0, tokenAmount.mul(1e6), [hre.props.alice, hre.props.bob])
    await mintSigners20(hre.props.token1, tokenAmount.mul(1e6), [hre.props.alice, hre.props.bob])
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('1000120000000000000000'),
      sqrtPriceLimitX96: minPrice,
      balanceInDecrease: BigNumber.from('0'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('0'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })
    //console.log(0xdec118d63b65cfd3e8598a0a993fe6d455bf6b6ad8e30603b9bfe83b3c31d2c5)   
    const aliceId = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '73140',
      upper: '76020',
      amount0: tokenAmount.mul(10),
      amount1: BN_ZERO,
      balance0Decrease: tokenAmount.mul(10),
      balance1Decrease: BN_ZERO,
      liquidityIncrease: aliceLiquidity,
      revertMessage: '',
      collectRevertMessage: ''
    })

    // await getTickFeeGrowth(73140)
    // await getTickFeeGrowth(76020)
    // await getFeeGrowthGlobal()
    // await getRangeFeeGrowth(73140, 76020)
    // await getPositionFeeGrowth(73140, 76020)

    //console.log(0x0ce063e85ccdeea4f80aed91034aab9310cec387ac572e7366fdf2264741c4d1)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('666077964566722076'),
      sqrtPriceLimitX96: BigNumber.from('3077067665772502614228114341887'),
      balanceInDecrease: BigNumber.from('1000119705275782502865'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('666077964566722076'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })
    // await getTickFeeGrowth(73140)
    // await getTickFeeGrowth(76020)
    // await getFeeGrowthGlobal()
    // await getRangeFeeGrowth(73140, 76020)
    // await getPositionFeeGrowth(73140, 76020)
    //console.log(0x11fa356690c58c71c0abaedd6400f5011f624cdcf657c569d623e97d6592187e)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('665958920765498692'),
      sqrtPriceLimitX96: BigNumber.from('3077067665772502614228114341887'),
      balanceInDecrease: BigNumber.from('1000119615887355497025'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('665958920765498692'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })
    //console.log(0xf0df1cade6825075311fbaf6a7c15b73478fc9ff0cfaa1e52185c3d908e827fb)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('996234651079624794'),
      sqrtPriceLimitX96: BigNumber.from('3077754393416758970167012098048'),
      balanceInDecrease: BigNumber.from('1496452637324562281830'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('996234651079624794'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })
    //console.log(0x560d01f19e9cdb296813ee610cbd6d7c8a0fb78e9e8740697aa7bc10ad7f1e4e)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('1000000000000000000'),
      sqrtPriceLimitX96: BigNumber.from('3061995978261174520047757950975'),
      balanceInDecrease: BigNumber.from('0'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('0'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })
    //console.log(0x256395b982182064b119c1971988dd9808c7d65b9d444ec20ccdd055193b5b02)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('1500606953415818538340'),
      sqrtPriceLimitX96: BigNumber.from('3061995978261174520047757950975'),
      balanceInDecrease: BigNumber.from('999999995435972735'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('1500606953415818538340'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })

    //console.log(0x2d6ccd80a36be175bfbaa6b967563d1b90a3bb7411adf1d28d90475c2c060216)
    //COMPOUND
    //-increased liquidity
    //-no fees because we didn't burn anything
    await validateBurn({
      signer: hre.props.alice,
      lower: '73140',
      upper: '76020',
      positionId: aliceId,
      liquidityAmount: BN_ZERO.sub(BigNumber.from('144549841230245027')),
      burnPercent: BN_ZERO,
      balance0Increase: BigNumber.from('0'),
      balance1Increase: BigNumber.from('1746474246586493666'),
      revertMessage: '',
    })

    //console.log(0xe3140e07b139361118b959e57cefe2a2992d991a35bb73f14c302eeac78bf9b5)
    const aliceId2 = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '66120',
      upper: '80160',
      amount0: BigNumber.from('1000000000000000000'),
      amount1: BigNumber.from('1502429956147627474636'),
      balance0Decrease: BigNumber.from('1000000000000000000'),
      balance1Decrease: BigNumber.from('1502429050727335160785'),
      liquidityIncrease: aliceLiquidity2,
      revertMessage: '',
      collectRevertMessage: ''
    })

    //console.log(0x87cc302dd8d81d41c6d59fd1519e95ab900139af01d6934b0fd3bd313c98a337)
    await validateBurn({
      signer: hre.props.alice,
      lower: '66120',
      upper: '80160',
      positionId: aliceId2,
      liquidityAmount: BN_ZERO,
      balance0Increase: BigNumber.from('0'),
      balance1Increase: BigNumber.from('0'),
      revertMessage: '',
    })

    //console.log(0xdbccb0a55ff2841f7d0778f80fded3b48c0493202b21bac0ab071b619ac836bd)
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '73140',
      upper: '76020',
      amount0: BigNumber.from('1000000000000000000'),
      amount1: BigNumber.from('1997991949702276993'),
      balance0Decrease: BigNumber.from('1000000000000000000'),
      balance1Decrease: BigNumber.from('1996991077240776925'),
      positionId: aliceId,
      liquidityIncrease: aliceLiquidity3,
      revertMessage: '',
      collectRevertMessage: ''
    })

    //console.log(0x3657fa31430cc2cdb4b8576cbc07fe3b0765562ef5a02774d096702d3ba0c092)
    await validateBurn({
      signer: hre.props.alice,
      lower: '73140',
      upper: '76020',
      positionId: aliceId,
      liquidityAmount: BN_ZERO,
      balance0Increase: BigNumber.from('0'),
      balance1Increase: BigNumber.from('0'),
      revertMessage: '',
    })

    //console.log(0x6ecc898e89ba37480f21d02d998af048690115c142cefc32028321b6599004de)
    await validateBurn({
      signer: hre.props.alice,
      lower: '73140',
      upper: '76020',
      burnPercent: BigNumber.from('100032954481854984095420499972189286'),
      liquidityAmount: BigNumber.from('289244570619540141005'),
      positionId: aliceId,
      balance0Increase: BigNumber.from('1000001165097388562'),
      balance1Increase: BigNumber.from('1996993403929865999'),
      revertMessage: '',
    })

    //console.log(0xf56c6732aec4578f3068358f213ac61548744890c9b59a9b4d94deea7095e007)
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '73140',
      upper: '76020',
      amount0: BigNumber.from('3000000000000000000'),
      amount1: BigNumber.from('5993975849106830981'),
      balance0Decrease: BigNumber.from('3000000000000000000'),
      balance1Decrease: BigNumber.from('5990973231722330775'),
      positionId: aliceId,
      liquidityIncrease: aliceLiquidity4,
      revertMessage: '',
      collectRevertMessage: ''
    })

    //console.log(0xe5d03332de5694a46b370f9423dbd8008f148445d32a3e6d810dafc2ad10c830)
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('1500205148221113272257'),
      sqrtPriceLimitX96: BigNumber.from('3061588000433258657988919427072'),
      balanceInDecrease: BigNumber.from('999999861650004669'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('1500205148221113272257'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })
    // console.log('0x5e9bdcfaedba76aa371e1877dd10b998f20fcc243ff739320ef6deff77ee2704')
    const aliceTokenAmount5 = BigNumber.from('866866363770548989881')
    const aliceLiquidity5 = BigNumber.from('866868102897460296291')
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '73140',
      upper: '76020',
      amount0: BigNumber.from('3000000000000000000'),
      amount1: BigNumber.from('5993975849106830981'),
      balance0Decrease: BigNumber.from('2999500475714135087'), // earned fees
      balance1Decrease: BigNumber.from('1498404381939822693'),
      positionId: aliceId,
      liquidityIncrease: aliceLiquidity5,
      revertMessage: '',
      collectRevertMessage: ''
    })

    // console.log('0xa05d59b9bd417d6489d1aff5c5b6efe5e61443e30a6a2f0d40482c2683a40d7e')
    const aliceTokenAmount6 = BigNumber.from('2879560474037493414648')
    const aliceLiquidity6 = BigNumber.from('2879560742468351153073')
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '66120',
      upper: '80160',
      amount0: BigNumber.from('22000000000000000000'),
      amount1: BigNumber.from('33023622513667392995848'),
      balance0Decrease: BigNumber.from('21999999774230067810'), // earned fees
      balance1Decrease: BigNumber.from('33023617329379741478441'),
      positionId: aliceId2,
      liquidityIncrease: aliceLiquidity6,
      revertMessage: '',
      collectRevertMessage: ''
    })

    // console.log('0xd4e4fb14cc804685f0c35893cea7171a1dfa37b28f4719bf1cacc80321d2fa6e')
    await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '66120',
      upper: '80160',
      amount0: BigNumber.from('22000000000000000000'),
      amount1: BigNumber.from('33023622513667392995848'),
      balance0Decrease: BigNumber.from('22000000000000000000'),
      balance1Decrease: BigNumber.from('33023617329379741478441'),
      positionId: aliceId2,
      liquidityIncrease: aliceLiquidity6,
      revertMessage: '',
      collectRevertMessage: ''
    })

    //console.log('0x0c2cf2c87629df41bc1472e3984cded9df86aec0e4e3398ef9ab1f30cd7a6afc')
    await validateBurn({
      signer: hre.props.alice,
      lower: '66120',
      upper: '80160',
      burnPercent: BigNumber.from('0'),
      liquidityAmount: BigNumber.from('0'),
      positionId: aliceId2,
      balance0Increase: BigNumber.from('0'),
      balance1Increase: BigNumber.from('0'),
      revertMessage: '',
    })

    // await getFeeGrowthGlobal()
    // await getRangeFeeGrowth(73140, 76020)
    // console.log('BEFORE SWAP')
    //console.log('0x4d3e3bb5150a0874e0764067579d7ec5f09a72ae6686c3712c9095e9af067222')
    // This swap causes the underflow on snapshot
    // await getTickAtPrice()
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: true,
      amount: BigNumber.from('2221404429444282149252'),
      sqrtPriceLimitX96: BigNumber.from('3059588122704193012744629256192'),
      balanceInDecrease: BigNumber.from('816034075741896106'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('1221757093308582122316'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })

    // await getTickAtPrice()
    // await getFeeGrowthGlobal()
    // await getRangeFeeGrowth(73140, 76020)
    // console.log('END SWAP')
    // await getSnapshot(hre.props.alice.address, 73140, 76020)
    //console.log('0xfac2526e6bb1b4a3906826cf3e2f152c6fb0f2f0d7affe8fc69701f848d71897')
    await validateSwap({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      zeroForOne: false,
      amount: BigNumber.from('3351015920029701'),
      sqrtPriceLimitX96: BigNumber.from('3075057850633752459897890406400'),
      balanceInDecrease: BigNumber.from('4999998695054031975'), // token1 increase in pool
      balanceOutIncrease: BigNumber.from('3351015920029701'), // token0 decrease in pool
      revertMessage: '',
      exactIn: false
    })

    //console.log('0x4950b3696a62cdc4e9584c81911a4c3b6f6cc5c4013ea8454286a27d150d6f69')
    const aliceTokenAmount7 = BigNumber.from('621480027139148804297')
    const aliceLiquidity7 = BigNumber.from('621480027139148804297')
    const aliceId3 = await validateMint({
      signer: hre.props.alice,
      recipient: hre.props.alice.address,
      lower: '66960',
      upper: '80520',
      amount0: BigNumber.from('5000000000000000000'),
      amount1: BigNumber.from('6324961650864055083553'),
      balance0Decrease: BigNumber.from('5000000000000000000'),
      balance1Decrease: BigNumber.from('6324961163406599071651'),
      liquidityIncrease: aliceLiquidity7,
      revertMessage: '',
      collectRevertMessage: ''
    })

    // await getSnapshot(hre.props.alice.address, 73140, 76020)
    await validateBurn({
      signer: hre.props.alice,
      lower: '73140',
      upper: '76020',
      positionId: aliceId,
      burnPercent: ethers.utils.parseUnits('1', 38),
      liquidityAmount: BigNumber.from('290594639204692901949586'),
      balance0Increase: BigNumber.from('1006005656701262127930'),
      balance1Increase: BigNumber.from('0'),
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '66120',
      upper: '80160',
      positionId: aliceId2,
      burnPercent: ethers.utils.parseUnits('1', 38),
      liquidityAmount: BigNumber.from('5890069711251951535928'),
      balance0Increase: BigNumber.from('45478253764080684646'),
      balance1Increase: BigNumber.from('66834529372764445069167'),
      revertMessage: '',
    })

    await validateBurn({
      signer: hre.props.alice,
      lower: '66960',
      upper: '80520',
      positionId: aliceId3,
      burnPercent: ethers.utils.parseUnits('1', 38),
      liquidityAmount: aliceLiquidity7,
      balance0Increase: BigNumber.from('4999999999999999999'),
      balance1Increase: BigNumber.from('6324961163406599071650'),
      revertMessage: '',
    })

    if (balanceCheck) {
      console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
      console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
    }
  })
  //TODO: swapping to boundary price w/ exactOut
})