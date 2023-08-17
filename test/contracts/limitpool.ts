/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { mintSigners20 } from '../utils/token'
import {
    BN_ZERO,
    LimitPoolState,
    PoolState,
    getLiquidity,
    getPositionLiquidity,
    getPrice,
    getSwapEpoch,
    getTick,
    getTickAtPrice,
    validateBurn,
    validateMint,
    validateSwap
} from '../utils/contracts/limitpool'
import { gBefore } from '../utils/hooks.test'
import { base58 } from 'ethers/lib/utils'
import { debug } from 'console'

alice: SignerWithAddress
describe('LimitPool Tests', function () {
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
    })

    this.beforeEach(async function () {
        await mintSigners20(hre.props.token0, tokenAmountBn.mul(10), [hre.props.alice, hre.props.bob])

        await mintSigners20(hre.props.token1, tokenAmountBn.mul(10), [hre.props.alice, hre.props.bob])

        if (debugMode) await getLiquidity(true, true)
        if (debugMode) await getLiquidity(false, true)
    })
    // 1. implement range pool calls
    // 2. implement swap/quote
    // - find active liquidity
    // - find next price between range and limit
    // store flag of which pools are active (uint8)
    // better yet just store liquidity for limit and range (tells which are active)
    // calculate fee growth off the range liquidity amount
    // cross tick and know which ticks to clear out based on active liquidity
    // pass global state instead of swapPool for MintLimit

    it('pool0 - Should mint, fill, and burn 29', async function () {
        const aliceLiquidity = '20051041647900280328782'
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) await getPrice(true, true)
        expect(await getLiquidity(true)).to.be.equal(aliceLiquidity)

        // no-op swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: '100501226962305120351',
            balanceOutIncrease: '99999999999999999999',
            revertMessage: '',
        })

        expect(await getLiquidity(true)).to.be.equal(BN_ZERO)

        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityAmount: liquidityAmount,
            zeroForOne: true,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) await getPositionLiquidity(true, hre.props.alice.address, 0, 100, debugMode)
    })

    it('pool1 - Should mint, fill, and burn 29', async function () {
        const aliceLiquidity = '20051041647900280328782'
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) await getLiquidity(false, true)
        if (debugMode) await getSwapEpoch(false, true)
        // no-op swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: minPrice,
            balanceInDecrease: '100501226962305120351',
            balanceOutIncrease: '99999999999999999999',
            revertMessage: '',
        })

        if (debugMode) getTick(false, 0, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '0',
            claim: '0',
            liquidityAmount: liquidityAmount,
            zeroForOne: false,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '0',
            claim: '-100',
            liquidityAmount: liquidityAmount,
            zeroForOne: false,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'PositionNotFound()',
        })
    })

    it('pool0 - Should mint, partially fill, and burn 29', async function () {
        const aliceLiquidity = '20051041647900280328782'
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.div(2),
            priceLimit: maxPrice,
            balanceInDecrease: '50000000000000000000',
            balanceOutIncrease: '49875628335894665158',
            revertMessage: '',
        })

        if (debugMode) await getTickAtPrice(false, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '45',
            liquidityAmount: liquidityAmount,
            zeroForOne: true,
            balanceInIncrease: '49999999999999999999',
            balanceOutIncrease: '50124371664105334841',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) await getTick(false, -100, true)
    })

    it('pool1 - Should mint, partially fill, and burn 29', async function () {
        const aliceLiquidity = '20051041647900280328782'
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        // no-op swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.div(2),
            priceLimit: minPrice,
            balanceInDecrease: '50000000000000000000',
            balanceOutIncrease: '49875628335894665158',
            revertMessage: '',
        })

        if (debugMode) await getTick(false, -100, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '0',
            claim: '-45',
            liquidityAmount: liquidityAmount,
            zeroForOne: false,
            balanceInIncrease: '49999999999999999999',
            balanceOutIncrease: '50124371664105334841',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) await getTick(false, -100, true)
    })

    it('pool0 - Should mint, partial fill, partial burn, fill leftover, and burn again 29', async function () {
        const aliceLiquidity = '20051041647900280328782'
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        // no-op swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.div(2),
            priceLimit: maxPrice,
            balanceInDecrease: '50000000000000000000',
            balanceOutIncrease: '49875628335894665158',
            revertMessage: '',
        })

        if (debugMode) await getTick(false, -100, true)
        if (debugMode) await getPositionLiquidity(true, hre.props.alice.address, 0, 100, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '45',
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: true,
            balanceInIncrease: '45070101571418444482',
            balanceOutIncrease: '25062185832052667420',
            lowerTickCleared: true,
            upperTickCleared: false,
            expectedLower: '40',
            revertMessage: '',
        })

        // no-op swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.div(2),
            priceLimit: maxPrice,
            balanceInDecrease: '25250613481152560176',
            balanceOutIncrease: '25062185832052667420',
            revertMessage: '',
        })

        if (debugMode) await getTick(false, -100, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '40',
            upper: '100',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '30180511909734115692',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            expectedLower: '40',
            revertMessage: '',
        })
        
        if (debugMode) await getTick(false, -100, true)
    })

    it('pool1 - Should mint, partial fill, partial burn, fill leftover, and burn again 22', async function () {
        const aliceLiquidity = '20051041647900280328782'
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.div(2),
            priceLimit: minPrice,
            balanceInDecrease: '50000000000000000000',
            balanceOutIncrease: '49875628335894665158',
            revertMessage: '',
        })

        if (debugMode) await getPrice(false, true)
        if (debugMode) await getTick(false, -100, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '0',
            claim: '-45',
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: false,
            balanceInIncrease: '45070101571418444482',
            balanceOutIncrease: '25062185832052667420',
            lowerTickCleared: false,
            upperTickCleared: true,
            expectedUpper: '-45',
            expectedPositionUpper: '-40',
            revertMessage: '',
        })
        // no-op swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.div(2),
            priceLimit: minPrice,
            balanceInDecrease: '25250613481152560176',
            balanceOutIncrease: '25062185832052667420',
            revertMessage: '',
        })

        if (debugMode) await getTick(false, -100, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '-50',
            claim: '-100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '25250613481152560175',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'PositionNotFound()',
        })
        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '-40',
            claim: '-100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '30180511909734115692',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })
        if (debugMode) await getTick(false, -50, true)
        if (debugMode) await getTick(false, -100, true)
    })

    it('pool0 - Should mint, undercut, swap, and burn 22', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100',
            upper: '200',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: BigNumber.from(1),
            priceLimit: maxPrice,
            balanceInDecrease: '1',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        expect(await getPrice(true, debugMode)).to.be.equal(BigNumber.from('79625275426524748796334487745'))
        // swap tiny
        // price should be at -100 tick
        // undercut
        if (debugMode) await getTick(false, -100, true)
        if (debugMode) await getTick(false, -105, true)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(false, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        // swap 125
        // alice fully filled
        // bob partially filled
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(5).div(4),
            priceLimit: maxPrice,
            balanceInDecrease: '125000000000000000000',
            balanceOutIncrease: '124225713332407203072',
            revertMessage: '',
        })

        if (debugMode) await getTick(false, -105, true)
        if (debugMode) await getPrice(false, true)

        // bob should be able to claim something here

        // close both positions
        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }

        if (debugMode) await getPrice(true, true)

        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            claim: '120',
            upper: '200',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '24498773037694879649',
            balanceOutIncrease: '75774286667592796925',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })
    })

    it('pool1 - Should mint, undercut, swap, and burn 22', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '20151542874862585449132'

        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-200',
            upper: '-100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) await getPrice(false, true)
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from(1),
            priceLimit: minPrice,
            balanceInDecrease: '1',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        if (debugMode) await getPrice(false, true)

        expect(await getPrice(false, debugMode)).to.be.equal(BigNumber.from('78833030112140176575858962080'))

        // swap tiny
        // price should be at -100 tick
        // undercut
        if (debugMode) await getTick(false, -100, true)
        if (debugMode) await getTick(false, -105, true)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(false, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            // expectedLower: '-120',
            // expectedUpper: '-110',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        // // price should be at 1.00
        if (debugMode) console.log('BEFORE SWAP')
        if (debugMode) await getTick(false, -100, true)
        if (debugMode) await getTick(false, -105, true)
        if (debugMode) await getPrice(false, true)
        if (debugMode) await getLiquidity(false, true)

        // swap 125
        // alice fully filled
        // bob partially filled
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(5).div(4),
            priceLimit: minPrice,
            balanceInDecrease: '125000000000000000000',
            balanceOutIncrease: '124225713332407203072',
            revertMessage: '',
        })

        if (debugMode) await getTick(false, -105, true)
        if (debugMode) await getPrice(false, true)

        // bob should be able to claim something here

        // close both positions
        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '0',
            claim: '-100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }

        await validateBurn({
            signer: hre.props.bob,
            lower: '-200',
            claim: '-125',
            upper: '-100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '24498773037694879649',
            balanceOutIncrease: '75774286667592796925',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'WrongTickClaimedAt2()',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-200',
            claim: '-120',
            upper: '-100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '24498773037694879649',
            balanceOutIncrease: '75774286667592796925',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
    })

    it('pool0 - Should mint, undercut, burn undercut swap, and burn', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100',
            upper: '200',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: BigNumber.from(1),
            priceLimit: maxPrice,
            balanceInDecrease: '1',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        expect(await getPrice(true, debugMode)).to.be.equal(BigNumber.from('79625275426524748796334487745'))
        // swap tiny
        // price should be at -100 tick
        // undercut
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })
        if (debugMode) console.log('AFTER MINT 2')
        if (debugMode) await getPrice(true, true)
        // swap 125
        // alice fully filled
        // bob partially filled
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(5).div(4),
            priceLimit: maxPrice,
            balanceInDecrease: '125000000000000000000',
            balanceOutIncrease: '124225713332407203072',
            revertMessage: '',
        })

        // await getTick(false, -105, true)
        if (debugMode) await getPrice(true, true)

        // bob should be able to claim something here

        // close both positions
        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(5).div(4),
            priceLimit: maxPrice,
            balanceInDecrease: '77012457295500903027',
            balanceOutIncrease: '75774286667592796925',
            revertMessage: '',
        })

        if (debugMode) await getPrice(true, true)

        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            claim: '200',
            upper: '200',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '101511230333195782676',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })
    })

    it('pool1 - Should mint, undercut, burn undercut, swap, and burn', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-200',
            upper: '-100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })
        if (debugMode) await getPrice(false, true)
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from(1),
            priceLimit: minPrice,
            balanceInDecrease: '1',
            balanceOutIncrease: '0',
            revertMessage: '',
        })
        if (debugMode) await getPrice(false, true)

        expect(await getPrice(false, debugMode)).to.be.equal(BigNumber.from('78833030112140176575858962080'))
        // swap tiny
        // price should be at -100 tick
        // undercut
        if (debugMode) await getTick(false, -100, true)
        if (debugMode) await getTick(false, -105, true)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(false, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })
        // // price should be at 1.00
        if (debugMode) console.log('BEFORE SWAP')
        if (debugMode) await getTick(false, -100, true)
        if (debugMode) await getTick(false, -105, true)
        if (debugMode) await getPrice(false, true)
        if (debugMode) await getLiquidity(false, true)

        // swap 125
        // alice fully filled
        // bob partially filled
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(5).div(4),
            priceLimit: minPrice,
            balanceInDecrease: '125000000000000000000',
            balanceOutIncrease: '124225713332407203072',
            revertMessage: '',
        })

        if (debugMode) await getTick(false, -105, true)
        if (debugMode) await getPrice(false, true)

        // bob should be able to claim something here

        // close both positions
        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '0',
            claim: '-100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(5).div(4),
            priceLimit: minPrice,
            balanceInDecrease: '77012457295500903027',
            balanceOutIncrease: '75774286667592796925',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-200',
            claim: '-200',
            upper: '-100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '101511230333195782676',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })
    })

    it('pool0 - Should undercut and burn', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100',
            upper: '200',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) await getTick(true, 100, true)
        if (debugMode) await getTick(true, 105, true)
        // bob should be able to claim something here
        if (debugMode) console.log('BEFORE BURN 1')
        // close both positions
        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            upper: '200',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })
    })

    it('pool1 - Should undercut and burn', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '754380626357928274821'
        if (debugMode) await getPrice(true, true)

        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '19000',
            upper: '20000',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) await getTick(true, 100, true)
        if (debugMode) await getTick(true, 105, true)
        // bob should be able to claim something here
        if (debugMode) console.log('BEFORE BURN 1')
        // close both positions
        await validateBurn({
            signer: hre.props.bob,
            lower: '19000',
            upper: '20000',
            claim: '20000',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
    })

    it('pool0 - Should undercut, undercut again, and burn', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '20151542874862585449132'
        // aliceLiquidity - bobLiquidity
        const aliceMinusBobLiquidity = '-100501226962305120350'

        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100', // epoch 2
            upper: '200',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0', 
            upper: '100', 
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceMinusBobLiquidity,
            positionLiquidityChange: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: true,
            revertMessage: '',
        })
        if (debugMode) console.log("FIRST BURN")
        // close both positions
        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            upper: '200',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })
        if (debugMode) console.log("SECOND BURN")
        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })
    })

    it('pool1 - Should undercut, undercut again, and burn', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '682595230910166351423'
        const bobLiquidity = '717590842920215903832'
        // aliceLiquidity - bobLiquidity
        const aliceMinusBobLiquidity = '-34995612010049552409'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '20000', // epoch 2
            upper: '21000',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })
        if (debugMode) await getTick(false, 20000, true)
        if (debugMode) await getTick(false, 21000, true)
        if (debugMode) await getTick(false, 22000, true)
        if (debugMode) await getLiquidity(false, true)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '21000', 
            upper: '22000', 
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceMinusBobLiquidity,
            positionLiquidityChange: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })
        if (debugMode) await getTick(false, 20000, true)
        if (debugMode) await getTick(false, 21000, true)
        if (debugMode) await getTick(false, 22000, true)
        if (debugMode) await getLiquidity(false, true)
        // close both positions
        if (debugMode) console.log('FIRST BURN')
        await validateBurn({
            signer: hre.props.bob,
            lower: '20000',
            upper: '21000',
            claim: '21000',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })
        if (debugMode) console.log('SECOND BURN')
        await validateBurn({
            signer: hre.props.alice,
            lower: '21000',
            upper: '22000',
            claim: '22000',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
    })

    it('pool0 - Should mint, partial mint on other side, and burn', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '19601226326594684349779'
        const bobLiquidity = '20151542874862585449132'
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100', // epoch 2
            upper: '200',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })
        if (debugMode) await getTick(false, 21000)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '100', 
            upper: '200', 
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '50062496842661136959',
            liquidityIncrease: aliceLiquidity,
            positionLiquidityChange: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            expectedUpper: '150',
            revertMessage: '',
        })
        if (debugMode) await getPrice(true, true)

        if (debugMode) await getTick(false, 21000, true)
        // close both positions
        //amountOut should be
        //49861732254639926627
        /// @dev - fail case is if the pool prices have crossed each other
        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            upper: '200',
            claim: '155',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '49861732254639926626',
            balanceOutIncrease: '50755615166597891338',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: 'WrongTickClaimedAt1()',
        })
        if (debugMode) console.log('BEFORE BURN 1')
        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            upper: '200',
            claim: '145',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '50692173852693169634',
            balanceOutIncrease: '49937503157338863040',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })
        if (debugMode) console.log('BEFORE BURN 2')
        await validateBurn({
            signer: hre.props.alice,
            lower: '100',
            upper: '150',
            claim: '150',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '49307826147306830364',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool1 - Should mint, partial mint on other side, and burn', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '20104447516992018640794'
        const bobLiquidity = '19851540375107355238395'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100', // epoch 2
            upper: '200',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) await getTick(false, 21000)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '100', 
            upper: '200', 
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '51062470802791960584',
            liquidityIncrease: aliceLiquidity,
            positionLiquidityChange: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            expectedLower: '150',
            revertMessage: '',
        })
        // return
        if (debugMode) await getPrice(true, true)
        if (debugMode) console.log('BEFORE BURN 1')
        if (debugMode) await getTick(false, 21000, true)
        // close both positions
        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            upper: '200',
            claim: '135',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '49861732254639926626',
            balanceOutIncrease: '50755615166597891338',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: 'WrongTickClaimedAt2()',
        })

        if (debugMode) console.log('BEFORE BURN 2')
        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            upper: '200',
            claim: '150',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '50179203766640200814',
            balanceOutIncrease: '48937529197208039415',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
        if (debugMode) getPrice(true, true)
        if (debugMode) console.log('BEFORE BURN 3')
        if (debugMode) await getTick(true, 150, true)
        await validateBurn({
            signer: hre.props.alice,
            lower: '150',
            upper: '200',
            claim: '150',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '49820796233359799184',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })
        
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool0 - Should mint, partial mint on other side and trim position, and burn', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '19951041647900280328782'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100', // epoch 2
            upper: '200',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) await getTick(false, 21000)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0', 
            upper: '200', 
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '0',
            liquidityIncrease: aliceLiquidity,
            positionLiquidityChange: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            expectedUpper: '100',
            revertMessage: '',
        })

        if (debugMode) await getPrice(true, true)

        if (debugMode) await getTick(false, 21000, true)
        // close both positions
        //amountOut should be
        //49861732254639926627
        /// @dev - fail case is if the pool prices have crossed each other
        
        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            upper: '200',
            claim: '105',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: 'WrongTickClaimedAt1()',
        })

        if (debugMode) console.log('BEFORE BURN 2')
        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            upper: '200',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) console.log('BEFORE BURN 3')
        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    }) 
    
    it('pool1 - Should mint, partial mint on other side and trim position, and burn', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '19749016985663918212779'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-200', // epoch 2
            upper: '-100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) await getTick(false, 21000)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-200', 
            upper: '0', 
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '1002476897254236684',
            liquidityIncrease: aliceLiquidity,
            positionLiquidityChange: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            expectedLower: '-100',
            revertMessage: '',
        })
 
        if (debugMode) await getPrice(true, true)

        if (debugMode) await getTick(false, 21000, true)
        // close both positions
        /// @dev - fail case is if the pool prices have crossed each other
        if (debugMode) await getPrice(false, true)
        if (debugMode) console.log('BEFORE BURN 2')
        await validateBurn({
            signer: hre.props.bob,
            lower: '-200',
            upper: '-100',
            claim: '-100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '1012602077634497449',
            balanceOutIncrease: '98997523102745763315',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }

        if (debugMode) console.log('BEFORE BURN 3')
        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '0',
            claim: '-100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '98987397922365502549',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })
    //       2nd
    // position: 2   
    // range 20 -> 40
    // range 10 -> 30
    // 20
    // 20
    // 30 => 
    // 10           20   21            30       
    // |                    
    // |---------- 5      7    ----------- 1000
    it('pool0 - Should mint, partial mint on other side and fully trim position, and burn', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '10100959554167425445954'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-200', // epoch 2
            upper: '-100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) await getTick(false, 21000)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-300', 
            upper: '-100', 
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '98518582560149315133',
            liquidityIncrease: '0',
            upperTickCleared: true,
            lowerTickCleared: true,
            expectedLower: '200',
            revertMessage: '',
        })

        if (debugMode) await getPrice(true, true)
        if (debugMode) console.log('BEFORE BURN 1')
        if (debugMode) await getTick(false, 21000, true)
        // close both positions
        await validateBurn({
            signer: hre.props.bob,
            lower: '-200',
            upper: '-100',
            claim: '-205',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '49861732254639926626',
            balanceOutIncrease: '50755615166597891338',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: 'InvalidClaimTick()',
        })

        if (debugMode) console.log('BEFORE BURN 2')
        await validateBurn({
            signer: hre.props.bob,
            lower: '-200',
            upper: '-100',
            claim: '-195',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '99999999999999999999',
            balanceOutIncrease: '1481417439850684866',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
        if (debugMode) getPrice(true, true)
        if (debugMode) console.log('BEFORE BURN 3')
        if (debugMode) await getTick(true, 150, true)
        await validateBurn({
            signer: hre.props.alice,
            lower: '-300', 
            upper: '-200', 
            claim: '-200',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: 'PositionNotFound()',
        })
        
        if (debugMode) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool1 - Should mint, partial mint on other side and fully trim position, and burn', async function () {
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '10100959554167425445954'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100', // epoch 2
            upper: '200',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        //swaps from 100 to 190
        if (debugMode) await getTick(false, 21000)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '100', 
            upper: '300', 
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '98518582560149315133',
            liquidityIncrease: '0',
            upperTickCleared: true,
            lowerTickCleared: false,
            expectedUpper: '190',
            revertMessage: '',
        })

        if (debugMode) await getPrice(true, true)
        if (debugMode) console.log('BEFORE BURN 1')
        if (debugMode) await getTick(false, 21000, true)
        // close both positions
        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            upper: '200',
            claim: '205',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '49861732254639926626',
            balanceOutIncrease: '50755615166597891338',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: 'InvalidClaimTick()',
        })
        if (debugMode) console.log('BEFORE BURN 2')
        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            upper: '200',
            claim: '185',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '99999999999999999999',
            balanceOutIncrease: '1481417439850684866',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })
        if (debugMode) getPrice(true, true)
        if (debugMode) console.log('BEFORE BURN 3')
        if (debugMode) await getTick(true, 150, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '100',
            upper: '190',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: 'PositionNotFound()',
        })
        
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool0 - Should undercut twice, advance fill, swap remaining, and burn', async function () {
        // mint position
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '50252916603475800015887'
        const bobLiquidity = '100757714374312927245661'
        const aliceLiquidity2 = '83587749917909883454638'
        const aliceMinusBobLiquidity = '11692258323234396689338'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100', // epoch 2
            upper: '200',
            amount: String(500e18),
            zeroForOne: true,
            balanceInDecrease: String(500e18),
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(5),
            priceLimit: BigNumber.from('79724900000000000000000000000'), // price at tick 125
            balanceInDecrease: '126696669471223297843',
            balanceOutIncrease: '125279333803276231912',
            revertMessage: '',
        })

        if (debugMode) await getTick(false, 21000)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)

        // first undercut; priceAt is set on tick 125
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0', 
            upper: '200',
            amount: String(500e18),
            zeroForOne: true,
            balanceInDecrease: String(500e18),
            balanceOutIncrease: '0',
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(5),
            priceLimit: BigNumber.from('79724800000000000000000000000'),
            balanceInDecrease: '315007711409951843805',
            balanceOutIncrease: '313045403097080772083',
            revertMessage: '',
        })

        // should revert until we update other position
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0', 
            upper: '200', 
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '98518582560149315133',
            liquidityIncrease: '0',
            upperTickCleared: true,
            lowerTickCleared: true,
            expectedLower: '200',
            revertMessage: 'UpdatePositionFirstAt(0, 200)',
        })

        if (debugMode) console.log('BEFORE BURN 3')
        if (debugMode) getPrice(true, true)
        await validateBurn({
            signer: hre.props.alice,
            lower: '0', 
            upper: '200', 
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('0'),
            zeroForOne: true,
            balanceInIncrease: '302408698352797678358',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            expectedLower: '120',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '120', 
            upper: '200', 
            claim: '120',
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: true,
            balanceInIncrease: '6299506528577082722',
            balanceOutIncrease: '93477298451459613958',
            lowerTickCleared: true,
            upperTickCleared: false,
            expectedLower: '120',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '120', 
            upper: '200', 
            claim: '120',
            liquidityPercent: ethers.utils.parseUnits('0', 37),
            zeroForOne: true,
            balanceInIncrease: '6299506528577082722',
            balanceOutIncrease: '93477298451459613958',
            lowerTickCleared: true,
            upperTickCleared: false,
            expectedLower: '120',
            revertMessage: 'NoPositionUpdates()',
        })

        if (debugMode) console.log('BEFORE BURN 3')
        if (debugMode) await getTick(true, 120, true)
        if (debugMode) await getLiquidity(true, true)

        // 2nd undercut where previous fill is advanced
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0', 
            upper: '120', 
            amount: String(500e18),
            zeroForOne: true,
            balanceInDecrease: String(500e18),
            balanceOutIncrease: '0',
            liquidityIncrease: aliceLiquidity2,
            positionLiquidityChange: aliceLiquidity2,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }

        await mintSigners20(hre.props.token1, tokenAmountBn.mul(20), [hre.props.alice, hre.props.bob])

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(15),
            priceLimit: BigNumber.from('80034378775772204256025656562'),
            balanceInDecrease: '978876909147407918465',
            balanceOutIncrease: '968197964616739457759',
            revertMessage: ''
        })
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }


        await validateBurn({
            signer: hre.props.alice,
            lower: '120', 
            upper: '200', 
            claim: '125',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '101308066346820303034',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            expectedLower: '125',
            revertMessage: '',
        })

        if (debugMode) getPrice(true, true)
        if (debugMode) console.log('BEFORE BURN 3')
       
        await validateBurn({
            signer: hre.props.bob,
            lower: '100', 
            upper: '200', 
            claim: '120',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '507556151665978913382',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }

        if (debugMode) await getTick(true, 125, true)//moving this after the burn changes the result
        if (debugMode) await getLiquidity(true, true)
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }

        await validateBurn({
            signer: hre.props.alice,
            lower: '0', 
            upper: '120', 
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '503008867134409082611',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })
 
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool1 - Should undercut twice, advance fill, swap remaining, and burn', async function () {
        // mint position
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '50252916603475800015887'
        const bobLiquidity = '100757714374312927245661'
        const aliceLiquidity2 = '16717549983581976690927'
        const aliceMinusBobLiquidity = '11692258323234396689338'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-200', // epoch 2
            upper: '-100',
            amount: String(500e18),
            zeroForOne: false,
            balanceInDecrease: String(500e18),
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(5),
            priceLimit: BigNumber.from('78734600000000000000000000000'), // price at tick -125
            balanceInDecrease: '126593680232133996918',
            balanceOutIncrease: '125177623841344633721',
            revertMessage: '',
        })

        if (debugMode) await getTick(false, 21000)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)

        // first undercut; priceAt is set on tick 125
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-200', 
            upper: '0',
            amount: String(500e18),
            zeroForOne: false,
            balanceInDecrease: String(500e18),
            balanceOutIncrease: '0',
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(5),
            priceLimit: BigNumber.from('78734700000000000000000000000'), // set to price at tick -125
            balanceInDecrease: '314955547887618095421',
            balanceOutIncrease: '312993887392031766268',
            revertMessage: ''
        })

        // should revert until we update other position
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-200', 
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '98518582560149315133',
            liquidityIncrease: '0',
            upperTickCleared: true,
            lowerTickCleared: true,
            expectedLower: '-200',
            revertMessage: 'UpdatePositionFirstAt(-200, 0)',
        })

        if (debugMode) console.log('BEFORE BURN 3')
        if (debugMode) getPrice(false, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-200', 
            upper: '0', 
            claim: '-120',
            liquidityPercent: ethers.utils.parseUnits('0'),
            zeroForOne: false,
            balanceInIncrease: '302408698352797678358',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            expectedUpper: '-120',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-200', 
            upper: '-120',
            claim: '-120',
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: false,
            balanceInIncrease: '6273424767410208531',
            balanceOutIncrease: '93503056303984116865',
            lowerTickCleared: false,
            upperTickCleared: true,
            expectedUpper: '-120',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-200', 
            upper: '-120',
            claim: '-120',
            liquidityPercent: ethers.utils.parseUnits('0', 37),
            zeroForOne: false,
            balanceInIncrease: '6273424767410208531',
            balanceOutIncrease: '93503056303984116865',
            lowerTickCleared: false,
            upperTickCleared: true,
            expectedUpper: '-120',
            revertMessage: 'NoPositionUpdates()',
        })

        if (debugMode) console.log('BEFORE MINT 3')
        if (debugMode) await getTick(true, 120, true)
        if (debugMode) await getLiquidity(true, true)

        // 2nd undercut where previous fill is advanced
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-120', 
            upper: '0', 
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '0',
            liquidityIncrease: aliceLiquidity2,
            positionLiquidityChange: aliceLiquidity2,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await mintSigners20(hre.props.token0, tokenAmountBn.mul(20), [hre.props.alice, hre.props.bob])

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(15),
            priceLimit: BigNumber.from('78339868342809377387252074392'),
            balanceInDecrease: '576598886440136827493',
            balanceOutIncrease: '568325432430399648662',
            revertMessage: ''
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-200', 
            upper: '-120',
            claim: '-120',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '101308066346820303034',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            expectedLower: '-120',
            revertMessage: '',
        })

        if (debugMode) getPrice(true, true)

        // await getTick(true, 150, true)
        await validateBurn({
            signer: hre.props.bob,
            lower: '-200', 
            upper: '-100', 
            claim: '-120',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '507556151665978913382',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        if (debugMode) console.log('BEFORE BURN 3')
        if (debugMode) await getTick(true, 125, true)
        await validateBurn({
            signer: hre.props.bob,
            lower: '-200', 
            upper: '-100', 
            claim: '-125',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '25318736046426799383',
            balanceOutIncrease: '74964475231731073255',
            lowerTickCleared: false,
            upperTickCleared: false,
            expectedUpper: '-125',
            revertMessage: 'PositionNotFound()',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }

        if (debugMode) await getLiquidity(true, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120', 
            upper: '0', 
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '100601773426881816522',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }

    })

    it('pool0 - Should undercut twice, advance fill, and burn', async function () {
        // mint position
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '50252916603475800015887'
        const bobLiquidity = '100757714374312927245661'
        const aliceLiquidity2 = '83587749917909883454638'
        const aliceMinusBobLiquidity = '11692258323234396689338'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100', // epoch 2
            upper: '200',
            amount: String(500e18),
            zeroForOne: true,
            balanceInDecrease: String(500e18),
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(5),
            priceLimit: BigNumber.from('79724900000000000000000000000'), // price at tick 125
            balanceInDecrease: '126696669471223297843',
            balanceOutIncrease: '125279333803276231912',
            revertMessage: '',
        })

        if (debugMode) await getTick(false, 21000)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)

        // first undercut; priceAt is set on tick 125
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0', 
            upper: '200',
            amount: String(500e18),
            zeroForOne: true,
            balanceInDecrease: String(500e18),
            balanceOutIncrease: '0',
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(5),
            priceLimit: BigNumber.from('79724800000000000000000000000'),
            balanceInDecrease: '315007711409951843805',
            balanceOutIncrease: '313045403097080772083',
            revertMessage: '',
        })

        // should revert until we update other position
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0', 
            upper: '200', 
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '98518582560149315133',
            liquidityIncrease: '0',
            upperTickCleared: true,
            lowerTickCleared: true,
            expectedLower: '200',
            revertMessage: 'UpdatePositionFirstAt(0, 200)',
        })

        if (debugMode) console.log('BEFORE BURN 3')
        if (debugMode) getPrice(true, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '0', 
            upper: '200', 
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('0'),
            zeroForOne: true,
            balanceInIncrease: '302408698352797678358',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            expectedLower: '120',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '120', 
            upper: '200', 
            claim: '120',
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: true,
            balanceInIncrease: '6299506528577082722',
            balanceOutIncrease: '93477298451459613958',
            lowerTickCleared: true,
            upperTickCleared: false,
            expectedLower: '120',
            revertMessage: '',
        })

        if (debugMode) console.log('BEFORE BURN 3')
        if (debugMode) await getTick(true, 120, true)
        if (debugMode) await getLiquidity(true, true)

        // 2nd undercut where previous fill is advanced
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0', 
            upper: '120', 
            amount: String(500e18),
            zeroForOne: true,
            balanceInDecrease: String(500e18),
            balanceOutIncrease: '0',
            liquidityIncrease: aliceLiquidity2,
            positionLiquidityChange: aliceLiquidity2,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        // liquidity is correct here

        await validateBurn({
            signer: hre.props.alice,
            lower: '120', 
            upper: '200', 
            claim: '120',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '101308066346820303034',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            expectedLower: '125',
            revertMessage: 'WrongTickClaimedAt5()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '120', 
            upper: '200', 
            claim: '125',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '6324890459101712432',
            balanceOutIncrease: '93452229814266113131',
            lowerTickCleared: false,
            upperTickCleared: false,
            expectedLower: '125',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '100', 
            upper: '200', 
            claim: '120',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '507556151665978913382',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'WrongTickClaimedAt5()',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '100', 
            upper: '200', 
            claim: '125',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '126671285540698668131',
            balanceOutIncrease: '374745734802473344628',
            lowerTickCleared: false,
            upperTickCleared: false,
            expectedLower: '125',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '0', 
            upper: '120', 
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '499999999999999999999',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) await getLiquidity(false, true)

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool1 - Should undercut twice, advance fill, and burn', async function () {
        // mint position
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '50252916603475800015887'
        const bobLiquidity = '100757714374312927245661'
        const aliceLiquidity2 = '16717549983581976690927'
        const aliceMinusBobLiquidity = '11692258323234396689338'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-200', // epoch 2
            upper: '-100',
            amount: String(500e18),
            zeroForOne: false,
            balanceInDecrease: String(500e18),
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(5),
            priceLimit: BigNumber.from('78734600000000000000000000000'),
            balanceInDecrease: '126593680232133996918',
            balanceOutIncrease: '125177623841344633721',
            revertMessage: '',
        })

        if (debugMode) await getTick(false, 21000)
        if (debugMode) console.log('BEFORE MINT 2')
        if (debugMode) await getPrice(true, true)

        // first undercut; priceAt is set on tick 125
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-200', 
            upper: '0',
            amount: String(500e18),
            zeroForOne: false,
            balanceInDecrease: String(500e18),
            balanceOutIncrease: '0',
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(5),
            priceLimit: BigNumber.from('78734700000000000000000000000'), // set to price at tick -125
            balanceInDecrease: '314955547887618095421',
            balanceOutIncrease: '312993887392031766268',
            revertMessage: ''
        })

        // should revert until we update other position
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-200', 
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '98518582560149315133',
            liquidityIncrease: '0',
            upperTickCleared: true,
            lowerTickCleared: true,
            expectedLower: '-200',
            revertMessage: 'UpdatePositionFirstAt(-200, 0)',
        })

        if (debugMode) console.log('BEFORE BURN 3')
        if (debugMode) getPrice(false, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-200', 
            upper: '0', 
            claim: '-120',
            liquidityPercent: ethers.utils.parseUnits('0'),
            zeroForOne: false,
            balanceInIncrease: '302408698352797678358',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            expectedUpper: '-120',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-200', 
            upper: '-120',
            claim: '-120',
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: false,
            balanceInIncrease: '6273424767410208531',
            balanceOutIncrease: '93503056303984116865',
            lowerTickCleared: false,
            upperTickCleared: true,
            expectedUpper: '-120',
            revertMessage: '',
        })

        if (debugMode) console.log('BEFORE MINT 3')
        if (debugMode) await getTick(true, 120, true)
        if (debugMode) await getLiquidity(true, true)

        // 2nd undercut where previous fill is advanced
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-120', 
            upper: '0', 
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '0',
            liquidityIncrease: aliceLiquidity2,
            positionLiquidityChange: aliceLiquidity2,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-200', 
            upper: '-120',
            claim: '-120',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '6299127910586212059',
            balanceOutIncrease: '93477672367024421972',
            lowerTickCleared: false,
            upperTickCleared: true,
            expectedUpper: '-120',
            revertMessage: 'WrongTickClaimedAt5()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-200', 
            upper: '-120',
            claim: '-125',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '6299127910586212059',
            balanceOutIncrease: '93477672367024421972',
            lowerTickCleared: false,
            upperTickCleared: true,
            expectedUpper: '-120',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-200', 
            upper: '-100', 
            claim: '-120',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '507556151665978913382',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'WrongTickClaimedAt5()',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-200', 
            upper: '-100', 
            claim: '-125',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '126567977088957993387',
            balanceOutIncrease: '374847760063375226691',
            lowerTickCleared: false,
            upperTickCleared: false,
            expectedUpper: '-125',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120', 
            upper: '0', 
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool0 - Should partial fill and skip mint due to mintPercent', async function () {
        // mint position
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '95988407038939537431696'
        const bobLiquidity = '99257701875536776191977'
        const aliceLiquidity2 = '16717549983581976690927'
        const aliceMinusBobLiquidity = '11692258323234396689338'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-200', // epoch 2
            upper: '-100',
            amount: String(500e18),
            zeroForOne: true,
            balanceInDecrease: String(500e18),
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        // first undercut; priceAt is set on tick 125
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-200', 
            upper: '-100',
            amount: String(500e18),
            zeroForOne: false,
            balanceInDecrease: '245970337436687078101',
            balanceOutIncrease: '250312484213305684795',
            liquidityIncrease: '0',
            upperTickCleared: true,
            lowerTickCleared: false,
            expectedLower: '-150',
            revertMessage: '',
            mintPercent: ethers.utils.parseUnits('6', 27)
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-150', 
            upper: '-100', 
            claim: '-150',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '126567977088957993387',
            balanceOutIncrease: '374847760063375226691',
            lowerTickCleared: false,
            upperTickCleared: false,
            expectedUpper: '-125',
            revertMessage: 'PositionNotFound()',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-200', // epoch 2
            upper: '-100',
            claim: '-150',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '245970337436687078100',
            balanceOutIncrease: '249687515786694315204',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool1 - Should partial fill and skip mint due to mintPercent', async function () {
        // mint position
        if (debugMode) await getPrice(false, true)
        const aliceLiquidity = '95988407038939537431696'
        const bobLiquidity = '100757714374312927245661'
        const aliceLiquidity2 = '16717549983581976690927'
        const aliceMinusBobLiquidity = '11692258323234396689338'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-200', // epoch 2
            upper: '-100',
            amount: String(500e18),
            zeroForOne: false,
            balanceInDecrease: String(500e18),
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        // first undercut; priceAt is set on tick 125
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-200', 
            upper: '-100',
            amount: String(500e18),
            zeroForOne: true,
            balanceInDecrease: '258536552378291262451',
            balanceOutIncrease: '255312354013959802923',
            liquidityIncrease: '0',
            upperTickCleared: false,
            lowerTickCleared: true,
            expectedLower: '-150',
            revertMessage: '',
            mintPercent: ethers.utils.parseUnits('6', 27)
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-150', 
            upper: '-100', 
            claim: '-150',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '126567977088957993387',
            balanceOutIncrease: '374847760063375226691',
            lowerTickCleared: false,
            upperTickCleared: false,
            expectedUpper: '-125',
            revertMessage: 'PositionNotFound()',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-200', // epoch 2
            upper: '-100',
            claim: '-150',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '258536552378291262449',
            balanceOutIncrease: '244687645986040197076',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool0 - pool.price not updated when the pool.tickAtPrice is not a multiple of the tick spacing :: GUARDIAN AUDITS', async function () {
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = aliceLiquidity
        const bobLiquidity2 = '27891383310849199095788'

        // Get the pool1 tickAtPrice to not be an even multiple of the tick spacing
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: BigNumber.from('78632271998467896963137734028'),
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: maxPrice,
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        // Check that I've set the pool tick to tick 15
        const poolPrice = await getPrice(false);
        expect(poolPrice).to.eq('78632271998467896963137734028');

        let pool1Tick = await getTickAtPrice(false);
        expect(pool1Tick).to.eq(-151);

        let pool0Tick = await getTickAtPrice(true);
        // expect(pool0Tick).to.eq(887270);

        // Mint a position and undercut the price such that we get resized
        // Resulting in more liquidity being swapped in a tick range than exists
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        expect(await getLiquidity(true, false)).to.be.equal(aliceLiquidity)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.div(5),
            priceLimit: maxPrice,
            balanceInDecrease: '20000000000000000000',
            balanceOutIncrease: '19980070790195293837',
            revertMessage: '',
        })
        expect(await getLiquidity(true, false)).to.be.equal(aliceLiquidity)
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })
        expect(await getLiquidity(true, false)).to.be.equal(bobLiquidity)

        await validateBurn({
            signer: hre.props.bob,
            lower: '0',
            upper: '100',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })
        expect(await getLiquidity(true, false)).to.be.equal(BN_ZERO)
        if (debugMode) await getTickAtPrice(true, true)

        // we should have swapped some amount here
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '0',
            upper: '100',
            expectedUpper: '50',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '30082426052465843121', // 30082426052465843121 should be the amount out increase
            liquidityIncrease: "27891383310849199095788", // 27891383310849199095788 should be the liquidity increase
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })
        expect(await getLiquidity(false)).to.be.equal(bobLiquidity2)
        expect(await getLiquidity(true)).to.be.equal(aliceLiquidity)
        expect(await getTickAtPrice(false)).to.be.equal(50)
        expect(await getTickAtPrice(true)).to.be.equal(50)

        // Now everyone else tries to burn
        await validateBurn({
            signer: hre.props.bob,
            lower: '0',
            upper: '50',
            claim: '50',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '69812196612534583810',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
        expect(await getLiquidity(false)).to.be.equal(0)
        expect(await getLiquidity(true)).to.be.equal(aliceLiquidity)
        expect(await getTickAtPrice(false)).to.be.equal(50)
        expect(await getTickAtPrice(true)).to.be.equal(50)

        // Alice attempts to burn, however she cannot as there are not enough tokens in the contract
        // These tokens were stolen because the pool.price was not updated accordingly in the Ticks.unlock function
        // Therefore the resulting amountMax in quoteSingle is much larger than it should be, and users are able
        // to swap much more than they ought to be able to within a given tick range.
        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '40',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '50187803387465416188',
            balanceOutIncrease: '49937503157338863040',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })
        // The fix is to move the ticks[pool.tickAtPrice] = ILimitPoolStructs.Tick(0,0); line to the end of
        // the Ticks.unlock function, this way the pool.price is able to update as the priceAt will not always be 0.

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    });

    it('pool1 - pool.price not updated when the pool.tickAtPrice is not a multiple of the tick spacing :: GUARDIAN AUDITS', async function () {
        const aliceLiquidity = '19951041647900280328782'
        const bobLiquidity = aliceLiquidity
        const bobLiquidity2 = '27832153891598856837297'
        const alicePlusBobLiquidity = '39902083295800560657564'

        // Get the pool1 tickAtPrice to not be an even multiple of the tick spacing

        // Check that I've set the pool tick to tick 15
        const poolPrice = await getPrice(false);
        // 78632271998467896963137734028
        expect(poolPrice).to.eq('79426470787362580746886972461');

        let pool1Tick = await getTickAtPrice(false);
        expect(pool1Tick).to.eq(50);

        let pool0Tick = await getTickAtPrice(true);
        expect(pool0Tick).to.eq(50);

        // Mint a position and undercut the price such that we get resized
        // Resulting in more liquidity being swapped in a tick range than exists
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        expect(await getLiquidity(false, false)).to.be.equal(aliceLiquidity)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.div(5),
            priceLimit: minPrice,
            balanceInDecrease: '20000000000000000000',
            balanceOutIncrease: '20180661659241859695',
            revertMessage: '',
        })

        expect(await getLiquidity(false, false)).to.be.equal(aliceLiquidity)
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        expect(await getLiquidity(false, false)).to.be.equal(bobLiquidity)

        await validateBurn({
            signer: hre.props.bob,
            lower: '0',
            upper: '100',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'WrongTickClaimedAt3()',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
        expect(await getLiquidity(true, false)).to.be.equal(BN_ZERO)
        expect(await getLiquidity(false, false)).to.be.equal(BN_ZERO)

        expect(await getTickAtPrice(false)).to.be.equal(100)
        if (debugMode) console.log('BEFORE MINT 3')
        // we should have swapped some amount here
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '0',
            upper: '100',
            expectedLower: '50',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            balanceOutIncrease: '30881809143550100889', // 30082426052465843121 should be the amount out increase
            liquidityIncrease: bobLiquidity2, // 27891383310849199095788 should be the liquidity increase
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        expect(await getLiquidity(true)).to.be.equal(bobLiquidity2)
        expect(await getLiquidity(false)).to.be.equal(aliceLiquidity)
        expect(await getTickAtPrice(true)).to.be.equal(50)


        // Now everyone else tries to burn
        await validateBurn({
            signer: hre.props.bob,
            lower: '50',
            upper: '100',
            claim: '50',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '69316512191415466017',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        expect(await getLiquidity(true)).to.be.equal(0)
        expect(await getLiquidity(false)).to.be.equal(aliceLiquidity)
        expect(await getTickAtPrice(true)).to.be.equal(50)
        expect(await getTickAtPrice(false)).to.be.equal(49)

        // Alice attempts to burn, however she cannot as there are not enough tokens in the contract
        // These tokens were stolen because the pool.price was not updated accordingly in the Ticks.unlock function
        // Therefore the resulting amountMax in quoteSingle is much larger than it should be, and users are able
        // to swap much more than they ought to be able to within a given tick range.
        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '50',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '50683487808584533981',
            balanceOutIncrease: '48937529197208039415',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
        // The fix is to move the ticks[pool.tickAtPrice] = ILimitPoolStructs.Tick(0,0); line to the end of
        // the Ticks.unlock function, this way the pool.price is able to update as the priceAt will not always be 0.
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    });

    it('pool0 - insertSingle double counts liquidity', async function () {
        const liquidityAmount = '20051041647900280328782'

        // // Get pool price right on an even tick
        // let pool0Tick = await getTickAtPrice(true);
        // let pool1Tick = await getTickAtPrice(false);

        // expect(pool0Tick).to.eq(50);
        // expect(pool1Tick).to.eq(49);

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: minPrice,
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        expect(await getLiquidity(true, false)).to.be.equal(BN_ZERO)

        // Initial mint to get the pool.price to tick 0 with liquidity there
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '0',
            upper: '100',
            expectedLower: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })
        expect(await getLiquidity(true, false)).to.be.equal(liquidityAmount)
        // Mint such that the lower is at the pool.price
        // Notice that the validation fails, as the liquidity is double counted
        // The pool.liquidity goes to liquidityAmount.mul(2), however the liquidityDelta for
        // tick 0 is incremented to liquidityAmount.
        // The validation is commented out atm to show the full effects of this bug.

        // This is because the pool.liquidity is not zeroed out, meanwhile the tick.liquidityDelta is still incremented
        // by the pool.liquidity when the following are satisfied:
        // * params.lower == tickToSave
        // * pool.price == roundedPrice
        // * tickToSave.priceAt == 0

        // The remediation is to ensure that whenever the liquidityDelta is updated on the tickToSave,
        // the pool.liquidity is zeroed out, every time.
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        // Now this tick 0 can be crossed and it's liquidity delta can be added to the pool liquidity.
        // This is catastrophic as now the liquidity from other positions (far from the current price)
        // Can now be used to swap in the pool at the current price, and when these users attempt to burn
        // They will receive an ERC20 token balance underflow and experience a significant loss.

        // Mint a position to move down a tick so that the cross tick is tick 0 which has the extra liquidity
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-10',
            upper: '90',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: "20041019134030931248014",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        // ~ liquidityAmount * 3 has actually been added, however I can swap more than the token amount
        // that should be supported by the actual liquidity that has been added.
        //
        // In this scenario since there are no other positions away from the current price, this will result in
        // and ERC20 balance underflow. In a real life scenario this would drain funds from positions away from the
        // current price and result in significant losses for those users.
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: maxPrice,
            balanceInDecrease: '301403234913524799094',
            balanceOutIncrease: '299999999999999999999',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-10',
            upper: '90',
            claim: '50',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '100400780988914558392',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })


        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '50',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '0',
            upper: '100',
            claim: '50',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool1 - insertSingle double counts liquidity', async function () {
        const liquidityAmount = '19951041647900280328782'

        // // Get pool price right on an even tick
        // let pool0Tick = await getTickAtPrice(true);
        // let pool1Tick = await getTickAtPrice(false);

        // expect(pool0Tick).to.eq(50);
        // expect(pool1Tick).to.eq(49);

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: minPrice,
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        expect(await getLiquidity(false, false)).to.be.equal(BN_ZERO)

        // Initial mint to get the pool.price to tick 0 with liquidity there
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })
        expect(await getLiquidity(false)).to.be.equal(liquidityAmount)

        // Mint such that the lower is at the pool.price
        // Notice that the validation fails, as the liquidity is double counted
        // The pool.liquidity goes to liquidityAmount.mul(2), however the liquidityDelta for
        // tick 0 is incremented to liquidityAmount.
        // The validation is commented out atm to show the full effects of this bug.

        // This is because the pool.liquidity is not zeroed out, meanwhile the tick.liquidityDelta is still incremented
        // by the pool.liquidity when the following are satisfied:
        // * params.lower == tickToSave
        // * pool.price == roundedPrice
        // * tickToSave.priceAt == 0

        // The remediation is to ensure that whenever the liquidityDelta is updated on the tickToSave,
        // the pool.liquidity is zeroed out, every time.

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        // Now this tick 0 can be crossed and it's liquidity delta can be added to the pool liquidity.
        // This is catastrophic as now the liquidity from other positions (far from the current price)
        // Can now be used to swap in the pool at the current price, and when these users attempt to burn
        // They will receive an ERC20 token balance underflow and experience a significant loss.

        // Mint a position to move down a tick so that the cross tick is tick 0 which has the extra liquidity
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '10',
            upper: '110',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: "19941069119034430548140",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        // ~ liquidityAmount * 3 has actually been added, however I can swap more than the token amount
        // that should be supported by the actual liquidity that has been added.
        //
        // In this scenario since there are no other positions away from the current price, this will result in
        // and ERC20 balance underflow. In a real life scenario this would drain funds from positions away from the
        // current price and result in significant losses for those users.
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: minPrice,
            balanceInDecrease: '298404371809799214515',
            balanceOutIncrease: '299999999999999999999',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '10',
            upper: '110',
            claim: '110',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '99401826223949033740',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })


        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '50',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '99501272792925090386',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '0',
            upper: '100',
            claim: '50',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '99501272792925090386',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool0 - Broken Swap When Overlapped LPs :: GUARDIAN AUDITS', async function () {

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: BigNumber.from('79228162514264337593543950336'),
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: minPrice,
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: maxPrice,
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        const aliceLiquidity = '10000458327205120325604';
        const bobLiquidity = '10000458327205120325604';

        expect(await getTickAtPrice(true)).to.eq(887270);

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-100', 
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100', 
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: minPrice,
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        // Nothing is swapped in due to the cross tick matching the tick at pool's price
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: '200000000000000000000',
            balanceOutIncrease: '199999999999999999999',
            revertMessage: ''
        })
        if (debugMode) await getLiquidity(true, true)
        await validateBurn({
            signer: hre.props.alice,
            lower: '-100', 
            upper: '100', 
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '99999999999999999999',
            balanceOutIncrease: '0', 
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-100', 
            upper: '100',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '99999999999999999999',
            balanceOutIncrease: '0', 
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })
    })

    it('pool1 - Broken Swap When Overlapped LPs :: GUARDIAN AUDITS', async function () {

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: BigNumber.from('79228162514264337593543950336'),
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })
        if (debugMode) await getLiquidity(true, true)
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: maxPrice,
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: maxPrice,
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        const aliceLiquidity = '10000458327205120325604';
        const bobLiquidity = '10000458327205120325604';

        expect(await getTickAtPrice(false)).to.eq(-887270);

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-100', 
            upper: '100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })


        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100', 
            upper: '100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        // Nothing is swapped in due to the cross tick matching the tick at pool's price
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: minPrice,
            balanceInDecrease: '200000000000000000000',
            balanceOutIncrease: '199999999999999999999',
            revertMessage: ''
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100', 
            upper: '100', 
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '99999999999999999999',
            balanceOutIncrease: '0', 
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-100', 
            upper: '100',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '99999999999999999999',
            balanceOutIncrease: '0', 
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })
    })

    it("pool0 - Should resize users properly when no amount is swapped :: GUARDIAN AUDITS", async () => {
        const bobLiquidity = '22284509725894501570567';
        const aliceLiquidity = '18223659436328876602453'

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: BigNumber.from('177159557114295710296101716160'),
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(4),
            priceLimit: BigNumber.from('177159557114295710296101716160'),
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-10',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        });

        const alicePositionLiquidity = await getPositionLiquidity(true, alice.address, -10, 100);
        expect(alicePositionLiquidity).to.eq(aliceLiquidity);

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-100',
            upper: '0',
            expectedUpper: '-10',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            balanceOutIncrease: "0",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        // Notice that bob is shrunk to -50, however no swap was performed on resize -- this is fine
        // as the pool price was above the midpoint of his position.
        // However, bob was not resized to the market price, he was resized to the midpoint of his position
        // E.g. the priceLimit.
        const bobPositionLiquidity = await getPositionLiquidity(false, bob.address, -100, -10);
        expect(bobPositionLiquidity).to.eq(bobLiquidity);

        // Bob should have been resized to [-10, -100], but he was resized away from the current market price
        // to [-50, -100] and now the current price is at tick -50.
        expect(await getTickAtPrice(false)).to.eq(-10);
        expect(await getTickAtPrice(false)).to.eq(-10);

        await validateBurn({
            signer: hre.props.bob,
            lower: '-100', 
            upper: '-10',
            claim: '-10',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999', 
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-10', 
            upper: '100',
            claim: '-10',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999', 
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        // The fix is to resize the position to the current market price when no swap will occur.
        // You can comment out the added section in Positions.sol to see the adjusted resizing.
    })

    it("pool1 - Should resize users properly when no amount is swapped :: GUARDIAN AUDITS", async () => {
        const bobLiquidity = '22284509725894501570567';
        const aliceLiquidity = '18223659436328876602453'

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '10',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        });

        const alicePositionLiquidity = await getPositionLiquidity(false, alice.address, -100, 10);
        expect(alicePositionLiquidity).to.eq(aliceLiquidity);

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '0',
            upper: '100',
            expectedLower: '10',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidity,
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        // Notice that bob is shrunk to -50, however no swap was performed on resize -- this is fine
        // as the pool price was above the midpoint of his position.
        // However, bob was not resized to the market price, he was resized to the midpoint of his position
        // E.g. the priceLimit.
        const bobPositionLiquidity = await getPositionLiquidity(true, bob.address, 10, 100);
        expect(bobPositionLiquidity).to.eq(bobLiquidity);

        // Bob should have been resized to [-10, -100], but he was resized away from the current market price
        // to [-50, -100] and now the current price is at tick -50.
        expect(await getTickAtPrice(false)).to.eq(10);
        expect(await getTickAtPrice(true)).to.eq(10);

        await validateBurn({
            signer: hre.props.bob,
            lower: '10', 
            upper: '100',
            claim: '10',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999', 
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100', 
            upper: '10',
            claim: '10',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999', 
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
        // The fix is to resize the position to the current market price when no swap will occur.
        // You can comment out the added section in Positions.sol to see the adjusted resizing.
    })

    it("pool0 - can supply any claim tick :: GUARDIAN AUDITS", async () => {
        const bobLiquidity = '20051041647900280328782'
        const aliceLiquidity = '20051041647900280328782'
        const alicePlusBobLiquidity = '40002083295800560657564'
        const aliceLiquidity2 = '19951041647900280328782'
        const aliceLiquidity3 = '22173370812928211327045'

        // expect(await getTickAtPrice(false)).to.eq(16095);
        // expect(await getTickAtPrice(true)).to.eq(16095);

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        });

        const alicePositionLiquidity = await getPositionLiquidity(true, alice.address, 0, 100);
        expect(alicePositionLiquidity).to.eq(aliceLiquidity);

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn,
            priceLimit: maxPrice,
            balanceInDecrease: '100000000000000000000',
            balanceOutIncrease: '99503747737971550932',
            revertMessage: '',
        });

        if (debugMode) await getTickAtPrice(true, true)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            expectedUpper: "90",
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity3,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        });

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: minPrice,
            balanceInDecrease: '99551033380443894704',
            balanceOutIncrease: '99999999999999999999',
            revertMessage: '',
        });

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        });

        //tick 95 now exists
        if (debugMode) await getTick(true, 95, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '95',
            expectedLower: '90',
            liquidityAmount: BigNumber.from("0"),
            zeroForOne: true,
            balanceInIncrease: '90428477551142091806',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        });

        // Alice still has her position shrunk to a non-standard tick
        expect(await getPositionLiquidity(true, alice.address, 95, 100)).to.eq(0);
        expect(await getPositionLiquidity(true, alice.address, 90, 100)).to.eq(aliceLiquidity);
        // Swaps the rest of the way to fill the remainder
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: '101002453924610240701',
            balanceOutIncrease: '100496252262028449066',
            revertMessage: '',
        });

        // Now everyone burns
        await validateBurn({
            signer: hre.props.alice,
            lower: '90',
            upper: '100',
            claim: '90',
            liquidityAmount: BigNumber.from(aliceLiquidity),
            zeroForOne: true,
            balanceInIncrease: '10072749411163028543',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '90',
            claim: '0',
            liquidityAmount: BigNumber.from(aliceLiquidity3),
            zeroForOne: false,
            balanceInIncrease: '99551033380443894703',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        // Alice has a position that spans 0 ticks but still has liquidity on it
        expect(await getPositionLiquidity(false, alice.address, 0, 0)).to.eq("0");
        expect((await hre.props.limitPool.globalState()).liquidityGlobal).to.eq(bobLiquidity)

        expect(await getTickAtPrice(false)).to.eq(-887270);
        expect((await hre.props.limitPool.globalState()).pool1.liquidity).to.eq("0")

        expect(await getTickAtPrice(true)).to.eq(887270);
        expect((await hre.props.limitPool.globalState()).pool0.liquidity).to.eq("0")

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        });

        // Burn again, this time removing alice's null position that still has liquidity
        // Alice's liquidity will be subtracted from tick 0's liquidity delta, therefore
        // having more negative liquidityDelta on that tick than the pool.liquidity.
        //
        // Ultimately this will brick the pool with an underflow revert when we reach this tick
        // as we are attempting to subtract more liquidityDelta from the pool.liquidity than exists.
        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '0',
            claim: '0',
            liquidityAmount: BigNumber.from("39952020798957899520605"),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: 'InvalidPositionBounds()',
        });
        expect((await hre.props.limitPool.globalState()).liquidityGlobal).to.eq(alicePlusBobLiquidity);

        // So now we swap to get to these ticks and see that the pool is now bricked past this point
        // This is catastrophic as anyone can create these positions and intentionally put the pool in this
        // bricked state, essentially shutting down the entire protocol and preventing every user from getting filled.
        //
        // Additionally, this state will arise on common day-to-day use, making the pools virtually unusable over a non-trivial
        // amount of time.
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: minPrice,
            balanceInDecrease: '99501272792925090387',
            balanceOutIncrease: '99999999999999999999',
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: '0',
            upper: '100',
            claim: '0',
            liquidityAmount: BigNumber.from("20051041647900280328782"),
            zeroForOne: true,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: '0',
            upper: '100',
            claim: '0',
            liquidityAmount: BigNumber.from(aliceLiquidity2),
            zeroForOne: false,
            balanceInIncrease: '99501272792925090386',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it("pool1 - can supply any claim tick :: GUARDIAN AUDITS", async () => {
        const bobLiquidity = '20051041647900280328782'
        const aliceLiquidity = '20051041647900280328782'
        const alicePlusBobLiquidity = '40002083295800560657564'
        const aliceLiquidity2 = '19951041647900280328782'
        const aliceLiquidity3 = '22173370812928211327045'

        // expect(await getTickAtPrice(false)).to.eq(16095);
        // expect(await getTickAtPrice(true)).to.eq(16095);

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        });

        const alicePositionLiquidity = await getPositionLiquidity(false, alice.address, -100, 0);
        expect(alicePositionLiquidity).to.eq(aliceLiquidity);
 
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn,
            priceLimit: minPrice,
            balanceInDecrease: '100000000000000000000',
            balanceOutIncrease: '99503747737971550932',
            revertMessage: '',
        });
        if (debugMode) await getPrice(false, true)
        if (debugMode) await getTickAtPrice(false, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            expectedLower: "-90",
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity3,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        });

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: '99551033380443894704',
            balanceOutIncrease: '99999999999999999999',
            revertMessage: '',
        });

        if (debugMode) await getTick(false, -100, true)
        if (debugMode) await getPrice(false, true)

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        });
        //tick 95 now exists
        if (debugMode) await getPrice(false, true)
        if (debugMode) await getTick(false, -100, true)
        if (debugMode) await getTick(false, -95, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '0',
            claim: '-95',
            expectedUpper: '-90',
            liquidityAmount: BigNumber.from("0"),
            zeroForOne: false,
            balanceInIncrease: '90428477551142091806',
            balanceOutIncrease: '0',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        });

        // Alice still has her position shrunk to a non-standard tick
        expect(await getPositionLiquidity(false, alice.address, -100, -95)).to.eq(0);
        expect(await getPositionLiquidity(false, alice.address, -100, -90)).to.eq(aliceLiquidity);

        // Swaps the rest of the way to fill the remainder
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: minPrice,
            balanceInDecrease: '101002453924610240701',
            balanceOutIncrease: '100496252262028449066',
            revertMessage: '',
        });

        // Now everyone burns
        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '-90',
            claim: '-90',
            liquidityAmount: BigNumber.from(aliceLiquidity),
            zeroForOne: false,
            balanceInIncrease: '10072749411163028543',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '-90',
            upper: '0',
            claim: '0',
            liquidityAmount: BigNumber.from(aliceLiquidity3),
            zeroForOne: true,
            balanceInIncrease: '99551033380443894703',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        // Alice has a position that spans 0 ticks but still has liquidity on it
        expect(await getPositionLiquidity(true, alice.address, 0, 0)).to.eq("0");
        expect((await hre.props.limitPool.globalState()).liquidityGlobal).to.eq(bobLiquidity)

        expect(await getTickAtPrice(true)).to.eq(887270);
        expect((await hre.props.limitPool.globalState()).pool0.liquidity).to.eq("0")

        expect(await getTickAtPrice(false)).to.eq(-887270);
        expect((await hre.props.limitPool.globalState()).pool1.liquidity).to.eq("0")

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        });

        // Burn again, this time removing alice's null position that still has liquidity
        // Alice's liquidity will be subtracted from tick 0's liquidity delta, therefore
        // having more negative liquidityDelta on that tick than the pool.liquidity.
        //
        // Ultimately this will brick the pool with an underflow revert when we reach this tick
        // as we are attempting to subtract more liquidityDelta from the pool.liquidity than exists.
        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '0',
            claim: '0',
            liquidityAmount: BigNumber.from("39952020798957899520605"),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: 'InvalidPositionBounds()',
        });

        expect((await hre.props.limitPool.globalState()).liquidityGlobal).to.eq(alicePlusBobLiquidity);

        // So now we swap to get to these ticks and see that the pool is now bricked past this point
        // This is catastrophic as anyone can create these positions and intentionally put the pool in this
        // bricked state, essentially shutting down the entire protocol and preventing every user from getting filled.
        //
        // Additionally, this state will arise on common day-to-day use, making the pools virtually unusable over a non-trivial
        // amount of time.
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: '99501272792925090387',
            balanceOutIncrease: '99999999999999999999',
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: '-100',
            upper: '0',
            claim: '0',
            liquidityAmount: BigNumber.from("20051041647900280328782"),
            zeroForOne: false,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: '-100',
            upper: '0',
            claim: '0',
            liquidityAmount: BigNumber.from(aliceLiquidity2),
            zeroForOne: true,
            balanceInIncrease: '99501272792925090386',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool - Should revert if liquidity minted is zero', async function () {
        const aliceLiquidity = '20051041647900280328782'

        // mint reverts as the price becomes out of bounds
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-665460',
            upper: '-665450',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: '100000000000000000000',
            liquidityIncrease: '804',
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: 'PositionLiquidityZero()',
        })

        // mint reverts as the price becomes out of bounds
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '865450',
            upper: '865460',
            amount: '1000000000000000',
            zeroForOne: false,
            balanceInDecrease: '1000000000000000',
            liquidityIncrease: '804',
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: 'PositionLiquidityZero()',
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: '100000000000000000000',
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '0',
            liquidityAmount: BigNumber.from(aliceLiquidity),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        });
    })

    it('pool0 - Should decrement liquidityGlobal if params.amount is zero', async function () {
        const aliceLiquidity = '20051041647900280328782'

        // mint reverts as the price becomes out of bounds
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: '100000000000000000000',
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: '100501226962305120351',
            balanceOutIncrease: '99999999999999999999',
            revertMessage: '',
        });

        expect((await hre.props.limitPool.globalState()).liquidityGlobal).to.be.equal(aliceLiquidity)

        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '0',
            liquidityAmount: BN_ZERO,
            zeroForOne: true,
            positionLiquidityChange: '20051041647900280328782',
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        expect((await hre.props.limitPool.globalState()).liquidityGlobal).to.be.equal(BN_ZERO)
    })

    it('pool1 - Should decrement liquidityGlobal if params.amount is zero', async function () {
        const aliceLiquidity = '20051041647900280328782'

        // mint reverts as the price becomes out of bounds
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: '100000000000000000000',
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: minPrice,
            balanceInDecrease: '100501226962305120351',
            balanceOutIncrease: '99999999999999999999',
            revertMessage: '',
        });

        expect((await hre.props.limitPool.globalState()).liquidityGlobal).to.be.equal(aliceLiquidity)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '0',
            claim: '0',
            liquidityAmount: BN_ZERO,
            zeroForOne: false,
            positionLiquidityChange: '20051041647900280328782',
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        expect((await hre.props.limitPool.globalState()).liquidityGlobal).to.be.equal(BN_ZERO)
    })

    it('pool0 - Should unlock next tick when tickAtPrice is negative', async function () {
        // expect(await getTickAtPrice(false)).to.eq(0);
        // expect(await getTickAtPrice(true)).to.eq(0);

        const aliceLiquidity = '185871770591153141'
        const aliceLiquidity2 = '1998'
        const aliceLiquidityDiff = '-185871770591151142'


        if (debugMode) console.log("Mint #1");

        // mint 1st position
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '10',
            amount: "92908011034199",
            zeroForOne: true,
            balanceInDecrease: "92908011034199",
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        });

        expect(await getLiquidity(true)).to.be.equal(BigNumber.from(aliceLiquidity))

        if (debugMode) console.log("Mint #2");

        // undercut with small position
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-20',
            upper: '-10',
            amount: "1",
            zeroForOne: true,
            balanceInDecrease: "1",
            liquidityIncrease: aliceLiquidity2,
            positionLiquidityChange: aliceLiquidity2,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        });

        expect(await getLiquidity(true)).to.be.equal(BigNumber.from("1998"));

        if (debugMode) console.log("Burn #1");

        // burn small position
        await validateBurn({
            signer: hre.props.alice,
            lower: '-20',
            upper: '-10',
            claim: '-20',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) console.log("Swap #1");

        // swap to tick -1.83
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: BigNumber.from("22"),
            priceLimit: BigNumber.from("79220898858226420364311811501"),
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #3");

        expect(await getLiquidity(true)).to.be.equal(BigNumber.from("0"));

        if (debugMode) await getTick(true, 0, true)

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-10',
            upper: '0',
            amount: "1",
            zeroForOne: false,
            balanceInDecrease: "1",
            liquidityIncrease: "2000",
            upperTickCleared: true,
            upperTickCrossed: true,
            lowerTickCleared: false,
            revertMessage: '',
        });
        if (debugMode) expect(await (await getTick(true, 0, true)).limit.liquidityDelta).to.be.equal(BN_ZERO)


        expect(await getLiquidity(true)).to.be.equal(BigNumber.from("185871770591153141"));

        if (debugMode) console.log("Burn #2 ");
        await validateBurn({
            signer: hre.props.bob,
            lower: '-10',
            upper: '0',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '0',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) console.log("Burn #3");

        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '10',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '92908011034198',
            liquidityAmount: BigNumber.from(aliceLiquidity),
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    });
    
    it('pool1 - Should unlock next tick when tickAtPrice is negative', async function () {
        // expect(await getTickAtPrice(false)).to.eq(0);
        // expect(await getTickAtPrice(true)).to.eq(0);

        const aliceLiquidity = '185871770591153141'
        const aliceLiquidity2 = '1998'
        const aliceLiquidityDiff = '-185871770591151142'

        if (debugMode) console.log("Mint #1");

        // mint 1st position
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-10',
            upper: '0',
            amount: "92908011034199",
            zeroForOne: false,
            balanceInDecrease: "92908011034199",
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        });


        expect(await getLiquidity(false)).to.be.equal(BigNumber.from(aliceLiquidity))

        if (debugMode) console.log("Mint #2");

        // undercut with small position
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '10',
            upper: '20',
            amount: "1",
            zeroForOne: false,
            balanceInDecrease: "1",
            liquidityIncrease: aliceLiquidity2,
            positionLiquidityChange: aliceLiquidity2,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        });

        expect(await getLiquidity(false)).to.be.equal(BigNumber.from("1998"));

        if (debugMode) console.log("Burn #1");

        // burn small position
        await validateBurn({
            signer: hre.props.alice,
            lower: '10',
            upper: '20',
            claim: '20',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '0',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) console.log("Swap #1");

        // swap to tick -1.83
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from("22"),
            priceLimit: BigNumber.from("79235400000000000000000000000"),
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #3");

        expect(await getLiquidity(false)).to.be.equal(BigNumber.from("0"));

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '0',
            upper: '10',
            amount: "1",
            zeroForOne: true,
            balanceInDecrease: "1",
            liquidityIncrease: "2000",
            upperTickCleared: false,
            lowerTickCrossed: true,
            lowerTickCleared: true,
            revertMessage: '',
        });

        if (debugMode) await getTick(true, 0, true)

        expect(await getLiquidity(false)).to.be.equal(BigNumber.from("185871770591153141"));

        if (debugMode) console.log("Burn #2 ");
        await validateBurn({
            signer: hre.props.bob,
            lower: '0',
            upper: '10',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) console.log("Burn #3");

        await validateBurn({
            signer: hre.props.alice,
            lower: '-10',
            upper: '0',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '92908011034198',
            liquidityAmount: BigNumber.from(aliceLiquidity),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    });

    it("pool0 - Should not skip over half tick when pool.tickAtPrice is further along:: GUARDIAN AUDITS", async function () {

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-20',
            upper: '0',
            amount: '2',
            zeroForOne: true,
            balanceInDecrease: '2',
            liquidityIncrease: "1999",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #1 Completed");

        // swap to tick -3
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn,
            priceLimit: BigNumber.from("79220240490215316061937756560"),
            balanceInDecrease: '2',
            balanceOutIncrease: '1',
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #2 Completed");
        if (debugMode) await getPrice(true, true)

        // liquidity is stashed on tick 5 when the tick at the current price is tick 4
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-60',
            upper: '50',
            amount: '2',
            zeroForOne: true,
            balanceInDecrease: '2',
            liquidityIncrease: "363",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) await getTick(true, -5, true)

        if (debugMode) console.log("Mint #3 Completed");
        if (debugMode) await getPrice(true, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '50',
            amount: '2',
            zeroForOne: true,
            balanceInDecrease: '2',
            liquidityIncrease: "363",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #4 Completed");
        if (debugMode) await getPrice(true, true)
        // this does not mint a position
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '50',
            expectedUpper: "-10",
            amount: '2',
            zeroForOne: false,
            balanceInDecrease: '2',
            liquidityIncrease: "0",
            balanceOutIncrease: "1",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #5 Completed");
        if (debugMode) await getTick(false, -60, true)
        if (debugMode) await getTick(false, -5, true)
        if (debugMode) await getPrice(true, true)

        // Mint fails here since the pool liquidity underflows
        // liquidityDelta on tick 0 (-1999) exceeds the pool's liquidity
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-150',
            upper: '10000',
            expectedUpper: '5560',
            amount: '1000',
            zeroForOne: false,
            balanceInDecrease: '1000',
            liquidityIncrease: "3037",
            balanceOutIncrease: "1",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })
        // price pushed to 5562
        // position gets cuts to 5560
        if (debugMode) await getPrice(true, true)
        await validateBurn({
            signer: hre.props.bob,
            lower: '-20',
            upper: '0',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '1',
            balanceOutIncrease: '0',
            liquidityAmount: BigNumber.from('1999'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-60',
            upper: '50',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '1',
            balanceOutIncrease: '0',
            liquidityAmount: BigNumber.from('363'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            upper: '50',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '1',
            balanceOutIncrease: '0',
            liquidityAmount: BigNumber.from('363'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            upper: '-10',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '1',
            balanceOutIncrease: '0',
            liquidityAmount: BigNumber.from('363'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'PositionNotFound()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-150',
            upper: '5560',
            claim: '5560',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '995',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
      });

    it("pool1 - Should not skip over half tick when pool.tickAtPrice is further along:: GUARDIAN AUDITS", async function () {

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '0',
            upper: '20',
            amount: '2',
            zeroForOne: false,
            balanceInDecrease: '2',
            liquidityIncrease: "1999",
            balanceOutIncrease: "0",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #1 Completed");

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-50',
            upper: '60',
            amount: '2',
            zeroForOne: true,
            balanceInDecrease: '2',
            liquidityIncrease: "0",
            balanceOutIncrease: "1",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #2 Completed");

        // liquidity is stashed on tick 5 when the tick at the current price is tick 4
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-50',
            upper: '60',
            amount: '2',
            zeroForOne: false,
            balanceInDecrease: '2',
            liquidityIncrease: "363",
            balanceOutIncrease: "0",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) await getTick(false, 5, true)

        if (debugMode) console.log("Mint #3 Completed");

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-50',
            upper: '60',
            amount: '2',
            zeroForOne: false,
            balanceInDecrease: '2',
            liquidityIncrease: "363",
            balanceOutIncrease: "0",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #4 Completed");

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-50',
            upper: '60',
            amount: '2',
            zeroForOne: true,
            balanceInDecrease: '2',
            liquidityIncrease: "0",
            balanceOutIncrease: "2",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #5 Completed");

        if (debugMode) await getTick(false, 5, true)
        if (debugMode) await getPrice(false, true)

        // Mint fails here since the pool liquidity underflows
        // liquidityDelta on tick 0 (-1999) exceeds the pool's liquidity
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-10000',
            upper: '150',
            expectedLower: '-5560',
            amount: '1000',
            zeroForOne: true,
            balanceInDecrease: '1000',
            liquidityIncrease: "3037",
            balanceOutIncrease: "1",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '0',
            upper: '20',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '1',
            balanceOutIncrease: '0',
            liquidityAmount: BigNumber.from('1999'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-50',
            upper: '60',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '1',
            balanceOutIncrease: '0',
            liquidityAmount: BigNumber.from('363'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-50',
            upper: '60',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '1',
            balanceOutIncrease: '0',
            liquidityAmount: BigNumber.from('363'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '10',
            upper: '60',
            claim: '0',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '1',
            balanceOutIncrease: '0',
            liquidityAmount: BigNumber.from('363'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'PositionNotFound()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-5560',
            upper: '150',
            claim: '-5560',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '995',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
      });

    it("pool0 - Can claim at the current pool price even when it is not your claim tick", async () => {
        if (debugMode) console.log("Mint #1");

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100000',
            upper: '184550',
            amount: "66907882939022685020",
            zeroForOne: true,
            balanceInDecrease: "66907882939022685020",
            liquidityIncrease: "450934779961490414",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        });

        if (debugMode) console.log("Mint #2");

        if (debugMode) await getPrice(true, true)
        if (debugMode) await getPrice(false, true)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-15180',
            upper: '29790',
            amount: "1000977696770293932",
            zeroForOne: false,
            balanceInDecrease: "1000977696770293932",
            balanceOutIncrease: "66705398633370612078",
            liquidityIncrease: "0",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        });

        if (debugMode) await getPrice(true, true)
        if (debugMode) await getPrice(false, true)

        if (debugMode) console.log("Mint #3");

        expect(await getTickAtPrice(true)).to.eq(16009);

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-50',
            upper: '60',
            amount: "2",
            zeroForOne: true,
            balanceInDecrease: "2",
            balanceOutIncrease: "0",
            liquidityIncrease: "363",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        });

        if (debugMode) await getPrice(true, true)
        if (debugMode) await getPrice(false, true)

        if (debugMode) console.log("Mint #4");

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '10',
            amount: "1",
            zeroForOne: false,
            balanceInDecrease: "1",
            balanceOutIncrease: "0",
            liquidityIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        });

        if (debugMode) await getPrice(true, true)
        if (debugMode) await getPrice(false, true)

        expect(await getTickAtPrice(true)).to.eq(0);

        if (debugMode) console.log("--------------- Burn #5 ---------------");

        // The issue here is that I was able to claim at the current pool price, even though I should
        // have been claiming at a much higher tick.
        // My liquidity is not active at the current pool price because it was previously stashed on an undercut.
        // Therefore, we will try to subtract my position liquidity from the pool liquidity and encounter an underflow.
        // In this case we got an underflow but in many cases this will lead to immense loss of assets for other users in the pool as
        // I can remove their liquidity from the current pool liquidity, and then they cannot exit as they experience the revert.
        // Among other catastrophic things.
        // ACTUAL CLAIM TICK: 16005
        if (debugMode) await getTick(true, 16005, true)
        await validateBurn({
            signer: hre.props.alice,
            lower: '-100000',
            upper: '184550',
            claim: '0', // Claim at current pool price even though my position has been filled at a much higher tick and my liquidity is not active
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: '447895645676095087',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: 'WrongTickClaimedAt5()',
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100000',
            upper: '184550',
            claim: '16005', // Claim at current pool price even though my position has been filled at a much higher tick and my liquidity is not active
            expectedLower: '16005',
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: '1000977696770293931',
            balanceOutIncrease: '202484305652072915',
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '-50',
            upper: '60',
            claim: '0', // Claim at current pool price even though my position has been filled at a much higher tick and my liquidity is not active
            expectedLower: '16005',
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: '0',
            balanceOutIncrease: '1',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        });



        await validateBurn({
            signer: hre.props.alice,
            lower: '-15180',
            upper: '29790',
            claim: '16005', // Claim at current pool price even though my position has been filled at a much higher tick and my liquidity is not active
            expectedLower: '16005',
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '1',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'PositionNotFound()',
        });

    })

    it("pool1 - Can claim at the current pool price even when it is not your claim tick", async () => {
        if (debugMode) console.log("Mint #1");

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-184550',
            upper: '100000',
            amount: "66907882939022685020",
            zeroForOne: false,
            balanceInDecrease: "66907882939022685020",
            liquidityIncrease: "450934779961490414",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        });

        if (debugMode) console.log("Mint #2");

        if (debugMode) await getPrice(true, true)
        if (debugMode) await getPrice(false, true)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-29790',
            upper: '15180',
            amount: "1000877696770293932",
            zeroForOne: true,
            balanceInDecrease: "1000877696770293932",
            balanceOutIncrease: "66705378459522925380",
            liquidityIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        });

        if (debugMode) await getPrice(true, true)
        if (debugMode) await getPrice(false, true)

        if (debugMode) console.log("Mint #3");

        expect(await getTickAtPrice(false)).to.eq(-16008);

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '50',
            amount: "2",
            zeroForOne: false,
            balanceInDecrease: "2",
            balanceOutIncrease: "0",
            liquidityIncrease: "363",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        });

        if (debugMode) await getPrice(true, true)
        if (debugMode) await getPrice(false, true)

        if (debugMode) console.log("Mint #4");

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-10',
            upper: '0',
            amount: "1",
            zeroForOne: true,
            balanceInDecrease: "1",
            balanceOutIncrease: "0",
            liquidityIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        });

        if (debugMode) await getPrice(true, true)
        if (debugMode) await getPrice(false, true)

        expect(await getTickAtPrice(false)).to.eq(0);

        if (debugMode) console.log("--------------- Burn #5 ---------------");

        // The issue here is that I was able to claim at the current pool price, even though I should
        // have been claiming at a much higher tick.
        // My liquidity is not active at the current pool price because it was previously stashed on an undercut.
        // Therefore, we will try to subtract my position liquidity from the pool liquidity and encounter an underflow.
        // In this case we got an underflow but in many cases this will lead to immense loss of assets for other users in the pool as
        // I can remove their liquidity from the current pool liquidity, and then they cannot exit as they experience the revert.
        // Among other catastrophic things.
        // ACTUAL CLAIM TICK: 16005
        if (debugMode) await getTick(false, -16005, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-184550',
            upper: '100000',
            claim: '0', // Claim at current pool price even though my position has been filled at a much higher tick and my liquidity is not active
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: false,
            balanceInIncrease: '447895645676095087',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: 'WrongTickClaimedAt5()',
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '-184550',
            upper: '100000',
            claim: '-16005', // Claim at current pool price even though my position has been filled at a much higher tick and my liquidity is not active
            expectedUpper: '-16005',
            expectedPositionUpper: '-16000',
            liquidityPercent: ethers.utils.parseUnits("5", 37),
            zeroForOne: false,
            balanceInIncrease: '1000686115948161293',
            balanceOutIncrease: '101252239749879806',
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '-184550',
            upper: '-16000',
            claim: '-16005', // Claim at current pool price even though my position has been filled at a much higher tick and my liquidity is not active
            expectedUpper: '-16005',
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: false,
            balanceInIncrease: '191580822132637',
            balanceOutIncrease: '101252239749879806',
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            upper: '50',
            claim: '0', // Claim at current pool price even though my position has been filled at a much higher tick and my liquidity is not active
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '1',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '-29790',
            upper: '15180',
            claim: '-16005', // Claim at current pool price even though my position has been filled at a much higher tick and my liquidity is not active
            expectedLower: '16005',
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '1',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'PositionNotFound()',
        });
    })

    it("pool0 - overriding position when burning to the same lower/upper", async function () {

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '0',
            upper: '200',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: "10050583320695160003177",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #1 Completed");
        if (debugMode) console.log();

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100',
            upper: '200',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: "20151542874862585449132",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #1 Completed");
        if (debugMode) console.log();


        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: BigNumber.from("51000000000000000000"),
            priceLimit: maxPrice,
            balanceInDecrease: '51000000000000000000',
            balanceOutIncrease: '50742541055238885256',
            revertMessage: '',
        })
        if (debugMode) console.log("SWAP #1 Completed");
        if (debugMode) console.log();

        await validateBurn({
            signer: hre.props.bob,
            lower: '0',
            upper: '200',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('0', 36),
            zeroForOne: true,
            balanceInIncrease: '50376233472265442777',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: 'UpdatePositionFirstAt(100, 200)',
        })


        if (debugMode) console.log("BURN #1 Completed");
        if (debugMode) console.log();

        expect(await getPositionLiquidity(true, bob.address, 100, 200)).to.eq("20151542874862585449132");

        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            upper: '200',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '416191159726890981',
            balanceOutIncrease: '99587958272977177819',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) console.log("BURN #2 Completed");
        if (debugMode) console.log();

        // Bobs second position has 0 liquidity
        expect(await getPositionLiquidity(true, bob.address, 100, 200)).to.eq("0");

        await validateBurn({
            signer: hre.props.bob,
            lower: '100',
            upper: '200',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '416191159726890981',
            balanceOutIncrease: '49669500671783936925',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: "reverted with reason string 'PositionNotFound()'",
        })

        // expect(await hre.props.token0.balanceOf(hre.props.limitPool.address)).eq("49669500671783936925");
        // expect(await hre.props.token1.balanceOf(hre.props.limitPool.address)).eq("50583808840273109019");

        await validateBurn({
            signer: hre.props.bob,
            lower: '0',
            upper: '200',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '50583808840273109017',
            balanceOutIncrease: '49669500671783936923',
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: "",
        })

        if (debugMode) console.log("BURN #3 Completed");
    });

    it("pool1 - overriding position when burning to the same lower/upper", async function () {

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-200',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: "10050583320695160003177",
            balanceOutIncrease: "0",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #1 Completed");

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-200',
            upper: '-100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: "20151542874862585449132",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        if (debugMode) console.log("Mint #2 Completed");


        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from("51000000000000000000"),
            priceLimit: minPrice,
            balanceInDecrease: '51000000000000000000',
            balanceOutIncrease: '50742541055238885256',
            revertMessage: '',
        })
        if (debugMode) console.log("SWAP #1 Completed");

        await validateBurn({
            signer: hre.props.bob,
            lower: '-200',
            upper: '0',
            claim: '-100',
            liquidityPercent: ethers.utils.parseUnits('0', 36),
            zeroForOne: false,
            balanceInIncrease: '50376233472265442777',
            balanceOutIncrease: '0',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'UpdatePositionFirstAt(-200, -100)',
        })


        if (debugMode) console.log("BURN #1 Completed");

        expect(await getPositionLiquidity(false, bob.address, -200, -100)).to.eq("20151542874862585449132");

        await validateBurn({
            signer: hre.props.bob,
            lower: '-200',
            upper: '-100',
            claim: '-100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '416191159726890981',
            balanceOutIncrease: '99587958272977177819',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (debugMode) console.log("BURN #2 Completed");

        // Bobs second position has 0 liquidity
        expect(await getPositionLiquidity(false, bob.address, -200, -100)).to.eq("0");

        await validateBurn({
            signer: hre.props.bob,
            lower: '-200',
            upper: '-100',
            claim: '-100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '416191159726890981',
            balanceOutIncrease: '49669500671783936925',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: "reverted with reason string 'PositionNotFound()'",
        })
  
        // expect(await hre.props.token1.balanceOf(hre.props.limitPool.address)).eq("49669500671783936925");
        // expect(await hre.props.token0.balanceOf(hre.props.limitPool.address)).eq("50583808840273109019");

        await validateBurn({
            signer: hre.props.bob,
            lower: '-200',
            upper: '0',
            claim: '-100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '50583808840273109017',
            balanceOutIncrease: '49669500671783936923',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: "",
        })

        if (debugMode) console.log("BURN #3 Completed");
    });

    it("pool0 - Pool State Unsaved Leading To Underflow", async function () {

        if (debugMode) console.log("Mint #1");

        await validateMint({
          signer: hre.props.bob,
          recipient: hre.props.bob.address,
          lower: "120",
          upper: "510",
          amount: "847",
          zeroForOne: true,
          balanceInDecrease: "847",
          liquidityIncrease: "44126",
          balanceOutIncrease: "0",
          upperTickCleared: false,
          lowerTickCleared: true,
          revertMessage: "",
        });

        if (debugMode) console.log("Mint #2");

        await validateMint({
          signer: hre.props.bob,
          recipient: hre.props.bob.address,
          lower: "0",
          upper: "10",
          amount: "1",
          zeroForOne: false,
          balanceInDecrease: "1",
          liquidityIncrease: "1999",
          balanceOutIncrease: "0",
          upperTickCleared: true,
          lowerTickCleared: false,
          revertMessage: "",
        });


        if (debugMode) console.log("Mint #3");

        await validateMint({
          signer: hre.props.bob,
          recipient: hre.props.bob.address,
          lower: "0",
          upper: "20",
          amount: "1",
          zeroForOne: false,
          balanceInDecrease: "1",
          liquidityIncrease: "999",
          positionLiquidityChange: "999",
          balanceOutIncrease: "0",
          upperTickCleared: true,
          lowerTickCleared: false,
          revertMessage: "",
        });

        if (debugMode) console.log("Burn #1");

        // burn position 3
        await validateBurn({
          signer: hre.props.bob,
          lower: "0",
          upper: "20",
          claim: "20",
          liquidityPercent: ethers.utils.parseUnits("1", 38),
          zeroForOne: false,
          balanceInIncrease: "0",
          balanceOutIncrease: "0",
          lowerTickCleared: false,
          upperTickCleared: true,
          revertMessage: "",
        });

        if (debugMode) console.log("Mint #4");

        // no liquidity minted
        await validateMint({
          signer: hre.props.bob,
          recipient: hre.props.bob.address,
          lower: "-20",
          upper: "107510",
          amount: "504",
          zeroForOne: false,
          expectedUpper: '340',
          balanceInDecrease: "504",
          liquidityIncrease: "0",
          balanceOutIncrease: "492",
          upperTickCleared: true,
          lowerTickCleared: false,
          revertMessage: "",
        });

        if (debugMode) console.log("SWAP #1");

        // only bob's 0-10 position is left with token amount of 1
        await validateSwap({
          signer: hre.props.bob,
          recipient: hre.props.bob.address,
          zeroForOne: true,
          amountIn: BigNumber.from("1000000000"),
          priceLimit: BigNumber.from("256"),
          balanceInDecrease: "1",
          balanceOutIncrease: BigNumber.from("0").toString(),
          revertMessage: '',
        });

        // burn position 2
        await validateBurn({
            signer: hre.props.bob,
            lower: "0",
            upper: "10",
            claim: "10",
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: false,
            balanceInIncrease: "0",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "",
        });

        // burn position 1
        await validateBurn({
            signer: hre.props.bob,
            lower: "120",
            upper: "510",
            claim: "340",
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: "503",
            balanceOutIncrease: "354",
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: "",
        });
        

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }        
    });

    it("pool1 - Pool State Unsaved Leading To Underflow", async function () {

        if (debugMode) console.log("Mint #1");

        await validateMint({
          signer: hre.props.bob,
          recipient: hre.props.bob.address,
          lower: "-510",
          upper: "-120",
          amount: "847",
          zeroForOne: false,
          balanceInDecrease: "847",
          liquidityIncrease: "44126",
          balanceOutIncrease: "0",
          upperTickCleared: true,
          lowerTickCleared: false,
          revertMessage: "",
        });

        if (debugMode) console.log("Mint #2");

        await validateMint({
          signer: hre.props.bob,
          recipient: hre.props.bob.address,
          lower: "-10",
          upper: "0",
          amount: "1",
          zeroForOne: true,
          balanceInDecrease: "1",
          liquidityIncrease: "1999",
          balanceOutIncrease: "0",
          upperTickCleared: false,
          lowerTickCleared: true,
          revertMessage: "",
        });


        if (debugMode) console.log("Mint #3");

        await validateMint({
          signer: hre.props.bob,
          recipient: hre.props.bob.address,
          lower: "-20",
          upper: "0",
          amount: "1",
          zeroForOne: true,
          balanceInDecrease: "1",
          liquidityIncrease: "999",
          positionLiquidityChange: "999",
          balanceOutIncrease: "0",
          upperTickCleared: false,
          lowerTickCleared: true,
          revertMessage: "",
        });

        if (debugMode) console.log("Burn #1");
        // burn position 3
        await validateBurn({
          signer: hre.props.bob,
          lower: "-20",
          upper: "0",
          claim: "-20",
          liquidityPercent: ethers.utils.parseUnits("1", 38),
          zeroForOne: true,
          balanceInIncrease: "0",
          balanceOutIncrease: "0",
          lowerTickCleared: true,
          upperTickCleared: false,
          revertMessage: "",
        });

        if (debugMode) console.log("Mint #4");

        await validateMint({
          signer: hre.props.bob,
          recipient: hre.props.bob.address,
          lower: "-107510",
          upper: "20",
          amount: "504",
          zeroForOne: true,
          expectedLower: '-340',
          balanceInDecrease: "504",
          liquidityIncrease: "0",
          balanceOutIncrease: "492",
          upperTickCleared: false,
          lowerTickCleared: true,
          revertMessage: "",
        });

        if (debugMode) console.log("SWAP #1");

        if (debugMode) await getPrice(false, true)

        // only bob's 0-10 position is left with token amount of 1
        await validateSwap({
          signer: hre.props.bob,
          recipient: hre.props.bob.address,
          zeroForOne: false,
          amountIn: BigNumber.from("1000000000"),
          priceLimit: maxPrice,
          balanceInDecrease: "1",
          balanceOutIncrease: BigNumber.from("0").toString(),
          revertMessage: '',
        });
        // burn position 2
        await validateBurn({
            signer: hre.props.bob,
            lower: "-10",
            upper: "0",
            claim: "-10",
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: "0",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "",
        });

        // burn position 2
        await validateBurn({
            signer: hre.props.bob,
            lower: "-510",
            upper: "-120",
            claim: "-340",
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: false,
            balanceInIncrease: "503",
            balanceOutIncrease: "354",
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: "",
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    });

    it("pool0 - Shared TickMap leads to ticks errantly unset", async function () {
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: "-510",
            upper: "10000",
            amount: "227",
            zeroForOne: true,
            balanceInDecrease: "227",
            liquidityIncrease: "541",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: "",
        });

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: "10",
            upper: "107500",
            expectedUpper: "93720",
            amount: "10000000000000000",
            zeroForOne: false,
            balanceInDecrease: "10000000000000000",
            liquidityIncrease: "93116165100287",
            balanceOutIncrease: "226",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: "",
        });

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: "-510",
            upper: "10000",
            amount: "227",
            zeroForOne: false,
            balanceInDecrease: "227",
            liquidityIncrease: "336",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        });

        // When we do this zeroForOne burn we check if ticks0 has any liquidityDelta on tick 10,000
        // before we clear it. There is 0 liquidityDelta on ticks0 tick 10,000, so it is cleared.
        // However, there is nonzero liquidityDelta on tick 10,000 in ticks1 -- this liquidityDelta needs to be applied
        // upon crossing during a swap, however tick 10,000 can never be the cross tick as it is no longer set
        // in the TickMap.
        await validateBurn({
            signer: hre.props.alice,
            lower: "-510",
            upper: "10000",
            claim: "10000",
            liquidityPercent: BigNumber.from("3619953732483784731740789722613948214"),
            zeroForOne: true,
            balanceInIncrease: "364",
            positionLiquidityChange: "541",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "",
        });

        // When we do a swap we never cross tick 10,000 as it was unset in the TickMap.
        // Leading to liquidity never getting kicked in and the accounting system becoming invalidated.
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from("340282366920938463463374607431768211452"),
            priceLimit: BigNumber.from("12"),
            balanceInDecrease: "92210562188207",
            balanceOutIncrease: "9999999999999810",
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: "-510",
            upper: "10000",
            claim: "10000",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: "364",
            positionLiquidityChange: "541",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "PositionNotFound()",
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: "-510",
            upper: "10000",
            claim: "10000",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: "140",
            positionLiquidityChange: "336",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "",
        });

        await getPrice(false, true)

        await validateBurn({
            signer: hre.props.bob,
            lower: "10",
            upper: "93720",
            claim: "10000",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: "92210562188065",
            positionLiquidityChange: "93116165100287",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "",
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        } 
    })

    it("pool1 - Shared TickMap leads to ticks errantly unset", async function () {
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: "-10000",
            upper: "510",
            amount: "227",
            zeroForOne: false,
            balanceInDecrease: "227",
            liquidityIncrease: "541",
            balanceOutIncrease: "0",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: "",
        });

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: "-107500",
            upper: "-10",
            expectedLower: "-93720",
            amount: "10000000000000000",
            zeroForOne: true,
            balanceInDecrease: "10000000000000000",
            liquidityIncrease: "93116165100287",
            balanceOutIncrease: "226",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: "",
        });

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: "-10000",
            upper: "510",
            amount: "227",
            zeroForOne: true,
            balanceInDecrease: "227",
            liquidityIncrease: "336",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        });

        // When we do this zeroForOne burn we check if ticks0 has any liquidityDelta on tick 10,000
        // before we clear it. There is 0 liquidityDelta on ticks0 tick 10,000, so it is cleared.
        // However, there is nonzero liquidityDelta on tick 10,000 in ticks1 -- this liquidityDelta needs to be applied
        // upon crossing during a swap, however tick 10,000 can never be the cross tick as it is no longer set
        // in the TickMap.
        await validateBurn({
            signer: hre.props.alice,
            lower: "-10000",
            upper: "510",
            claim: "-10000",
            liquidityPercent: BigNumber.from("3619953732483784731740789722613948214"),
            zeroForOne: false,
            balanceInIncrease: "364",
            positionLiquidityChange: "541",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "",
        });

        // When we do a swap we never cross tick 10,000 as it was unset in the TickMap.
        // Leading to liquidity never getting kicked in and the accounting system becoming invalidated.
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: BigNumber.from("340282366920938463463374607431768211452"),
            priceLimit: maxPrice,
            balanceInDecrease: "92210562188207",
            balanceOutIncrease: "9999999999999810",
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: "-10000",
            upper: "510",
            claim: "-10000",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: "364",
            positionLiquidityChange: "541",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "PositionNotFound()",
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: "-10000",
            upper: "510",
            claim: "-10000",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: "140",
            positionLiquidityChange: "336",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "",
        });

        if (debugMode) await getPrice(false, true)

        await validateBurn({
            signer: hre.props.bob,
            lower: "-93720",
            upper: "-10",
            claim: "-10",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: "92210562188065",
            positionLiquidityChange: "93116165100287",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "",
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        } 
    })

    it("pool0 - Users Prevented From Burning When Stashed On A Nonstandard Tick", async function () {
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: "-100",
            upper: "100",
            amount: "227",
            zeroForOne: true,
            balanceInDecrease: "227",
            liquidityIncrease: "22701",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: "",
        });

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: BigNumber.from("340282366920938463463374607431768211452"),
            priceLimit: BigNumber.from('79255900000000000000000000000'), // price at tick 7
            balanceInDecrease: "122",
            balanceOutIncrease: "121",
            revertMessage: "",
        });

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: "-100",
            upper: "100",
            amount: "227",
            zeroForOne: true,
            balanceInDecrease: "227",
            liquidityIncrease: "22701",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: "",
        });

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: BigNumber.from("340282366920938463463374607431768211452"),
            priceLimit: BigNumber.from('79251933339942720485266405665'), // price at tick 6
            balanceInDecrease: "121",
            balanceOutIncrease: "120",
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: "-100",
            upper: "100",
            claim: "5",
            expectedLower: "5",
            expectedPositionLower: "0",
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: true,
            balanceInIncrease: "116",
            positionLiquidityChange: "11350",
            balanceOutIncrease: "52",
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: "0",
            upper: "100",
            claim: "5",
            expectedLower: "5",
            expectedPositionLower: "0",
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: true,
            balanceInIncrease: "1",
            positionLiquidityChange: "5675",
            balanceOutIncrease: "26",
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: "0",
            upper: "100",
            claim: "5",
            expectedLower: "5",
            expectedPositionLower: "0",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: "1",
            positionLiquidityChange: "5676",
            balanceOutIncrease: "26",
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: "-100",
            upper: "100",
            claim: "5",
            expectedPositionLower: "0",
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: true,
            balanceInIncrease: "116",
            positionLiquidityChange: "11350",
            balanceOutIncrease: "53",
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: "0",
            upper: "100",
            claim: "5",
            expectedPositionLower: "0",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: "3",
            positionLiquidityChange: "11351",
            balanceOutIncrease: "53",
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: "",
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it("pool1 - Users Prevented From Burning When Stashed On A Nonstandard Tick", async function () {
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: "-100",
            upper: "100",
            amount: "227",
            zeroForOne: false,
            balanceInDecrease: "227",
            liquidityIncrease: "22701",
            balanceOutIncrease: "0",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: "",
        });

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from("340282366920938463463374607431768211452"),
            priceLimit: BigNumber.from('79200400000000000000000000000'), // price at tick -7
            balanceInDecrease: "122",
            balanceOutIncrease: "121",
            revertMessage: "",
        });

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: "-100",
            upper: "100",
            amount: "227",
            zeroForOne: false,
            balanceInDecrease: "227",
            liquidityIncrease: "22701",
            balanceOutIncrease: "0",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: "",
        });

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from("340282366920938463463374607431768211452"),
            priceLimit: BigNumber.from('79204398818407646348591574759'), // price at tick -6
            balanceInDecrease: "121",
            balanceOutIncrease: "120",
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: "-100",
            upper: "100",
            claim: "-5",
            expectedUpper: "-5",
            expectedPositionUpper: "0",
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: false,
            balanceInIncrease: "116",
            positionLiquidityChange: "11350",
            balanceOutIncrease: "52",
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: "-100",
            upper: "0",
            claim: "-5",
            expectedUpper: "-5",
            expectedPositionUpper: "0",
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: false,
            balanceInIncrease: "1",
            positionLiquidityChange: "5675",
            balanceOutIncrease: "26",
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: "-100",
            upper: "0",
            claim: "-5",
            expectedUpper: "-5",
            expectedPositionUpper: "0",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: "1",
            positionLiquidityChange: "5676",
            balanceOutIncrease: "26",
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: "-100",
            upper: "100",
            claim: "-5",
            expectedUpper: "-5",
            expectedPositionUpper: "0",
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: false,
            balanceInIncrease: "116",
            positionLiquidityChange: "11350",
            balanceOutIncrease: "53",
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: "-100",
            upper: "0",
            claim: "-5",
            expectedPositionLower: "0",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: "3",
            positionLiquidityChange: "11351",
            balanceOutIncrease: "53",
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: "",
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it("pool0 - Unsetting ticks leads to invalid claims", async function () {
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: "-510",
            upper: "10000",
            amount: "227",
            zeroForOne: true,
            balanceInDecrease: "227",
            liquidityIncrease: "541",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        });

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: "-20",
            upper: "107510",
            expectedUpper: "96880",
            amount: "504",
            zeroForOne: false,
            balanceInDecrease: "504",
            liquidityIncrease: "1",
            balanceOutIncrease: "226",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: "",
        });

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: "120",
            upper: "510",
            expectedLower: "320",
            amount: "847",
            zeroForOne: true,
            balanceInDecrease: "847",
            liquidityIncrease: "90923",
            balanceOutIncrease: "125",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: "",
        });

        // This position should not be allowed to claim & burn a nonzero amount at 320, however they can.
        // This is because the next tick, the end tick for the position tick 10,000 was unset during a prior swap & cross
        // Therefore when doing the claims validation the next tick is the max tick which has an epoch of 0.
        // The solution is to validate the position's end tick epoch in the EpochMap
        // is not greater than the position's epoch as well.
        // The solution is included in Claims.sol
        await validateBurn({
            signer: hre.props.alice,
            lower: "-510",
            upper: "10000",
            claim: "320",
            expectedLower: "320",
            liquidityPercent: BigNumber.from("13516316073012233858115514669384073923"),
            positionLiquidityChange: '541',
            zeroForOne: true,
            balanceInIncrease: "364",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "",
        });

        // The effects of the invalid claim are realized
        // The swap attempts to transfer out more than the contract has
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: BigNumber.from("866"),
            priceLimit: BigNumber.from("34224716871635992872209592711164142668304641091"),
            balanceInDecrease: "866",
            balanceOutIncrease: "830",
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: "-510",
            upper: "10000",
            claim: "320",
            expectedLower: "320",
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            positionLiquidityChange: '541',
            zeroForOne: true,
            balanceInIncrease: "364",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "PositionNotFound()",
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: "-20",
            upper: "96880",
            claim: "96880",
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            positionLiquidityChange: '1',
            zeroForOne: false,
            balanceInIncrease: "0",
            balanceOutIncrease: "0",
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: "320",
            upper: "510",
            claim: "320",
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: "865",
            balanceOutIncrease: "15",
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: "",
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        } 
    });

    it("pool1 - Unsetting ticks leads to invalid claims", async function () {
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: "-10000",
            upper: "510",
            amount: "227",
            zeroForOne: false,
            balanceInDecrease: "227",
            liquidityIncrease: "541",
            balanceOutIncrease: "0",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        });

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: "-107510",
            upper: "20",
            expectedLower: "-96880",
            amount: "504",
            zeroForOne: true,
            balanceInDecrease: "504",
            liquidityIncrease: "1",
            balanceOutIncrease: "226",
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: "",
        });

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: "-510",
            upper: "-120",
            expectedUpper: "-320",
            amount: "847",
            zeroForOne: false,
            balanceInDecrease: "847",
            liquidityIncrease: "90923",
            balanceOutIncrease: "125",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: "",
        });

        // This position should not be allowed to claim & burn a nonzero amount at 320, however they can.
        // This is because the next tick, the end tick for the position tick 10,000 was unset during a prior swap & cross
        // Therefore when doing the claims validation the next tick is the max tick which has an epoch of 0.
        // The solution is to validate the position's end tick epoch in the EpochMap
        // is not greater than the position's epoch as well.
        // The solution is included in Claims.sol
        await validateBurn({
            signer: hre.props.alice,
            lower: "-10000",
            upper: "510",
            claim: "-320",
            expectedUpper: "-320",
            liquidityPercent: BigNumber.from("13516316073012233858115514669384073923"),
            positionLiquidityChange: '541',
            zeroForOne: false,
            balanceInIncrease: "364",
            balanceOutIncrease: "0",
            lowerTickCleared: true, //TODO: double check this
            upperTickCleared: true,
            revertMessage: "",
        });

        // The effects of the invalid claim are realized
        // The swap attempts to transfer out more than the contract has
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from("866"),
            priceLimit: minPrice,
            balanceInDecrease: "866",
            balanceOutIncrease: "830",
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: "-10000",
            upper: "510",
            claim: "320",
            expectedLower: "320",
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            positionLiquidityChange: '541',
            zeroForOne: false,
            balanceInIncrease: "364",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "PositionNotFound()",
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: "-96880",
            upper: "20",
            claim: "-96880",
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            positionLiquidityChange: '1',
            zeroForOne: true,
            balanceInIncrease: "0",
            balanceOutIncrease: "0",
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: "",
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: "-510",
            upper: "-320",
            claim: "-320",
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: false,
            balanceInIncrease: "865",
            balanceOutIncrease: "15",
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: "",
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        } 
    });
    
    it("pool0 Position.remove entered when position is crossed into", async function () {
        
        await validateMint({
          signer: hre.props.bob,
          recipient: hre.props.bob.address,
          lower: "0",
          upper: "100",
          amount: tokenAmount,
          zeroForOne: true,
          balanceInDecrease: tokenAmount,
          liquidityIncrease: "20051041647900280328782",
          balanceOutIncrease: "0",
          upperTickCleared: false,
          lowerTickCleared: true,
          revertMessage: "",
        });
        if (debugMode) {
            console.log("MINT #1 Completed");
            console.log()
        }


        // This mint does not undercut
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: "10",
            upper: "100",
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: "22284509725894501570567",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: "",
        });
        if (debugMode) {
            console.log("MINT #2 Completed");
            console.log()
        }

        await validateBurn({
            signer: hre.props.bob,
            lower: "0",
            upper: "100",
            claim: "0",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: "0",
            balanceOutIncrease: "99999999999999999999",
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: "",
        });
        if (debugMode) {
            console.log("BURN #1 Completed");
            console.log()
            await getTickAtPrice(true, true)
            await getTickAtPrice(false, true)
        }



        // This mint sets the epoch on tick 10 to epoch 0.
        // Sadly, Bob's position on the other side needs tick 10 to have the right epoch!
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: "10",
            upper: "100",
            expectedUpper: '50',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            positionLiquidityChange: '24854339507101858495720',
            liquidityIncrease: "47138849232996360066287",
            balanceOutIncrease: "50056247163960588354",
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: "",
          });
          if (debugMode) {
            console.log("MINT #3 Completed");
            console.log()
            await getTickAtPrice(true, true)
            await getTickAtPrice(false, true)
        }

       // Claim tick 10 is allowed which causes entry into Positions.remove although position has been partially filled
       // by Mint #3
        await validateBurn({
            signer: hre.props.bob,
            lower: "10",
            upper: "100",
            claim: "10",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: "50219186453346694783",
            balanceOutIncrease: "49943752836039411645",
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: "",
        });
        if (debugMode) console.log("BURN #2 Completed");

        await validateBurn({
            signer: hre.props.alice,
            lower: "10",
            upper: "50",
            claim: "50",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: "0",
            balanceOutIncrease: "49780813546653305215",
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: "",
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }  
    });
      
    it("poo1 Position.remove entered when position is crossed into", async function () {
        
        await validateMint({
          signer: hre.props.bob,
          recipient: hre.props.bob.address,
          lower: "-100",
          upper: "0",
          amount: tokenAmount,
          zeroForOne: false,
          balanceInDecrease: tokenAmount,
          liquidityIncrease: "20051041647900280328782",
          balanceOutIncrease: "0",
          upperTickCleared: true,
          lowerTickCleared: false,
          revertMessage: "",
        });
        console.log("MINT #1 Completed");
        console.log()

        // This mint does not undercut
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: "-100",
            upper: "-10",
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: "22284509725894501570567",
            balanceOutIncrease: "0",
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: "",
          });
        console.log("MINT #2 Completed");
        console.log()

        await validateBurn({
            signer: hre.props.bob,
            lower: "-100",
            upper: "0",
            claim: "0",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: "0",
            balanceOutIncrease: "99999999999999999999",
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: "",
        });
        console.log("BURN #1 Completed");
        console.log()

        await getTickAtPrice(true, true)
        await getTickAtPrice(false, true)

        // This mint sets the epoch on tick 10 to epoch 0.
        // Sadly, Bob's position on the other side needs tick 10 to have the right epoch!
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: "-100",
            upper: "-10",
            expectedLower: '-50',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            positionLiquidityChange: '24296516120648317604804',
            liquidityIncrease: "46581025846542819175371",
            balanceOutIncrease: "51167329561763357462", //TODO: why is this number different on this side
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: "",
          });
        console.log("MINT #3 Completed");
        console.log()
        await getTickAtPrice(true, true)
        await getTickAtPrice(false, true)

       // Claim tick 10 is allowed which causes entry into Positions.remove although position has been partially filled
       // by Mint #3
        await validateBurn({
            signer: hre.props.bob,
            lower: "-100",
            upper: "-10",
            claim: "-10",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: "51336452192195710949",
            balanceOutIncrease: "48832670438236642537",
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: "",
        });
        console.log("BURN #2 Completed");

        await validateBurn({
            signer: hre.props.alice,
            lower: "-50",
            upper: "-10",
            claim: "-50",
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: "0",
            balanceOutIncrease: "48663547807804289049",
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: "",
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }  

    });
})
