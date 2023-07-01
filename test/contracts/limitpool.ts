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
    getTick,
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

        minPrice = BigNumber.from('4297706460')
        maxPrice = BigNumber.from('1460570142285104104286607650833256105367815198570')
        token0Decimals = await hre.props.token0.decimals()
        token1Decimals = await hre.props.token1.decimals()
        tokenAmountBn = ethers.utils.parseUnits('100', token0Decimals)
        tokenAmount = ethers.utils.parseUnits('200', token0Decimals).toString()
        alice = hre.props.alice
        bob = hre.props.bob
        carol = hre.props.carol
    })

    this.beforeEach(async function () {
        await mintSigners20(hre.props.token0, tokenAmountBn.mul(10), [hre.props.alice, hre.props.bob])

        await mintSigners20(hre.props.token1, tokenAmountBn.mul(10), [hre.props.alice, hre.props.bob])
    })

    it('pool0 - Should mint, fully fill, and burn 11', async function () {
        const aliceLiquidity = '20051041647900280328782'
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmountBn,
            zeroForOne: true,
            balanceInDecrease: tokenAmountBn,
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
            amountIn: tokenAmountBn.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: '100501226962305120351',
            balanceOutIncrease: '99999999999999999999',
            revertMessage: '',
        })

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

        await getPositionLiquidity(true, hre.props.alice.address, 0, 100, true)
    })

    it('pool1 - Should mint, fully fill, and burn 11', async function () {
        const aliceLiquidity = '20051041647900280328782'
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmountBn,
            zeroForOne: false,
            balanceInDecrease: tokenAmountBn,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

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

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '0',
            claim: '0',
            liquidityAmount: liquidityAmount,
            zeroForOne: false,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'WrongTickClaimedAt()',
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
            revertMessage: '',
        })
    })

    it('pool0 - Should mint, partially fill, and burn 11', async function () {
        const aliceLiquidity = '20051041647900280328782'
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmountBn,
            zeroForOne: true,
            balanceInDecrease: tokenAmountBn,
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

        await getTick(false, -100, true)

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

        await getTick(false, -100, true)
    })

    it('pool1 - Should mint, partially fill, and burn 11', async function () {
        const aliceLiquidity = '20051041647900280328782'
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmountBn,
            zeroForOne: false,
            balanceInDecrease: tokenAmountBn,
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

        await getTick(false, -100, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '0',
            claim: '-50',
            liquidityAmount: liquidityAmount,
            zeroForOne: false,
            balanceInIncrease: '49999999999999999999',
            balanceOutIncrease: '50124371664105334841',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        await getTick(false, -100, true)
    })

    it('pool0 - Should mint, partially fill, partially burn, fill remaining, and burn again 11', async function () {
        const aliceLiquidity = '20051041647900280328782'
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmountBn,
            zeroForOne: true,
            balanceInDecrease: tokenAmountBn,
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

        await getTick(false, -100, true)
        await getPositionLiquidity(true, hre.props.alice.address, 0, 100, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '100',
            claim: '45',
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: true,
            balanceInIncrease: '49999999999999999999',
            balanceOutIncrease: '25062185832052667420',
            lowerTickCleared: true,
            upperTickCleared: false,
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

        await getTick(false, -100, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '45',
            upper: '100',
            claim: '100',
            liquidityPercent: ethers.utils.parseUnits('1', 38),
            zeroForOne: true,
            balanceInIncrease: '25250613481152560175',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })
        
        await getTick(false, -100, true)
    })

    it('pool1 - Should mint, partially fill, partially burn, fill remaining, and burn again 11', async function () {
        const aliceLiquidity = '20051041647900280328782'
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmountBn,
            zeroForOne: false,
            balanceInDecrease: tokenAmountBn,
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

        await getTick(false, -100, true)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-100',
            upper: '0',
            claim: '-50',
            liquidityPercent: ethers.utils.parseUnits('5', 37),
            zeroForOne: false,
            balanceInIncrease: '49999999999999999999',
            balanceOutIncrease: '25062185832052667420',
            lowerTickCleared: false,
            upperTickCleared: true,
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

        await getTick(false, -100, true)

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
            revertMessage: '',
        })
        await getTick(false, -50, true)
        await getTick(false, -100, true)
    })

    it('pool0 - Should mint, undercut, swap, and burn x2 11', async function () {
        await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100',
            upper: '200',
            amount: tokenAmountBn,
            zeroForOne: true,
            balanceInDecrease: tokenAmountBn,
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

        expect(await getPrice(true, true)).to.be.equal(BigNumber.from('79625275426524748796334487745'))
        // swap tiny
        // price should be at -100 tick
        // undercut
        await getTick(false, -100, true)
        await getTick(false, -105, true)
        console.log('BEFORE MINT 2')
        await getPrice(false, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmountBn,
            zeroForOne: true,
            balanceInDecrease: tokenAmountBn,
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

        await getTick(false, -105, true)
        await getPrice(false, true)

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

        if (true) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }

        await getPrice(true, true)

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

    //TODO: claiming should check pool.price epoch and check next tick epoch after that
    // price lower check true 79625275426524748796330556128 177159557114295710296101716160
    //price lower check false 79625275426524748796330556128 79625275426524748796330556128
    it('pool1 - Should mint, undercut, swap, and burn x2 11', async function () {
        await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-200',
            upper: '-100',
            amount: tokenAmountBn,
            zeroForOne: false,
            balanceInDecrease: tokenAmountBn,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })
        await getPrice(false, true)
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
        await getPrice(false, true)

        expect(await getPrice(false, true)).to.be.equal(BigNumber.from('78833030112140176575858962080'))
        // swap tiny
        // price should be at -100 tick
        // undercut
        await getTick(false, -100, true)
        await getTick(false, -105, true)
        console.log('BEFORE MINT 2')
        await getPrice(false, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmountBn,
            zeroForOne: false,
            balanceInDecrease: tokenAmountBn,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })
        // // price should be at 1.00
        console.log('BEFORE SWAP')
        await getTick(false, -100, true)
        await getTick(false, -105, true)
        await getPrice(false, true)
        await getLiquidity(false, true)

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

        await getTick(false, -105, true)
        await getPrice(false, true)

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

        if (true) {
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
            revertMessage: '',
        })
    })

    it('pool0 - Should mint, undercut, burn undercut swap, and burn 11', async function () {
        await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100',
            upper: '200',
            amount: tokenAmountBn,
            zeroForOne: true,
            balanceInDecrease: tokenAmountBn,
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

        expect(await getPrice(true, true)).to.be.equal(BigNumber.from('79625275426524748796334487745'))
        // swap tiny
        // price should be at -100 tick
        // undercut
        console.log('BEFORE MINT 2')
        await getPrice(true, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmountBn,
            zeroForOne: true,
            balanceInDecrease: tokenAmountBn,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })
        console.log('AFTER MINT 2')
        await getPrice(true, true)
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
        await getPrice(true, true)

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

        if (true) {
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

        await getPrice(true, true)

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

    it('pool1 - Should mint, undercut, burn undercut, swap, and burn 11', async function () {
        await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-200',
            upper: '-100',
            amount: tokenAmountBn,
            zeroForOne: false,
            balanceInDecrease: tokenAmountBn,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })
        await getPrice(false, true)
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
        await getPrice(false, true)

        expect(await getPrice(false, true)).to.be.equal(BigNumber.from('78833030112140176575858962080'))
        // swap tiny
        // price should be at -100 tick
        // undercut
        await getTick(false, -100, true)
        await getTick(false, -105, true)
        console.log('BEFORE MINT 2')
        await getPrice(false, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmountBn,
            zeroForOne: false,
            balanceInDecrease: tokenAmountBn,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })
        // // price should be at 1.00
        console.log('BEFORE SWAP')
        await getTick(false, -100, true)
        await getTick(false, -105, true)
        await getPrice(false, true)
        await getLiquidity(false, true)

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

        await getTick(false, -105, true)
        await getPrice(false, true)

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

        if (true) {
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

    it('pool0 - Should undercut and burn 16', async function () {
        await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '20151542874862585449132'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100',
            upper: '200',
            amount: tokenAmountBn,
            zeroForOne: true,
            balanceInDecrease: tokenAmountBn,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        await getTick(true, 100, true)
        await getTick(true, 105, true)
        // bob should be able to claim something here
        console.log('BEFORE BURN 1')
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

    it('pool1 - Should undercut and burn 16', async function () {
        await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '754380626357928274821'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '19000',
            upper: '20000',
            amount: tokenAmountBn,
            zeroForOne: false,
            balanceInDecrease: tokenAmountBn,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await getTick(true, 100, true)
        await getTick(true, 105, true)
        // bob should be able to claim something here
        console.log('BEFORE BURN 1')
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

    it('pool0 - Should undercut, undercut again, and burn x2 17', async function () {
        await getPrice(false, true)
        const aliceLiquidity = '20051041647900280328782'
        const bobLiquidity = '20151542874862585449132'
        // aliceLiquidity - bobLiquidity
        const aliceMinusBobLiquidity = '-100501226962305120350'
        // mint position
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '100',
            upper: '200',
            amount: tokenAmountBn,
            zeroForOne: true,
            balanceInDecrease: tokenAmountBn,
            liquidityIncrease: bobLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })
        console.log('BEFORE MINT 2')
        await getPrice(true, true)
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmountBn,
            zeroForOne: true,
            balanceInDecrease: tokenAmountBn,
            liquidityIncrease: aliceMinusBobLiquidity,
            positionLiquidityChange: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })
        //price: 79625275426524748796330556128 100
        //price: 79625275426524748796330556128 100
// price: 177159557114295710296101716160 16095
// pool0 20151542874862585449132 true
// saving pool0 20151542874862585449132
// 100 tick: 0,0
// 105 tick: 0,0
// BEFORE MINT 2
// price: 79625275426524748796330556128 100
// changing liquidity
// tick to save check
// 100
// 79625275426524748796330556128
// 79625275426524748796330556128
// pool0 20051041647900280328782 true
// saving pool0 20051041647900280328782
// 100 tick: 0,100501226962305120350
// 105 tick: 0,0

// price: 215353707227994575755767921544 20000
// pool0 0 true
// saving pool0 0
// 100 tick: 0,0
// 105 tick: 79625275426524748796334487745,0
// BEFORE MINT 2
// price: 79625275426524748796330556128 100
// pool0 20051041647900280328782 true
// saving pool0 20051041647900280328782
// 100 tick: 0,-20051041647900280328782
// 105 tick: 79625275426524748796334487745,0
// BEFORE BURN 1
// burn percent 100
// calling deltas
// early return 1 19 18 18
// -40202584522762865777914
// position amounts 0 99999999999999999999
// 100 tick: 0,-40202584522762865777914
// 105 tick: 79625275426524748796334487745,0
        // bob should be able to claim something here
        console.log('BEFORE BURN 1')
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
        await getTick(true, 100, true)
        await getTick(true, 105, true)
        //TODO: burn alice's position and check all epochs are correct
        // await validateBurn({
        //     signer: hre.props.alice,
        //     lower: '0',
        //     upper: '100',
        //     claim: '5',
        //     liquidityPercent: ethers.utils.parseUnits('1', 38),
        //     zeroForOne: true,
        //     balanceInIncrease: '0',
        //     balanceOutIncrease: '99999999999999999999',
        //     lowerTickCleared: false,
        //     upperTickCleared: false,
        //     revertMessage: '',
        // })
    })
})
