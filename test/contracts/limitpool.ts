/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { mintSigners20 } from '../utils/token'
import {
    validateMint,
    BN_ZERO,
    validateSwap,
    validateBurn,
    PoolState,
    validateSync,
    getLatestTick,
    getLiquidity,
    getPrice,
    getTick,
    getPositionLiquidity,
} from '../utils/contracts/limitpool'

alice: SignerWithAddress
describe('LimitPool Tests', function () {
    let tokenAmount: BigNumber
    let token0Decimals: number
    let token1Decimals: number
    let minPrice: BigNumber
    let maxPrice: BigNumber

    let alice: SignerWithAddress
    let bob: SignerWithAddress
    let carol: SignerWithAddress

    const liquidityAmount = BigNumber.from('99855108194609381495771')
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
        let currentBlock = await ethers.provider.getBlockNumber()
        let currentTime = (await ethers.provider.getBlock(currentBlock)).timestamp
        let lastTime = (await ethers.provider.getBlock(currentBlock - 1)).timestamp
        const pool0: PoolState = await hre.props.limitPool.pool0()
        const liquidity = pool0.liquidity
        const globalState = await hre.props.limitPool.globalState()
        const amountInDelta = pool0.amountInDelta
        const price = pool0.price
        const latestTick = globalState.latestTick

        expect(liquidity).to.be.equal(BN_ZERO)
        expect(genesisTime).to.be.equal(currentTime - 2)
        expect(amountInDelta).to.be.equal(BN_ZERO)
        expect(latestTick).to.be.equal(BN_ZERO)

        minPrice = BigNumber.from('4297706460')
        maxPrice = BigNumber.from('1460570142285104104286607650833256105367815198570')
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

    it('pool0 - Should wait until enough observations', async function () {
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: 'WaitUntilEnoughObservations()',
            collectRevertMessage: 'WaitUntilEnoughObservations()'
        })

        // no-op swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount,
            priceLimit: minPrice,
            balanceInDecrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            revertMessage: 'WaitUntilEnoughObservations()',
            syncRevertMessage: 'WaitUntilEnoughObservations()'
        })

        // burn should revert
        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '0',
            claim: '0',
            liquidityAmount: liquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount.sub(1),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'WaitUntilEnoughObservations()',
        })
    })

    it('pool1 - Should wait until enough observations', async function () {
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: 'WaitUntilEnoughObservations()',
            collectRevertMessage: 'WaitUntilEnoughObservations()',
        })

        // no-op swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmount,
            priceLimit: minPrice,
            balanceInDecrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            revertMessage: 'WaitUntilEnoughObservations()',
            syncRevertMessage: 'WaitUntilEnoughObservations()'
        })

        // burn should revert
        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            upper: '0',
            claim: '0',
            liquidityAmount: liquidityAmount,
            zeroForOne: false,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount.sub(1),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'WaitUntilEnoughObservations()',
        })
    })

    it('pool0 - Should mint/burn new LP position', async function () {
        // process two mints
        for (let i = 0; i < 2; i++) {
            await validateMint({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                lower: '-40',
                upper: '-20',
                amount: tokenAmount,
                zeroForOne: true,
                balanceInDecrease: tokenAmount,
                liquidityIncrease: liquidityAmount,
                upperTickCleared: false,
                lowerTickCleared: false,
                revertMessage: '',
            })
        }

        // process no-op swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount,
            priceLimit: maxPrice,
            balanceInDecrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            revertMessage: '',
        })

        // process two burns
        for (let i = 0; i < 2; i++) {
            await validateBurn({
                signer: hre.props.alice,
                lower: '-40',
                claim: '-20',
                upper: '-20',
                liquidityAmount: liquidityAmount,
                zeroForOne: true,
                balanceInIncrease: BN_ZERO,
                balanceOutIncrease: tokenAmount.sub(1),
                lowerTickCleared: false,
                upperTickCleared: false,
                revertMessage: '',
            })
        }
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool0 - Should mint, swap, and then claim entire range', async function () {
        if (debugMode) await getPrice(true, true)
        await validateSync(0)
        if (debugMode) await getPrice(true, true)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-40',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('99620704132805394768'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '-40',
            upper: '-20',
            liquidityAmount: liquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount,
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'WrongTickClaimedAt()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '-20',
            upper: '-20',
            liquidityAmount: liquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('99620704132805394768'),
            balanceOutIncrease: BigNumber.from('0'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '-20',
            upper: '-20',
            liquidityAmount: BigNumber.from('1'),
            zeroForOne: false,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'NotEnoughPositionLiquidity()',
        })
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool0 - Should revert if tick not divisible by tickSpread', async function () {
        // move TWAP to tick 0
        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-30',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: 'LowerTickOutsideTickSpacing()',
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-40',
            upper: '-10',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: 'UpperTickOutsideTickSpacing()',
        })
    })

    it('pool0 - Should swap with zero output', async function () {
        // move TWAP to tick 0
        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-40',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '-20',
            upper: '-20',
            liquidityAmount: liquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount.sub(1),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool0 - Should handle partial mint', async function () {
        const liquidityAmount3 = BigNumber.from('49952516624167694475096')
        const tokenAmount3 = BigNumber.from('50024998748000306423')
        // move TWAP to tick 0
        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-40',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount3,
            liquidityIncrease: liquidityAmount3,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
            expectedUpper: '-20',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '0',
            upper: '0',
            liquidityAmount: liquidityAmount3,
            zeroForOne: true,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount3.sub(1),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'NotEnoughPositionLiquidity()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '-20',
            upper: '-20',
            liquidityAmount: liquidityAmount3,
            zeroForOne: true,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount3.sub(1),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool0 - Should move TWAP in range, partial fill, and burn 43', async function () {
        const liquidityAmount4 = BigNumber.from('49902591570441687020675')

        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: BigNumber.from('79148977909814923576066331264'),
            balanceInDecrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('10046091377314633368'),
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-20',
            upper: '-20',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('89953908622685366631'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }

        await validateSync(0)
    })

    it('pool0 - Should handle partial range cross w/ unfilled amount', async function () {
        const liquidityAmount4 = BigNumber.from('49952516624167694475096')

        await validateSync(20)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-40',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            revertMessage: '',
        })

        await validateSync(0)
        await validateSync(-20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: tokenAmount.div(10),
            balanceOutIncrease: BigNumber.from('10046093394583832551'),
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '0',
            upper: '0',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'WrongTickClaimedAt()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '-20',
            upper: '0',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('89953906605416167448'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
    })

    it('pool0 - Should move TWAP in range, partial fill, sync lower tick, and burn 54', async function () {
        const liquidityAmount4 = BigNumber.from('49902591570441687020675')

        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: BigNumber.from('79148977909814923576066331265'),
            balanceInDecrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('10046091377314633368'),
            revertMessage: '',
        })

        await validateSync(-40)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-20',
            upper: '-20',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('89953906605416167448'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'WrongTickClaimedAt()',
        })

        await validateSync(-60)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-20',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('89959930249908791288'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'WrongTickClaimedAt()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-60',
            upper: '-20',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('89953908622685366631'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateSync(-40)
        await validateSync(-20)

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-60')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-60')).amountOutDeltaMaxMinus.toString())
        }
    })

    it("pool0 - fully filled auction should push claim to next tick :: GUARDIAN AUDITS 21", async () => {
        await validateSync(20);
        const aliceLiquidityAmount = BigNumber.from('24951283310825598484485')

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-80',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(0)
        await validateSync(-20)
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("24951283310825598484485");

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount,
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('24892711623697875920'),
            balanceOutIncrease: BigNumber.from('24987488133503998990'),
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-80',
            claim: '-20',
            upper: '0',
            liquidityAmount: aliceLiquidityAmount.div(2),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('24892711623697875920'),
            balanceOutIncrease: BigNumber.from('49987513124744754071'),
            lowerTickCleared: false,
            upperTickCleared: true,
            expectedUpper: '-40',
            revertMessage: '',
        });
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("12475641655412799242244");
        if (debugMode) await getTick(true, -20, debugMode)
        await validateSync(-40);
        if (debugMode) await getTick(true, -40, debugMode)
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("12475641655412799242244");

        await validateSync(-60);
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("12475641655412799242244");
        if (debugMode) await getTick(true, -60, debugMode)
        if (debugMode) await getTick(true, -80, debugMode)
        await validateSync(-80);
        if (debugMode) await getTick(true, -80, debugMode)
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("0");
        // // Notice that the following burn reverts -- if the subtraction from the end tick in section2
        // // is removed the double counting no longer occurs -- and the burn can succeed.

        // // Notice that after implementing the suggested fix above, 
        // // during the burn we log a percentInOnTick value that is greater than 100
        // // This is due to section2 counting a larger price range then it ought to.
        // // Currently, the section2 function will include tick -20 in it's calculations.
        // // However tick -20 was already claimed by the user in the previous burn from section4.
        // // The priceClaimLast ought to be updated to tick -40 in section1, but since the previous auction
        // // was fully filled, it was not. The fix for this is to allow this case to enter the else if in
        // // section1 so that the cache.position.claimPriceLast can be pushed to tick -40.
        await validateBurn({
            signer: hre.props.alice,
            lower: '-80',
            claim: '-80',
            upper: '-40',
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('25024998741751246936'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

    });

    it("pool0 - accounting should be correct for multiple positions sharing same range :: GUARDIAN AUDITS", async () => {
        await validateSync(20);
        const aliceLiquidityAmount = BigNumber.from('24951283310825598484485')
        const bobLiquidityAmount = BigNumber.from('24951283310825598484485')

        if (debugMode) console.log("--------------- Alice First mint -------------");

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-80',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-80',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(0)

        await validateSync(-20)
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("49902566621651196968970");

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount,
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('49785423247395751841'),
            balanceOutIncrease: BigNumber.from('49974976267007997981'),
            revertMessage: '',
        })

        if (debugMode) console.log("--------------- Alice #1 burn ---------------");

        await validateBurn({
            signer: hre.props.alice,
            lower: '-80',
            claim: '-20',
            upper: '0',
            liquidityAmount: aliceLiquidityAmount.div(2),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('24892711623697875920'),
            balanceOutIncrease: BigNumber.from('49987513124744754071'),
            lowerTickCleared: false,
            upperTickCleared: true,
            expectedUpper: '-40',
            revertMessage: '',
        });

        await validateSync(-40);
        await validateSync(-60);

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount,
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('37264467655248218930'),
            balanceOutIncrease: BigNumber.from('37556265921744461147'),
            revertMessage: '',
        });
        await validateSync(-80);

        if (debugMode) console.log("--------------- Alice #2 Burn -------------");

        await validateBurn({
            signer: hre.props.alice,
            lower: '-80',
            claim: '-80',
            upper: '-40',
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('12421489218416072976'),
            balanceOutIncrease: BigNumber.from('12506243434503093221'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        if (debugMode) console.log("--------------- Bob #2 Burn -------------");

        await validateBurn({
            signer: hre.props.bob,
            lower: '-80',
            claim: '-80',
            upper: '-0',
            liquidityAmount: bobLiquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('49735690060530021875'),
            balanceOutIncrease: BigNumber.from('49975001251999693578'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });
    });

    it("pool0 - outdated price does not perturb the pool accounting :: GUARDIAN AUDITS", async function () {
        const liquidityAmountBob = BigNumber.from('497780033507028255257726') 
        await validateSync(0);

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-40',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        // Bob also mints a much larger position further down the ticks
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-100',
            upper: '-80',
            amount: tokenAmount.mul(5),
            zeroForOne: true,
            balanceInDecrease: tokenAmount.mul(5),
            liquidityIncrease: liquidityAmountBob,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        });

        await validateSync(-20); // The outdated price that will be used during the swap

        await validateSync(-60, false);

        // Even though there was not nearly enough liquidity at the current tick (-60)
        // I was able to swap 200 of token 1 for token 0... and I stole from the funds in Bob's
        // position (liquidity that should not be available at this tick) to do so.

        /// @alphak3y - FIXED => there should be nothing to swap here
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            revertMessage: '',
        });
        await getLatestTick(latestTickCheck) // set to true to print 

        // This is because the PoolState memory pool variable is cached before
        // the syncLatest is performed. Therefore the cache.price used in the swap will be outdated.
        // If the Twap price moves ahead of this outdated price, the outdated price will now be
        // higher than the Twap price -- resulting in an underflow when we calculate maxDy.
        // Therefore maxDy is on the order of magnitude of the max uint256.
        // With maxDy exceedingly high any amount can be swapped in the current auction, severely perturbing
        // the pool's accounting.

        // *Note the maxDy value is being logged so you can see it is nearly the max uint256.
        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '-40',
            upper: '-20',
            liquidityAmount: liquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount.sub(1),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await getLatestTick(latestTickCheck)

        const balanceOutIncrease1 = BigNumber.from('100300435406274192565')

        await validateBurn({
            signer: hre.props.bob,
            lower: '-100',
            claim: '-80',
            upper: '-80',
            liquidityAmount: liquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: balanceOutIncrease1,
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-100',
            claim: '-80',
            upper: '-80',
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount.mul(5).sub(1).sub(balanceOutIncrease1),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })
    });

    it("pool0 - liquidityDelta added to stash tick for resuming position fill :: GUARDIAN AUDITS", async function () {
        await validateSync(20);

        const aliceLiquidity = BigNumber.from("33285024970969944913475")

        // Alice creates a position from 0 -> -20
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
            expectedUpper: '0',
        });

        // Price goes into Alice's position
        await validateSync(0);

        let upperTick = await hre.props.limitPool.ticks0(0);
        expect(upperTick.liquidityDelta).to.eq("33285024970969944913475");

        // After going down to -20, tick 0 will be the cross tick and the liquidityDelta will be cleared
        await validateSync(-20);
        upperTick = await hre.props.limitPool.ticks0(0);
        expect(upperTick.liquidityDelta).to.eq("0");

        // Pool has active liquidity once tick0 is crossed.
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("33285024970969944913475");

        // Go back up to tick 0. Since there is no liquidity delta on tick0 anymore, the system
        // will not kick in any liquidity into the pool for swapping.
        await validateSync(0);
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("0");

        // Nothing gained from swap as no liquidity is active in the pool
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            revertMessage: '',
        });

        await validateSync(-20); 
        await validateSync(-40); 
        await validateSync(
            -60,
            true
        );

        // alice can now burn her position
        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-60',
            upper: '0',
            liquidityAmount: aliceLiquidity,
            zeroForOne: true,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount.sub(2),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "",
        });

    });

    it("pool1 - multiple tick length jumps should not cause users to lose assets3 :: GUARDIAN AUDITS", async () => {
        // Note: unused, way to initialize all the ticks in the range manually
        let liquidityAmountBob = hre.ethers.utils.parseUnits("99855108194609381495771", 0);

        await validateSync(20);
        const liquidityAmount2 = hre.ethers.utils.parseUnits('16617549983581976690927', 0);
        liquidityAmountBob = hre.ethers.utils.parseUnits("99855108194609381495771", 0);

        const aliceLiquidityAmount = BigNumber.from('0')
        const bobLiquidityAmount = BigNumber.from('24951283310825598484485')

        // console.log("--------------- Alice First mint -------------");

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-120',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })
        if(debugMode) console.log("--------------- Sync 0 -------------");
        await validateSync(0)
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("16617549983581976690927");
        if(debugMode) console.log("--------------- Sync 20 -------------");
        await validateSync(-20)
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("16617549983581976690927");

        if(debugMode) console.log("--------------- Sync 40 -------------");
        await validateSync(-40);
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("16617549983581976690927");

        if(debugMode) console.log("--------------- Alice #1 burn ---------------");

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120',
            claim: '-40',
            upper: '0',
            liquidityAmount: BigNumber.from('0'),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('33266692264193520416'),
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        if(debugMode) console.log("--------------- Sync 120 -------------");
        await validateSync(-120);

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120',
            claim: '-120',
            upper: '-40',
            liquidityAmount: BN_ZERO,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('66733307735806479581'), // Notice Alice gets her position back
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })
    });

    it("pool0 - liquidity should not be locked due to Deltas.to calculation :: GUARDIAN AUDITS", async function () {
        await validateSync(20);

        // Alice creates a position from 0 to -20
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-20',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: BigNumber.from("99955008249587388643769"),
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
            expectedUpper: '0',
        });

        // Bob creates a position from 0 to -20
        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-20',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: BigNumber.from("99955008249587388643769"),
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
            expectedUpper: '0',
        });

        await validateSync(0);  // Trigger Auction from 0 -> -20

        // Active liquidity consists of liquidity which Alice and Bob provided.
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("199910016499174777287538");

        // User swaps in 10 tokens.
        // Now the pool should consist of 190 token0 and 10 token1.
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10), // Swap in 10 tokens
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('10027532520796879175'),
            revertMessage: '',
        });

        await validateSync(-20);

        // Bob claims on lower tick
        await validateBurn({
            signer: hre.props.bob,
            lower: '-20',
            claim: '-20',
            upper: '0',
            liquidityAmount: BigNumber.from("99955008249587388643769"),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from("5000000000000000000"), // Get half of the 10 tokens swapped in
            balanceOutIncrease: BigNumber.from("94986233739601560412"), // ~(100 - 5)
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        // Alice is unable to burn. Her liquidity is locked.
        // This is because Deltas.to performs `toTick.deltas.amountOutDelta += fromDeltas.amountOutDeltaMax`
        // instead of `toTick.deltas.amountOutDelta += fromDeltas.amountOutDelta`
        // As a result, the delta on the claim tick is larger than supposed to be 
        // and more tokens are sent to the user than intended. Around 100 token0 are attempted to
        // be sent to Alice although her allocation should only be about 95 token0.
        await validateBurn({
            signer: hre.props.alice,
            lower: '-20',
            claim: '-20',
            upper: '0',
            liquidityAmount: BigNumber.from("1"),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from("5000000000000000000"),
            balanceOutIncrease: BigNumber.from("94986233739601560411"), // This is the increase it ought to be it is actually 99999999999999999999
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: "",
        });
    });

    it("pool0 - amountOutDeltaMax should not underflow :: GUARDIAN AUDITS", async function () {
        await validateSync(20);
        const aliceLiquidityAmount = BigNumber.from('49952516624167694475096')
        const bobLiquidityAmount = BigNumber.from('24951283310825598484485')

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-40',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        });

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-80',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        });

        // await validateSync(0)
        await validateSync(-20);
        
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount,
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('74727967618882864170'),
            balanceOutIncrease: BigNumber.from('75012486881504305413'),
            revertMessage: '',
        });

        // Notice that Bob's burn reverts due to an underflow in the amountOutDeltaMax.
        // This is because the cache.finalDeltas.amountOutDelta is not removed from the
        // cache.finalDeltas.amountOutDeltaMax after it is shifted onto the cache.position.amountOut.
        // Once that value is decremented from the cache.finalDeltas.amountOutDeltaMax, the
        // burn can happen and Bob's funds are no longer locked.
        // When you uncomment the suggested line, the following burn no longer reverts & Bob receives
        // the expected amount of token0 & token1.
        // Without the suggestion, bobs funds are locked and he cannot retrieve them until
        // his position is fully filled.
        if (deltaMaxAfterCheck) {
            console.log('claim tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-20')).amountInDeltaMaxStashed.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-20')).amountOutDeltaMaxStashed.toString())
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-80')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-80')).amountOutDeltaMaxMinus.toString())
        }

        await validateBurn({
            signer: hre.props.bob,
            lower: '-80',
            claim: '-20', // Bob claims partially through his position @ tick -20
            upper: '0',
            liquidityAmount: bobLiquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('24892711623697875920'),
            balanceOutIncrease: BigNumber.from('75012511866496001008'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '-20', // Alice claims partially through her position @ tick -20
            upper: '0',
            liquidityAmount: aliceLiquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('49835255995184988250'),
            balanceOutIncrease: BigNumber.from('49975001251999693578'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        if (deltaMaxAfterCheck) {
            console.log('claim tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-20')).amountInDeltaMaxStashed.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-20')).amountOutDeltaMaxStashed.toString())
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-80')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-80')).amountOutDeltaMaxMinus.toString())
        }

    });

    it("pool0 - Claim on stash tick; Mint again on start tick in same transaction :: alphak3y 312", async () => {
        await validateSync(20);
        const aliceLiquidityAmount = BigNumber.from('33285024970969944913475')
        const aliceLiquidityAmount2 = BigNumber.from('99755307984763292988257')

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(0)
        await validateSync(-20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: tokenAmount.div(10),
            balanceOutIncrease: BigNumber.from('10045083801850091530'),
            revertMessage: '',
        })

        if (debugMode) await getTick(true, -20, debugMode)

        await validateSync(20)

        if (debugMode) {
            await getTick(true, -20, debugMode)
            await getLiquidity(true, debugMode)
            await getPositionLiquidity(true, alice.address, -60, -20, debugMode)
            await getPositionLiquidity(true, alice.address, -60, -40, debugMode)
            await getTick(true, 0, debugMode)
        }

        // minting with claim is the same outcome as burning with claim
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: BigNumber.from('43411754351405135504'), // alice gets amounOut back
            balanceOutIncrease: BigNumber.from('10000000000000000000'),
            liquidityIncrease: aliceLiquidityAmount,
            positionLiquidityChange: BigNumber.from('0'),
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: 'UpdatePositionFirstAt(-60, 0)'
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '0',
            liquidityAmount: BN_ZERO,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('56588245648594864496'),  // alice gets amounOut back
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: BigNumber.from('100000000000000000000'),
            liquidityIncrease: aliceLiquidityAmount,
            positionLiquidityChange: BigNumber.from('33285024970969944913475'),
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: ''
        })
        // await getTick(true, -40, debugMode)
        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-40',
            liquidityAmount: aliceLiquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('33366670549555043972'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '', // Alice cannot claim at -20 when she should be able to
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '0',
            upper: '0',
            liquidityAmount: aliceLiquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '', // Alice cannot claim at -20 when she should be able to
        })
        if (debugMode) await getLatestTick(debugMode)
    });

    it("pool0 - Claim on stash tick; Mint after sync; Block overlapping position claim 312", async () => {
        if (debugMode) await getLatestTick(debugMode)
        await validateSync(20);
        const aliceLiquidityAmount = BigNumber.from('33285024970969944913475')
        const aliceLiquidityAmount2 = BigNumber.from('99755307984763292988257')
        if (debugMode) await getLatestTick(debugMode)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(0)
        await validateSync(-20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: tokenAmount.div(10),
            balanceOutIncrease: BigNumber.from('10045083801850091530'),
            revertMessage: '',
        })

        if (debugMode) await getTick(true, -20, debugMode)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-20',
            upper: '0',
            liquidityAmount: aliceLiquidityAmount.div(2),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('61627461712629427891'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
        await validateSync(0)
        if (debugMode) await getTick(true, -20, debugMode)
        if (debugMode) await getLiquidity(true, debugMode)
        if (debugMode) await getPositionLiquidity(true, alice.address, -60, -20, debugMode)
        if (debugMode) await getPositionLiquidity(true, alice.address, -60, -40, debugMode)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '-40',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidityAmount2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })
        if (debugMode) await getTick(true, -40, debugMode)
        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-20',
            liquidityAmount: aliceLiquidityAmount.div(2),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('61630471922511652518'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'UpdatePositionFirstAt(-60, -40)', // Alice cannot claim until she closes her position at (-60, -40)
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-40',
            liquidityAmount: aliceLiquidityAmount2,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '', // Alice cannot claim until she closes her position at (-60, -40)
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-20',
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('28327454485520480577'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '', // Alice cannot claim until she closes her position at (-60, -40)
        })

        // Alice cannot claim at this tick since the following tick, -40 is set in the EpochMap when syncing latest
        // -40 should only be set in the EpochMap if we successfully cross over it.
        // This can lead to users being able to claim amounts from ticks that have not yet actually
        // been crossed, potentially perturbing the pool accounting.
        // In addition to users not being able to claim their filled amounts as shown in this PoC.
    });

    it("pool0 - Claim on stash tick; Mint again on stash tick", async () => {
        await validateSync(20);
        const aliceLiquidityAmount = BigNumber.from('33285024970969944913475')
        const aliceLiquidityAmount2 = BigNumber.from('99755307984763292988257')

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(0)
        await validateSync(-20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: tokenAmount.div(10),
            balanceOutIncrease: BigNumber.from('10045083801850091530'),
            revertMessage: '',
        })

        if (debugMode) await getTick(true, -20, debugMode)

        await validateSync(0)
        if (debugMode) await getTick(true, -20, debugMode)
        if (debugMode) await getLiquidity(true, debugMode)
        if (debugMode) await getPositionLiquidity(true, alice.address, -60, -20, debugMode)
        if (debugMode) await getPositionLiquidity(true, alice.address, -60, -40, debugMode)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '0',
            liquidityAmount: aliceLiquidityAmount.div(2),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('73271580923372386482'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '-40',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidityAmount2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })
        if (debugMode) await getTick(true, -40, debugMode)
        /// @dev - minAmountPerAuction turned off for Arbitrum testnet
        // await validateBurn({
        //     signer: hre.props.alice,
        //     lower: '-60',
        //     claim: '-40',
        //     upper: '-40',
        //     liquidityAmount: aliceLiquidityAmount.div(2).add(1).add(aliceLiquidityAmount2),
        //     zeroForOne: true,
        //     balanceInIncrease: BigNumber.from('0'),
        //     balanceOutIncrease: BigNumber.from('116683335274777521986'),
        //     lowerTickCleared: false,
        //     upperTickCleared: false,
        //     revertMessage: 'PositionAuctionAmountTooSmall()',
        // })
        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-40',
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('116683335274777521986'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })
    });

    it("pool0 - Users cannot claim at the right tick :: GUARDIAN AUDITS", async () => {
        await validateSync(20);
        const aliceLiquidityAmount = BigNumber.from('49952516624167694475096')

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-40',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(0)
        await validateSync(-20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: tokenAmount.div(10),
            balanceOutIncrease: BigNumber.from('10046093394583832551'),
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '-20',
            upper: '0',
            liquidityAmount: aliceLiquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('89953906605416167448'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
    });

    it("pool0 - twap rate-limiting yields invalid tick :: GUARDIAN AUDITS 58", async function () {
        await validateSync(20);

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-20',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: BigNumber.from("99955008249587388643769"),
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        });

        await validateSync(-20);

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-60',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: BigNumber.from("33366670549555043973"),
            liquidityIncrease: BigNumber.from("33285024970969944913475"),
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
            expectedUpper: '-40'
        });

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from("0"),
            balanceOutIncrease: BigNumber.from('0'),
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '-20',
            claim: '-20',
            upper: '0',
            liquidityAmount: BigNumber.from("99955008249587388643769"), // Alice was already filled 100%
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.bob,
            lower: '-60',
            claim: '-25',
            upper: '-25',
            liquidityAmount: BigNumber.from("33285024970969944913475"),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('0'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'NotEnoughPositionLiquidity()',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-60',
            claim: '-40',
            upper: '-40',
            liquidityAmount: BigNumber.from("33285024970969944913475"),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('33366670549555043972'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })
    });

    it("pool0 - underflow when claiming for the second time :: GUARDIAN AUDITS 58", async () => {
        await validateSync(20);
        const aliceLiquidityAmount = BigNumber.from('24951283310825598484485')

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-80',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(0)
        await validateSync(-20)

        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("24951283310825598484485");

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount,
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('24892711623697875920'),
            balanceOutIncrease: BigNumber.from('24987488133503998990'),
            revertMessage: '',
        })

        if (deltaMaxAfterCheck) {
            console.log('claim tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-20')).amountInDeltaMaxStashed.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-20')).amountOutDeltaMaxStashed.toString())
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-80')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-80')).amountOutDeltaMaxMinus.toString())
        }

        await validateBurn({
            signer: hre.props.alice,
            lower: '-80',
            claim: '-20',
            upper: '0',
            liquidityAmount: aliceLiquidityAmount.div(2),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('24892711623697875920'),
            balanceOutIncrease: BigNumber.from('49987513124744754071'),
            lowerTickCleared: false,
            upperTickCleared: true,
            expectedUpper: '-40',
            revertMessage: '', 
        });

        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("12475641655412799242244");

        await validateSync(-40);
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("12475641655412799242244");

        await validateSync(-60);
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("12475641655412799242244");

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount,
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('12421489218416072976'),
            balanceOutIncrease: BigNumber.from('12518755307248153715'),
            revertMessage: '',
        });

        await validateSync(-80);

        await validateBurn({
            signer: hre.props.alice,
            lower: '-80',
            claim: '-80',
            upper: '-40',
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('12421489218416072976'),
            balanceOutIncrease: BigNumber.from('12506243434503093218'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '', 
        });

        if (deltaMaxAfterCheck) {
            console.log('claim tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-20')).amountInDeltaMaxStashed.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-20')).amountOutDeltaMaxStashed.toString())
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-80')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-80')).amountOutDeltaMaxMinus.toString())
        }
    });

    it("pool0 - burn leading to division by 0 :: GUARDIAN AUDITS 61", async () => {
        await validateSync(20);
        const aliceLiquidityAmount = BigNumber.from('49952516624167694475096')
        const bobLiquidityAmount = BigNumber.from('24951283310825598484485')

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-80',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: bobLiquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        });

        await validateSync(0);
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("24951283310825598484485");

        await validateSync(-20);
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("24951283310825598484485");

        await validateSync(0);
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("0");
        // If we claim at 0 or -20 we do get out money back

        await validateSync(-40);
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq("24951283310825598484485");

        await validateBurn({
            signer: hre.props.bob,
            lower: '-80',
            claim: '-40',
            upper: '0',
            liquidityAmount: bobLiquidityAmount,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999997'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        });
    });

    it('pool0 - should not have incorrect pool liquidity when final tick of position crossed :: GUARDIAN AUDITS', async function () {
        validateSync(0)
        const aliceLiquidityIncrease = BigNumber.from("49902591570441687020675")

        // Alice mints a position from -20 -> -60
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidityIncrease,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        });

        await validateSync(-20);
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq(aliceLiquidityIncrease);

        await validateSync(-40);
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq(aliceLiquidityIncrease);

        // Stash liquidity delta on tick -60
        await validateSync(-20);
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq(0);

        await validateSync(-40);
        await validateSync(-60);
        // There is active liquidity at the end of Alice's position
        expect((await hre.props.limitPool.pool0()).liquidity).to.eq(BN_ZERO);

        // Swap being performed with Alice's liquidity at the end of her position
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: BigNumber.from('79148977909814923576066331264'),
            balanceInDecrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-20',
            liquidityAmount: BigNumber.from('1'),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'WrongTickClaimedAt()',
        });

        await validateSync(-80);
        // Still can't burn
        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-60',
            upper: '-20',
            liquidityAmount: BigNumber.from('1'),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });
    });

    it('pool0 - Should move TWAP in range, fill, sync lower tick, and clear stash deltas 57', async function () {
        const liquidityAmount4 = BigNumber.from('49902591570441687020675')

        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('49785448137620406517'),
            balanceOutIncrease: BigNumber.from('49975001251999693577'),
            revertMessage: '',
        })

        await validateSync(-40)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-20',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('49785448137620406517'),
            balanceOutIncrease: BigNumber.from('50024998748000306422'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateSync(-20)
        await validateSync(0)     
        
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        if (deltaMaxAfterCheck) {
            console.log('claim tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-40')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-40')).amountOutDeltaMaxMinus.toString())
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-60')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-60')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool0 - sync multiple ticks at once and process claim 113', async function () {
        const liquidityAmount2 = BigNumber.from('49753115595468372952776')
        const liquidityAmount3 = BigNumber.from('99456505428612725961158')
        await validateSync(-20)
        await validateSync(-40)
        await validateSync(-60)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-120',
            upper: '-80',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-100)
        await validateSync(-60)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120',
            claim: '-80',
            upper: '-80',
            liquidityAmount: liquidityAmount2,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'WrongTickClaimedAt()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120',
            claim: '-120',
            upper: '-80',
            liquidityAmount: liquidityAmount2,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-120')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-120')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool0 - Should process section1 claim on partial previous auction 114', async function () {
        const liquidityAmount2 = BigNumber.from('49753115595468372952776')
        const liquidityAmount3 = BigNumber.from('99456505428612725961158')
        await validateSync(-60)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-120',
            upper: '-80',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-80)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('10106533866521342440'),
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120',
            claim: '-80',
            upper: '-80',
            liquidityAmount: BN_ZERO,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('0'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('10114560012313411744'),
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120',
            claim: '-80',
            upper: '-80',
            liquidityAmount: BN_ZERO,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('0'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateSync(-100)
        await validateSync(-60)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120',
            claim: '-100',
            upper: '-80',
            liquidityAmount: liquidityAmount2,
            zeroForOne: true,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'WrongTickClaimedAt()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120',
            claim: '-120',
            upper: '-80',
            liquidityAmount: liquidityAmount2,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('79778906121165245814'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-120')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-120')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool0 - Should partially remove liquidity on second claim 115', async function () {
        const liquidityAmount2 = BigNumber.from('49753115595468372952776')
        const liquidityAmount3 = BigNumber.from('99456505428612725961158')
        await validateSync(-60)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-120',
            upper: '-80',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-80)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('10106533866521342440'),
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120',
            claim: '-80',
            upper: '-80',
            liquidityAmount: BN_ZERO,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('0'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120',
            claim: '-80',
            upper: '-80',
            liquidityAmount: liquidityAmount2.div(2),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('44946733066739328779'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-120',
            claim: '-80',
            upper: '-80',
            liquidityAmount: liquidityAmount2.div(2),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('44946733066739328779'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-120')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-120')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool0 - Should move TWAP in range, fill, sync lower tick, and clear tick deltas 25', async function () {
        const liquidityAmount4 = BigNumber.from('99805183140883374041350')
        const liquidityAmount5 = BigNumber.from('199710216389218762991542')

        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '-20',
            amount: tokenAmount.mul(2),
            zeroForOne: true,
            balanceInDecrease: tokenAmount.mul(2),
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-40',
            upper: '-20',
            amount: tokenAmount.mul(2),
            zeroForOne: true,
            balanceInDecrease: tokenAmount.mul(2),
            liquidityIncrease: liquidityAmount5,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-20)

        await validateSync(-60)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '-40',
            upper: '-20',
            liquidityAmount: liquidityAmount5,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('199999999999999999998'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        // liquidity not affected since the position is complete
        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-60',
            upper: '-20',
            liquidityAmount: liquidityAmount4.div(2),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'), 
            balanceOutIncrease: BigNumber.from('200000000000000000000').sub(1),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        // no liquidity left since we closed out and deleted the position
        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-60',
            upper: '-20',
            liquidityAmount: liquidityAmount4.div(2),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('254504143839762320698').div(2),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'NotEnoughPositionLiquidity()',
        })

        await validateSync(-40)
        await validateSync(-20)

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-60')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-60')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool0 - Should dilute carry deltas during accumulate', async function () {
        const liquidityAmount4 = BigNumber.from('49902591570441687020675')
        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-20)

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-60',
            upper: '-40',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: BigNumber.from('99755307984763292988257'),
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-60)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-60',
            upper: '-20',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-60',
            claim: '-60',
            upper: '-40',
            liquidityAmount: BigNumber.from('99755307984763292988257'),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999998'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateSync(-20)

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-60')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-60')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool0 - Should updateAccumDeltas during sync 26', async function () {
        const liquidityAmount4 = BigNumber.from('99855108194609381495771')

        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-40',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-60)
        await validateSync(-20)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-40',
            claim: '-40',
            upper: '-20',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })
    })

    it('pool0 - Should move TWAP up and create stopTick0 during sync 27', async function () {
        const liquidityAmount4 = BigNumber.from('49902591570441687020675')
        const liquidityAmount5 = liquidityAmount4.div(2)

        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '-60',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: maxPrice,
            balanceInDecrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('10047100667933021495'),
            revertMessage: '',
            splitInto: 2
        })

        await validateSync(0)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-20',
            liquidityAmount: liquidityAmount5,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('5000000000000000000'),
            balanceOutIncrease: BigNumber.from('69963950292033336040'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-20',
            liquidityAmount: liquidityAmount4.sub(liquidityAmount5),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('74987500625999846788'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'NotEnoughPositionLiquidity()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-40',
            liquidityPercent: ethers.utils.parseUnits("1", 38),
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('25012499374000153211'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '-60',
            claim: '-40',
            upper: '-20',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('5000000000000000000'),
            balanceOutIncrease: BigNumber.from('94976449666033489252'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        if (deltaMaxAfterCheck) {
            console.log('claim tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-60')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-60')).amountOutDeltaMaxMinus.toString())
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-60')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-60')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool0 - Should move TWAP down and create nextLatestTick during sync 28', async function () {
        const liquidityAmount4 = BigNumber.from('49902591570441687020675')

        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-40)

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-20',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        if (deltaMaxAfterCheck) {
            console.log('claim tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-60')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-60')).amountOutDeltaMaxMinus.toString())
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-60')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-60')).amountOutDeltaMaxMinus.toString())
        }        
    })

    it('pool0 - Should claim multiple times on the same tick with a swap in between 29', async function () {
        const liquidityAmount4 = BigNumber.from('49902591570441687020675')

        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-60',
            upper: '-20',
            amount: tokenAmount,
            zeroForOne: true,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(-20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: BigNumber.from('79148977909814923576066331264'),
            balanceInDecrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('10046091377314633368'),
            revertMessage: '',
        })

        // collect on position

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmount.div(10),
            priceLimit: BigNumber.from('79148977909814923576066331264'),
            balanceInDecrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('10050081040105546681'),
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-40',
            upper: '-20',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('0'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'WrongTickClaimedAt()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '-60',
            claim: '-20',
            upper: '-20',
            liquidityAmount: liquidityAmount4,
            zeroForOne: true,
            balanceInIncrease: BigNumber.from('20000000000000000000'),
            balanceOutIncrease: BigNumber.from('79903827582579819949'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
        }
        if (deltaMaxAfterCheck) {
            console.log('claim tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-60')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-60')).amountOutDeltaMaxMinus.toString())
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks0('-60')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks0('-60')).amountOutDeltaMaxMinus.toString())
        } 
    })

    // move TWAP in range; no-op swap; burn immediately

    // multiple claims within current auction

    // move TWAP in range; no-op swap; move TWAP down tickSpread; burn liquidity

    // move TWAP in range; no-op swap; move TWAP down tickSpread; mint liquidity; burn liquidity

    // move TWAP in range; swap full amount; burn liquidity

    // move TWAP in range; swap full amount; mint liquidity; burn liquidity

    // move TWAP in range; swap partial amount; burn liquidity

    // move TWAP in range; swap partial amount; mint liquidity; burn liquidity

    // move TWAP and skip entire range; burn liquidity

    // move TWAP and skip entire range; mint more liquidity; burn liquidity

    // move TWAP and skip entire range; move TWAP back; burn liquidity

    // move TWAP and skip entire range; move TWAP back; mint liquidity; burn liquidity

    // move TWAP to unlock liquidity; partial fill; move TWAP down

    it('pool1 - Should mint/burn new LP position 23', async function () {
        // process two mints
        for (let i = 0; i < 2; i++) {
            await validateMint({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                lower: '20',
                upper: '40',
                amount: tokenAmount,
                zeroForOne: false,
                balanceInDecrease: tokenAmount,
                liquidityIncrease: liquidityAmount,
                upperTickCleared: false,
                lowerTickCleared: false,
                revertMessage: '',
            })
        }

        // process no-op swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmount,
            priceLimit: maxPrice,
            balanceInDecrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            revertMessage: '',
        })

        // process two burns
        for (let i = 0; i < 2; i++) {
            await validateBurn({
                signer: hre.props.alice,
                lower: '20',
                claim: '20',
                upper: '40',
                liquidityAmount: liquidityAmount,
                zeroForOne: false,
                balanceInIncrease: BN_ZERO,
                balanceOutIncrease: tokenAmount.sub(1),
                lowerTickCleared: false,
                upperTickCleared: false,
                revertMessage: '',
            })
        }

        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks1('40')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks1('40')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool1 - Should swap with zero output 12', async function () {
        // move TWAP to tick 0
        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '20',
            upper: '40',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmount.div(10),
            priceLimit: minPrice,
            balanceInDecrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '20',
            claim: '20',
            upper: '40',
            liquidityAmount: liquidityAmount,
            zeroForOne: false,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount.sub(1),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks1('40')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks1('40')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool1 - Should move TWAP after mint and handle unfilled amount 13', async function () {
        const liquidityAmount2 = hre.ethers.utils.parseUnits('99955008249587388643769', 0)
        const balanceInDecrease = hre.ethers.utils.parseUnits('99750339674246044929', 0)
        const balanceOutIncrease = hre.ethers.utils.parseUnits('99999999999999999999', 0)

        // move TWAP to tick -20
        await validateSync(-20)

        // mint position
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '20',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        // move TWAP to tick 20
        await validateSync(0)
        await validateSync(20)

        // should revert on twap bounds
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '20',
            upper: '40',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: 'PositionInsideSafetyWindow()',
        })

        // no-op swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmount,
            priceLimit: minPrice,
            balanceInDecrease: BN_ZERO,
            balanceOutIncrease: BN_ZERO,
            revertMessage: '',
        })

        //burn should revert
        await validateBurn({
            signer: hre.props.alice,
            lower: '20',
            claim: '40',
            upper: '40',
            liquidityAmount: liquidityAmount2,
            zeroForOne: false,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount.sub(1),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'NotEnoughPositionLiquidity()',
        })

        //valid burn
        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            claim: '20',
            upper: '20',
            liquidityAmount: liquidityAmount2,
            zeroForOne: false,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount.sub(1),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks1('20')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks1('20')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool1 - Should not mint position below TWAP 10', async function () {
        await validateSync(40)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '20',
            upper: '40',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: 'PositionInsideSafetyWindow()',
        })

        await validateSync(20)
    })

    it('pool1 - Should mint, swap, and then claim entire range', async function () {
        const lowerOld = hre.ethers.utils.parseUnits('0', 0)
        const lower = hre.ethers.utils.parseUnits('20', 0)
        const upperOld = hre.ethers.utils.parseUnits('887272', 0)
        const upper = hre.ethers.utils.parseUnits('40', 0)
        const amount = hre.ethers.utils.parseUnits('100', await hre.props.token0.decimals())
        const feeTaken = hre.ethers.utils.parseUnits('5', 16)

        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '20',
            upper: '40',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmount.mul(2),
            priceLimit: minPrice,
            balanceInDecrease: BigNumber.from('99620704132805394768'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '20',
            claim: '40',
            upper: '40',
            liquidityAmount: liquidityAmount,
            zeroForOne: false,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: tokenAmount,
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'WrongTickClaimedAt()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '20',
            claim: '20',
            upper: '40',
            liquidityAmount: liquidityAmount,
            zeroForOne: false,
            balanceInIncrease: BigNumber.from('99620704132805394768'),
            balanceOutIncrease: BigNumber.from('0'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '20',
            claim: '20',
            upper: '40',
            liquidityAmount: liquidityAmount,
            zeroForOne: false,
            balanceInIncrease: BigNumber.from('99680524411508040121'),
            balanceOutIncrease: BigNumber.from('0'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'NotEnoughPositionLiquidity()',
        })

        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks1('40')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks1('40')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool1 - Should move TWAP in range, partial fill, and burn 80', async function () {
        const liquidityAmount4 = BigNumber.from('49902591570441687020675')

        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '20',
            upper: '60',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(20)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmount.div(10),
            priceLimit: BigNumber.from('79307426338960776842885539846'),
            balanceInDecrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('10046091377314633368'),
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '20',
            claim: '20',
            upper: '60',
            liquidityAmount: liquidityAmount4,
            zeroForOne: false,
            balanceInIncrease: BigNumber.from('10000000000000000000'),
            balanceOutIncrease: BigNumber.from('89953908622685366631'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks1('60')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks1('60')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool1 - Should revert for liquidity overflow 81', async function () {
        const liquidityAmount4 = BigNumber.from('49902591570441687020675')
        // 124905049859212811 leftover from precision loss

        await validateSync(0)

        await mintSigners20(hre.props.token1, tokenAmount.mul(10000000), [
            hre.props.alice,
            hre.props.bob,
        ])

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '20',
            upper: '60',
            amount: tokenAmount.mul(ethers.utils.parseUnits('34', 17)),
            zeroForOne: false,
            balanceInDecrease: tokenAmount.mul(ethers.utils.parseUnits('34', 17)),
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: 'LiquidityOverflow()',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '20',
            claim: '20',
            upper: '60',
            liquidityAmount: liquidityAmount4,
            zeroForOne: false,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99875219786520339160'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: 'NotEnoughPositionLiquidity()',
        })

        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks1('60')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks1('60')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool1 - Should move TWAP in range by one, partial fill w/ max int128 of liquidity, and burn', async function () {
        const liquidityAmount4 = BigNumber.from('31849338570933576034964240875')
        /// @auditor -> this doesn't cause overflow...liquidity*values maxes out at 2.69e70...max uint256 is 1.15e77

        await validateSync(60)

        await mintSigners20(hre.props.token1, tokenAmount.mul(ethers.utils.parseUnits('34', 55)), [
            hre.props.alice,
            hre.props.bob,
        ])
// max uint256 is x.xxE77; x.xxE70
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '600000',
            upper: '600020',
            amount: tokenAmount.mul(ethers.utils.parseUnits('34', 17)),
            zeroForOne: false,
            balanceInDecrease: tokenAmount.mul(ethers.utils.parseUnits('34', 17)),
            liquidityIncrease: liquidityAmount4,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(600000)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmount.div(10),
            priceLimit: minPrice,
            balanceInDecrease: BigNumber.from('2980787058714'),
            balanceOutIncrease: BigNumber.from('339999999999999999999999999997721907021'),
            revertMessage: '',
        })

        /// @dev - swap has precision loss of 2278092979 or (6.7e-28) %

        await validateBurn({
            signer: hre.props.alice,
            lower: '600000',
            claim: '600000',
            upper: '600020',
            liquidityAmount: liquidityAmount4,
            zeroForOne: false,
            balanceInIncrease: BigNumber.from('2980787058714'),
            balanceOutIncrease: BigNumber.from('0'),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (deltaMaxAfterCheck) {
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks1('600020')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks1('600020')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool1 - mint position, move TWAP x2 w/ unfilled amounts, and check amountInDelta carry correctness 111', async function () {
        const liquidityAmount2 = BigNumber.from('49753115595468372952776')
        const liquidityAmount3 = BigNumber.from('99456505428612725961158')
        await validateSync(20)
        await validateSync(40)
        await validateSync(60)
        

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '80',
            upper: '120',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })
        await validateSync(80)
        await validateSync(60)

        await validateBurn({
            signer: hre.props.alice,
            lower: '80',
            claim: '100',
            upper: '120',
            liquidityAmount: liquidityAmount2,
            zeroForOne: false,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        if (deltaMaxAfterCheck) {
            console.log('claim tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks1('100')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks1('100')).amountOutDeltaMaxMinus.toString())
            console.log('final tick')
            console.log('deltainmax  after:', (await hre.props.limitPool.ticks1('120')).amountInDeltaMaxMinus.toString())
            console.log('deltaoutmax after:', (await hre.props.limitPool.ticks1('120')).amountOutDeltaMaxMinus.toString())
        }
    })

    it('pool1 - sync multiple ticks at once and process claim 112', async function () {
        const liquidityAmount2 = BigNumber.from('49753115595468372952776')
        const liquidityAmount3 = BigNumber.from('99456505428612725961158')
        await validateSync(20)
        await validateSync(40)
        await validateSync(60)
        

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '80',
            upper: '120',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(100)

        await validateSync(60)

        await validateBurn({
            signer: hre.props.alice,
            lower: '80',
            claim: '120',
            upper: '120',
            liquidityAmount: liquidityAmount2,
            zeroForOne: false,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('99999999999999999999'),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })

        await validateSync(0)
    })

    it("pool1 - multiple tick length jumps should not cause users to lose assets:: GUARDIAN AUDITS", async () => {
        // Note: unused, way to initialize all the ticks in the range manually
        let liquidityAmountBob = hre.ethers.utils.parseUnits("99855108194609381495771", 0);

        await validateSync(-20);
        const liquidityAmount2 = hre.ethers.utils.parseUnits('16617549983581976690927', 0);
        liquidityAmountBob = hre.ethers.utils.parseUnits("99855108194609381495771", 0);

        const aliceLiquidityAmount = BigNumber.from('0')
        const bobLiquidityAmount = BigNumber.from('24951283310825598484485')

        // console.log("--------------- Alice First mint -------------");

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '120',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })
        if(debugMode) console.log("--------------- Sync 0 -------------");
        await validateSync(0)
        expect((await hre.props.limitPool.pool1()).liquidity).to.eq("16617549983581976690927");
        if(debugMode) console.log("--------------- Sync 20 -------------");
        await validateSync(20)
        expect((await hre.props.limitPool.pool1()).liquidity).to.eq("16617549983581976690927");

        if(debugMode) console.log("--------------- Sync 40 -------------");
        await validateSync(40);
        expect((await hre.props.limitPool.pool1()).liquidity).to.eq("16617549983581976690927");

        if(debugMode) console.log("--------------- Alice #1 burn ---------------");

        await validateBurn({
            signer: hre.props.alice,
            lower: '0',
            claim: '40',
            upper: '120',
            liquidityAmount: BigNumber.from('0'),
            zeroForOne: false,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('33266692264193520416'),
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        })

        if(debugMode) console.log("--------------- Sync 120 -------------");
        await validateSync(120);


        if (debugMode) console.log("--------------- Alice #2 Burn -------------");

        await validateBurn({
            signer: hre.props.alice,
            lower: '40',
            claim: '120',
            upper: '120',
            liquidityAmount: liquidityAmount2,
            zeroForOne: false,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from('66733307735806479582'), // Notice Alice gets her position back
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        })
    });

    it('pool1 - should not lock liquidity due to rounding on final small burn :: GUARDIAN AUDITS', async function () {
        const liquidityAmountAlice = BigNumber.from('49902591570441687020675')
        await validateSync(0)

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '20',
            upper: '60',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmountAlice,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '20',
            upper: '60',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmountAlice,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(40);

        // Partial burn
        if (debugMode) console.log("===== FIRST ALICE BURN =====");
        await validateBurn({
            signer: hre.props.alice,
            lower: '20',
            claim: '40',
            upper: '60',
            liquidityAmount: liquidityAmountAlice,
            zeroForOne: false,
            balanceInIncrease: BigNumber.from('0'),
            balanceOutIncrease: BigNumber.from("149975001251999693577"),
            lowerTickCleared: true,
            upperTickCleared: false,
            revertMessage: '',
        });
        if (debugMode) console.log("===== SECOND ALICE BURN =====");
        // await validateBurn({
        //     signer: hre.props.alice,
        //     lower: '40',
        //     claim: '40',
        //     upper: '60',
        //     liquidityAmount: liquidityAmountAlice.sub(1000),
        //     zeroForOne: false,
        //     balanceInIncrease: BN_ZERO,
        //     balanceOutIncrease: BN_ZERO,
        //     lowerTickCleared: false,
        //     upperTickCleared: false,
        //     revertMessage: 'PositionAuctionAmountTooSmall()',
        // });
        if (debugMode) console.log("===== THIRD ALICE BURN =====");
        // ticks[params.upper].deltas.amountOutDeltaMax < amountOutRemoved by 1 wei in Section 3
        // As a result, underflow occurs
        await validateBurn({
            signer: hre.props.alice,
            lower: '40',
            claim: '40',
            upper: '60',
            liquidityAmount: liquidityAmountAlice,
            zeroForOne: false,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: BigNumber.from("50024998748000306422"),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        });
        await validateSync(20);
        // // Alice can't open a position because the previous position is still active.
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '40',
            upper: '60',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: BigNumber.from('99755307984763292988257'),
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: "",
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '40',
            claim: '40',
            upper: '60',
            liquidityAmount: BigNumber.from('99755307984763292988257'),
            zeroForOne: false,
            balanceInIncrease: BN_ZERO,
            balanceOutIncrease: BigNumber.from("99999999999999999999"),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        });

    });

    it('pool1 - Should differentiate between older closed positions and newer opened positions :: GUARDIAN AUDITS', async function () {
        const liquidityAmount = BigNumber.from("49902591570441687020675");
        const liquidityAmountAlice = BigNumber.from("99755307984763292988257");
        await validateSync(0)

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '20',
            upper: '60',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateSync(20);
        await validateSync(40);
        // Bob can claim at upper tick
        await validateSync(80);
        await validateSync(20);

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '40',
            upper: '60',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: liquidityAmountAlice,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        // After Alice mints -> amountOutDeltaMax on tick60 becomes 200
        // However, amountOutDelta on tick60 is only 100
        // 100 * (100/200) = 50 tokens out for Bob
        await validateBurn({
            signer: hre.props.bob,
            lower: '20',
            claim: '60',
            upper: '60',
            liquidityAmount: liquidityAmount,
            zeroForOne: false,
            balanceInIncrease: BigNumber.from("0"),
            balanceOutIncrease: BigNumber.from("99999999999999999999"),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: '',
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '40',
            claim: '60',
            upper: '60',
            liquidityAmount: liquidityAmountAlice,
            zeroForOne: false,
            balanceInIncrease: BigNumber.from("0"),
            balanceOutIncrease: BigNumber.from("99999999999999999999"),
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'WrongTickClaimedAt()',
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '40',
            claim: '40',
            upper: '60',
            liquidityAmount: liquidityAmountAlice,
            zeroForOne: false,
            balanceInIncrease: BigNumber.from("0"),
            balanceOutIncrease: BigNumber.from("99999999999999999999"),
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        });
    });
})
