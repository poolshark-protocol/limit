/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { mintSigners20 } from '../utils/token'
import {
    BN_ZERO,
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
        const pool0: PoolState = await hre.props.limitPool.pool0()
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
    })

    it('pool0 - Should mint, fill, and burn', async function () {
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

    it('pool1 - Should mint, fill, and burn', async function () {
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

    it('pool0 - Should mint, partially fill, and burn', async function () {
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

    it('pool1 - Should mint, partially fill, and burn', async function () {
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

    it('pool0 - Should mint, partial fill, partial burn, fill leftover, and burn again', async function () {
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

    it('pool1 - Should mint, partial fill, partial burn, fill leftover, and burn again', async function () {
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
            expectedUpper: '-40',
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

    it('pool0 - Should mint, undercut, swap, and burn', async function () {
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

    it('pool1 - Should mint, undercut, swap, and burn', async function () {
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

        //TODO: test undercut on top of undercut
        //swaps from 100 to 200
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
        //TODO: test undercut on top of undercut
        //swaps from 100 to 200
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
            lowerTickCleared: true,
            expectedLower: '200',
            revertMessage: '',
        })
        // return
        if (debugMode) await getPrice(true, true)
        if (debugMode) console.log('BEFORE BURN 1')
        if (debugMode) await getTick(false, 21000, true)
        // close both positions
        //amountOut should be
        //49861732254639926627
        //TODO: claim tick at 145 does not complain about epoch on 150
        //TODO: claim tick at 150 is not reverted
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
            lower: '200',
            upper: '300',
            claim: '150',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
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

        //TODO: make sure active pool liquidity is removed on burn removal
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
            balanceInDecrease: '126593680232133996918', //TODO: check these amounts are correct
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
        //TODO: revert if there is no liquidity

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
            balanceOutIncrease: '93503056303984116865', //TODO: if we go back to the same tick why is amountOut more?
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
            balanceOutIncrease: '93503056303984116865', //TODO: if we go back to the same tick why is amountOut more?
            lowerTickCleared: false,
            upperTickCleared: true,
            expectedUpper: '-120',
            revertMessage: 'NoPositionUpdates()',
        })

        if (debugMode) console.log('BEFORE MINT 3')

        //TODO: make sure active pool liquidity is removed on burn removal
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

        //TODO: make sure active pool liquidity is removed on burn removal
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
            priceLimit: BigNumber.from('78734600000000000000000000000'), // price at tick -125
            balanceInDecrease: '126593680232133996918', //TODO: check these amounts are correct
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
        //TODO: revert if there is no liquidity
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
            balanceOutIncrease: '93503056303984116865', //TODO: if we go back to the same tick why is amountOut more?
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
            balanceOutIncrease: '93477672367024421972', //TODO: if we go back to the same tick why is amountOut more?
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
            balanceOutIncrease: '93477672367024421972', //TODO: if we go back to the same tick why is amountOut more?
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

    it('pool0 - insertSingle double counts liquidity 23', async function () {
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

    it('pool1 - insertSingle double counts liquidity 23', async function () {
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
})
