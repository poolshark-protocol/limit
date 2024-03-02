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
    validateSwap,
    validateMint as validateMintLimit,
    validateBurn as validateBurnLimit,
    validateStake,
    validateUnstake
} from '../../utils/contracts/limitpool'
import { gBefore } from '../../utils/hooks.test'
import { parseUnits } from 'ethers/lib/utils'

alice: SignerWithAddress
describe('LimitStaker Tests', function () {
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
        await mintSigners20(hre.props.token0, tokenAmountBn.mul(100000), [hre.props.alice, hre.props.bob])

        await mintSigners20(hre.props.token1, tokenAmountBn.mul(100000), [hre.props.alice, hre.props.bob])

        if (debugMode) await getLiquidity(true, true)
        if (debugMode) await getLiquidity(false, true)
    })

    it('Should be able to change owner', async function () {    
        // check admin contract owner
        expect(await
          hre.props.limitStaker
            .owner()
        ).to.be.equal(hre.props.admin.address)
    
        // expect revert if non-owner calls admin function
        await expect(
            hre.props.limitStaker
              .connect(hre.props.bob)
              .transferOwner(hre.props.bob.address)
        ).to.be.revertedWith('OwnerOnly()')
    
        // transfer ownership to bob
        await hre.props.limitStaker.connect(hre.props.admin).transferOwner(hre.props.bob.address)
        
        // expect bob to be the new admin
        expect(await
            hre.props.limitStaker
              .owner()
          ).to.be.equal(hre.props.bob.address)
        
        await expect(
            hre.props.limitStaker
              .connect(hre.props.admin)
              .transferOwner(hre.props.bob.address)
        ).to.be.revertedWith('OwnerOnly()')
    
        // transfer ownership back to previous admin
        await hre.props.limitStaker.connect(hre.props.bob).transferOwner(hre.props.admin.address)
        
        // check admin is owner again
        expect(await
            hre.props.limitStaker
            .owner()
        ).to.be.equal(hre.props.admin.address)
    })
    
    it('Should be able to change feeTo', async function () {
        // check admin contract feeTo
        expect(await
            hre.props.limitStaker
            .feeTo()
        ).to.be.equal(hre.props.admin.address)

        // owner should not be able to claim fees
        await hre.props.limitStaker.connect(hre.props.admin).transferOwner(hre.props.bob.address)

        // expect revert if non-owner calls admin function
        await expect(
            hre.props.limitStaker
                .connect(hre.props.bob)
                .transferFeeTo(hre.props.bob.address)
        ).to.be.revertedWith('FeeToOnly()')

        await hre.props.limitStaker.connect(hre.props.bob).transferOwner(hre.props.admin.address)

        // transfer ownership to bob
        await hre.props.limitStaker.connect(hre.props.admin).transferFeeTo(hre.props.bob.address)
        
        // expect bob to be the new admin
        expect(await
            hre.props.limitStaker
                .feeTo()
            ).to.be.equal(hre.props.bob.address)
        
        await expect(
            hre.props.limitStaker
                .connect(hre.props.admin)
                .transferFeeTo(hre.props.bob.address)
        ).to.be.revertedWith('FeeToOnly()')

        // transfer ownership back to previous admin
        await hre.props.limitStaker.connect(hre.props.bob).transferFeeTo(hre.props.admin.address)
        
        // check admin is owner again
        expect(await
            hre.props.limitStaker
            .feeTo()
        ).to.be.equal(hre.props.admin.address)
    })

    it('pool0 - Should mint, stake, and burn', async function () {
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from(tokenAmount),
            priceLimit: BigNumber.from('79450223072165328185028130650'),
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })
        const aliceLiquidity = '20051041647900280328782'
        const aliceId = await validateMintLimit({
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
            stake: true,
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: 2,
            claim: 0,
            zeroForOne: true,
            revertMessage: 'LimitUnstake::StakeNotFound()'
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            claim: 0,
            zeroForOne: true,
            revertMessage: ''
        })

        await validateStake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            claim: 0,
            zeroForOne: true,
            revertMessage: ''
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
        })

        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityAmount: liquidityAmount,
            zeroForOne: true,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'PositionOwnerMismatch()',
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            revertMessage: '',
            claim: 0,
            zeroForOne: true,
            balance1Increase: BigNumber.from('100501226962305120350')
        })

        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityAmount: liquidityAmount,
            zeroForOne: true,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: true,
            upperTickCleared: true,
            revertMessage: 'PositionNotFound()',
        })

        // mint and stake separately
        // earn fees and mint a second time
        // burn half of staked position
        // advance past end time
    })

    it('pool0 - Should mint, then stake separately, then unstake and burn', async function () {
        const aliceLiquidity = '19951041647900280328782'
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from(tokenAmount),
            priceLimit: BigNumber.from('79450223072165328185028130650'),
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })
        const aliceId = await validateMintLimit({
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
            stake: false,
        })


        await validateStake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: 10,
            claim: 100,
            zeroForOne: false,
            revertMessage: 'LimitStake::PositionNotFound()'
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            claim: 100,
            zeroForOne: false,
            revertMessage: 'LimitUnstake::StakeNotFound()'
        })

        await validateStake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            claim: 100,
            zeroForOne: false,
            revertMessage: ''
        })

        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityAmount: liquidityAmount,
            zeroForOne: false,
            balanceInIncrease: '100501226962305120350',
            balanceOutIncrease: '0',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'PositionOwnerMismatch()',
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            claim: 100,
            zeroForOne: false,
            revertMessage: ''
        })

        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityAmount: BigNumber.from(aliceLiquidity),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
        })
        // burn half of staked position
    })

    it('pool0 - Should mint, then mint again', async function () {
        const aliceLiquidity = '19951041647900280328782'
        const aliceLiquidity2 = '20051041647900280328782'
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from(tokenAmount),
            priceLimit: BigNumber.from('79450223072165328185028130650'),
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        const aliceId = await validateMintLimit({
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
            stake: true,
        })

        const aliceId2 = await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
            stake: true,
        })

        await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            positionId: aliceId2,
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
            stake: true,
        })

        await validateUnstake({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            positionId: aliceId,
            claim: 100,
            zeroForOne: false,
            revertMessage: 'LimitUnstake::PositionOwnerMisMatch()'
        })

        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityAmount: BigNumber.from(aliceLiquidity),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
            staked: true
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            revertMessage: 'LimitUnstake::PositionAlreadyUnstaked()',
            claim: 100,
            zeroForOne: false,
        })

        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId2,
            lower: '-100',
            upper: '0',
            claim: '0',
            liquidityAmount: BigNumber.from(aliceLiquidity2).mul(2),
            liquidityPercent: parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '199999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
            staked: true
        })
    })

    it('pool0 - Should mint, then mint again and return position fill to owner', async function () {
        const aliceLiquidity2 = '19951041647900280328782'

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from(tokenAmount),
            priceLimit: BigNumber.from('79450223072165328185028130650'),
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })
        // mint
        const aliceId = await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: '',
            stake: true,
        })
        // burn stakenotfound
        await validateBurnLimit({
            signer: hre.props.bob,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityAmount: BigNumber.from(aliceLiquidity2),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '99999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'BurnLimitStake::PositionOwnerMismatch()',
            staked: true
        })

        // swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from(tokenAmount).div(4),
            priceLimit: minPrice,
            balanceInDecrease: '25000000000000000000',
            balanceOutIncrease: '25219481445839870650',
            revertMessage: '',
        })

        // 50% burn staked true
        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            expectedPositionUpper: '80',
            liquidityAmount: BigNumber.from(aliceLiquidity2).div(2),
            zeroForOne: false,
            balanceInIncrease: '22430237975438965469',
            balanceOutIncrease: '37390259277080064674',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
            staked: true
        })

        // full burn staked true
        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            expectedPositionUpper: '80',
            liquidityAmount: BigNumber.from(aliceLiquidity2).div(2),
            liquidityPercent: parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '22430237975438965469',
            balanceOutIncrease: '37390259277080064674',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'ClaimTick::OutsidePositionBounds()',
            staked: true
        })
        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '80',
            claim: '80',
            expectedPositionUpper: '80',
            liquidityAmount: BigNumber.from(aliceLiquidity2).div(2),
            liquidityPercent: parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '2569762024561034530',
            balanceOutIncrease: '37390259277080064674',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
            staked: true
        })
    });

    it('pool0 - Should mint, then mint again, then do partial burns', async function () {
        const aliceLiquidity = '19951041647900280328782'
        const aliceLiquidity2 = '20051041647900280328782'
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: BigNumber.from(tokenAmount),
            priceLimit: BigNumber.from('1738267302024796147492397123192298'),
            balanceInDecrease: '0',
            balanceOutIncrease: '0',
            revertMessage: '',
        })

        // mint staked 1
        const aliceId = await validateMintLimit({
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
            stake: true,
        })
        // const aliceId = await validateMint({
        //   signer: hre.props.alice,
        //   recipient: hre.props.alice.address,
        //   lower: '192930',
        //   upper: '206930',
        //   amount0: BigNumber.from('2076760730130'),
        //   amount1: BigNumber.from('1000000000000000000000'),
        //   balance0Decrease: BigNumber.from('2076760730130'),
        //   balance1Decrease: BigNumber.from('999999999999999994421'),
        //   liquidityIncrease: aliceLiquidity,
        //   revertMessage: '',
        //   collectRevertMessage: '',
        //   stake: true
        // })

        // mint staked 1
        await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            positionId: aliceId,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: 'PositionAlreadyEntered()',
            stake: true,
        })

        const aliceId2 = await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
            stake: true,
        })

        // mint staked 1
        await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            positionId: aliceId2,
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
            stake: true,
        })

        // mint staked 1
        await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            positionId: aliceId2,
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
            stake: true,
        })

        // burn staked 1%
        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityPercent: parseUnits('1', 36),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
            staked: true
        })
        // burn staked 1%
        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityPercent: parseUnits('1', 36),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '989999999999999999',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
            staked: true
        })

        // mint staked 1
        await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            positionId: aliceId,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: 'PositionAlreadyEntered()',
            stake: true,
        })

        // burn and collect
        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityAmount: BN_ZERO,
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '0',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
            staked: true,
        })
        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId2,
            lower: '-100',
            upper: '0',
            claim: '0',
            liquidityAmount: BN_ZERO,
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '0',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
            staked: true,
        })

        // unstake
        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            claim: 100,
            zeroForOne: false,
            revertMessage: ''
        })

        // stake
        await validateStake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            claim: 100,
            zeroForOne: false,
            revertMessage: ''
        })

        // unstake
        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            claim: 100,
            zeroForOne: false,
            revertMessage: ''
        })

        // mint 2
        await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '-100',
            upper: '0',
            positionId: aliceId2,
            amount: tokenAmount,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
            stake: true,
        })

        // mint 1
        await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            positionId: aliceId,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: 'PositionAlreadyEntered()',
            stake: false,
        })

        // stake 1
        await validateStake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            claim: 100,
            zeroForOne: false,
            revertMessage: ''
        })
        // mint 1
        await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            positionId: aliceId,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: 'PositionAlreadyEntered()',
            stake: true,
        })

        // burn 1 50% staked
        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityPercent: parseUnits('5', 37),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '49005000000000000000',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
            staked: true,
        })

        // swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from(tokenAmount).div(4),
            priceLimit: minPrice,
            balanceInDecrease: '25000000000000000000',
            balanceOutIncrease: '25186516336662574562',
            revertMessage: '',
        })

        // mint 1 staked
        await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmount,
            positionId: aliceId,
            zeroForOne: false,
            balanceInDecrease: tokenAmount,
            liquidityIncrease: aliceLiquidity2,
            upperTickCleared: true,
            lowerTickCleared: false,
            revertMessage: 'PositionAlreadyEntered()',
            stake: true,
        })

        // burn 1 staked bob positionownermismatch
        await validateBurnLimit({
            signer: hre.props.bob,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityPercent: parseUnits('5', 37),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '49005000000000000000',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'BurnLimitStake::PositionOwnerMismatch()',
            staked: true,
        })

        // burn 1 staked 100% alice
        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityPercent: parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '24999999999999999999',
            balanceOutIncrease: '23818483663337425437',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: '',
            staked: true,
        })

        // burn 1 staked 100% alice; positionalreadyunstaked
        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId,
            lower: '0',
            upper: '100',
            claim: '100',
            liquidityPercent: parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '24999999999999999999',
            balanceOutIncrease: '23818483663337425437',
            lowerTickCleared: false,
            upperTickCleared: true,
            revertMessage: 'BurnLimitStake::PositionAlreadyUnstaked()',
            staked: true,
        })

        await validateBurnLimit({
            signer: hre.props.alice,
            positionId: aliceId2,
            lower: '-100',
            upper: '0',
            claim: '0',
            liquidityPercent: parseUnits('1', 38),
            zeroForOne: false,
            balanceInIncrease: '0',
            balanceOutIncrease: '399999999999999999999',
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
            staked: true,
        })
        return
        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitStaker.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitStaker.address)).toString())
        }
    });
})