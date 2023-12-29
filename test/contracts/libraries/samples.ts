/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { mintSigners20 } from '../../utils/token'
import {
    BN_ZERO,
    LimitPoolState,
    getLiquidity,
    getPositionLiquidity,
    validateSwap
} from '../../utils/contracts/limitpool'
import {
    validateMint as validateMintRange,
    validateBurn as validateBurnRange,
    getSample,
    validateSample,
} from '../../utils/contracts/rangepool'
import { gBefore } from '../../utils/hooks.test'
import { getSnapshot, getRangeBalanceOf, getPrice } from '../../utils/contracts/rangepool'

alice: SignerWithAddress
describe('Samples Tests', function () {
    let tokenAmount: string
    let tokenAmountBn: BigNumber
    let token0Decimals: number
    let token1Decimals: number
    let minPrice: BigNumber
    let maxPrice: BigNumber

    let alice: SignerWithAddress
    let bob: SignerWithAddress
    let carol: SignerWithAddress

    const liquidityAmount = BigNumber.from('20051041647900280328782')
    const minTickIdx = BigNumber.from('-887272')
    const maxTickIdx = BigNumber.from('887272')

    ////////// DEBUG FLAGS //////////
    let debugMode           = false
    let balanceCheck        = false
    let deltaMaxBeforeCheck = false
    let deltaMaxAfterCheck  = false
    let latestTickCheck     = false

    //every test should clear out all liquidity

    before(async function () {
        await gBefore()
        let currentBlock = await ethers.provider.getBlockNumber()
        const pool0: LimitPoolState = (await hre.props.limitPool.globalState()).pool0
        const liquidity = pool0.liquidity
        const globalState = await hre.props.limitPool.globalState()
        const price = pool0.price

        expect(liquidity).to.be.equal(BN_ZERO)

        minPrice = BigNumber.from('0')
        maxPrice = BigNumber.from('1461501637330902918203684832716283019655932542975')
        token0Decimals = await hre.props.token0.decimals()
        token1Decimals = await hre.props.token1.decimals()
        tokenAmountBn = ethers.utils.parseUnits('100', token0Decimals)
        tokenAmount = ethers.utils.parseUnits('100', token0Decimals).toString()
        alice = hre.props.alice
        bob = hre.props.bob
        carol = hre.props.carol

        await hre.props.weth9.connect(hre.props.alice).deposit({value: ethers.utils.parseEther('1000')});
    })

    this.beforeEach(async function () {
        await mintSigners20(hre.props.token0, tokenAmountBn.mul(10), [hre.props.alice, hre.props.bob])

        await mintSigners20(hre.props.token1, tokenAmountBn.mul(10), [hre.props.alice, hre.props.bob])

        if (debugMode) await getLiquidity(true, true)
        if (debugMode) await getLiquidity(false, true)
    })

    it('Should test sampling after mint, swap, and burn', async function () {
        const aliceLiquidity = BigNumber.from('44721359549995793929')

        if (debugMode) await getSample(debugMode)

        await validateSample({
            secondsPerLiquidityAccum: '3062541302288446171170371466885913903104',
            tickSecondsAccum: '144855',
            averagePrice: '177157928842132501967358423881',
            averageLiquidity: '0',
            averageTick: 16095
        })

        const aliceId = await validateMintRange({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-887260',
            upper: '887260',
            amount0: BigNumber.from(tokenAmount),
            amount1: BigNumber.from(tokenAmount),
            balance0Decrease: BigNumber.from('19999999999999999998'),
            balance1Decrease: BigNumber.from(tokenAmount),
            liquidityIncrease: aliceLiquidity,
            revertMessage: '',
        })

        if (debugMode) await getSample(debugMode)

        await validateSample({
            secondsPerLiquidityAccum: '4083388403051261561560495289181218537472',
            tickSecondsAccum: '193140',
            averagePrice: '177157928842132501967358423881',
            averageLiquidity: '0',
            averageTick: 16095
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from(tokenAmount),
            priceLimit: BigNumber.from('79386769463160146968577785965'), 
            balanceInDecrease: '24632010676919545389',
            balanceOutIncrease: '55161518152962386648',
            revertMessage: '',
        })

        await validateSample({
            secondsPerLiquidityAccum: '4083388403051261561575713179260813421667',
            tickSecondsAccum: '225330',
            averagePrice: '177157928842132501967358423881',
            averageLiquidity: '30435780159189768390',
            averageTick: 16095
        })

        if (debugMode) await getSample(debugMode)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: BigNumber.from(tokenAmount),
            priceLimit: BigNumber.from('79545693927487839655804034729'), 
            balanceInDecrease: '89706966373347543',
            balanceOutIncrease: '89125777643798713',
            revertMessage: '',
        })

        await validateSample({
            secondsPerLiquidityAccum: '4083388403051261561590931069340408305862',
            tickSecondsAccum: '225408',
            averagePrice: '79382800422362568253159300200',
            averageLiquidity: '30435780159189768390',
            averageTick: 39
        })

        if (debugMode) await getSample(debugMode)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from(tokenAmount),
            priceLimit: BigNumber.from('79386769463160146968577785965'), 
            balanceInDecrease: '89170362825211320',
            balanceOutIncrease: '89662112890160868',
            revertMessage: '',
        })

        await validateSample({
            secondsPerLiquidityAccum: '4083388403051261561606148959420003190057',
            tickSecondsAccum: '225566',
            averagePrice: '79541716941062961637430132579',
            averageLiquidity: '30435780159189768390',
            averageTick: 79
        })

        if (debugMode) await getSample(debugMode)

        await validateBurnRange({
            signer: hre.props.alice,
            lower: '-887260',
            upper: '887260',
            positionId: aliceId,
            liquidityAmount: aliceLiquidity,
            balance0Increase: BigNumber.from('44632055262100957991'),
            balance1Increase: BigNumber.from('44838526700520800023'),
            revertMessage: '',
        })

        await validateSample({
            secondsPerLiquidityAccum: '4083388403051261561606148959420003190057',
            tickSecondsAccum: '225566',
            averagePrice: '79382800422362568253159300200',
            averageLiquidity: '15217890079594884196',
            averageTick: 39
        })
        
        if (debugMode) await getSample(debugMode)

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
  })
})