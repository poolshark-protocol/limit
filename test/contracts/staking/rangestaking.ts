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
    validateBurn as validateBurnLimit
} from '../../utils/contracts/limitpool'
import {
    validateMint as validateMintRange,
    validateBurn as validateBurnRange,
    validateMint,
    validateUnstake,
    validateBurn,
    validateStake,
} from '../../utils/contracts/rangepool'
import { gBefore } from '../../utils/hooks.test'

alice: SignerWithAddress
describe('RangeStaker Tests', function () {
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
          hre.props.rangeStaker
            .owner()
        ).to.be.equal(hre.props.admin.address)
    
        // expect revert if non-owner calls admin function
        await expect(
            hre.props.rangeStaker
              .connect(hre.props.bob)
              .transferOwner(hre.props.bob.address)
        ).to.be.revertedWith('OwnerOnly()')
    
        // transfer ownership to bob
        await hre.props.rangeStaker.connect(hre.props.admin).transferOwner(hre.props.bob.address)
        
        // expect bob to be the new admin
        expect(await
            hre.props.rangeStaker
              .owner()
          ).to.be.equal(hre.props.bob.address)
        
        await expect(
            hre.props.rangeStaker
              .connect(hre.props.admin)
              .transferOwner(hre.props.bob.address)
        ).to.be.revertedWith('OwnerOnly()')
    
        // transfer ownership back to previous admin
        await hre.props.rangeStaker.connect(hre.props.bob).transferOwner(hre.props.admin.address)
        
        // check admin is owner again
        expect(await
            hre.props.rangeStaker
            .owner()
        ).to.be.equal(hre.props.admin.address)
      })
    
      it('Should be able to change feeTo', async function () {
        // check admin contract feeTo
        expect(await
          hre.props.rangeStaker
            .feeTo()
        ).to.be.equal(hre.props.admin.address)
    
        // owner should not be able to claim fees
        await hre.props.rangeStaker.connect(hre.props.admin).transferOwner(hre.props.bob.address)
    
        // expect revert if non-owner calls admin function
        await expect(
            hre.props.rangeStaker
              .connect(hre.props.bob)
              .transferFeeTo(hre.props.bob.address)
        ).to.be.revertedWith('FeeToOnly()')
    
        await hre.props.rangeStaker.connect(hre.props.bob).transferOwner(hre.props.admin.address)
    
        // transfer ownership to bob
        await hre.props.rangeStaker.connect(hre.props.admin).transferFeeTo(hre.props.bob.address)
        
        // expect bob to be the new admin
        expect(await
            hre.props.rangeStaker
              .feeTo()
          ).to.be.equal(hre.props.bob.address)
        
        await expect(
            hre.props.rangeStaker
              .connect(hre.props.admin)
              .transferFeeTo(hre.props.bob.address)
        ).to.be.revertedWith('FeeToOnly()')
    
        // transfer ownership back to previous admin
        await hre.props.rangeStaker.connect(hre.props.bob).transferFeeTo(hre.props.admin.address)
        
        // check admin is owner again
        expect(await
            hre.props.rangeStaker
            .feeTo()
        ).to.be.equal(hre.props.admin.address)
      })

    it('pool0 - Should mint, stake, and burn', async function () {
        const aliceLiquidity = BigNumber.from('419027207938949970576')
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
        const aliceId = await validateMint({
          signer: hre.props.alice,
          recipient: hre.props.alice.address,
          lower: '10000',
          upper: '20000',
          amount0: BigNumber.from(tokenAmount),
          amount1: BigNumber.from(tokenAmount),
          balance0Decrease: BigNumber.from('100000000000000000000'),
          balance1Decrease: BigNumber.from('0'),
          liquidityIncrease: BigNumber.from(aliceLiquidity),
          revertMessage: '',
          collectRevertMessage: '',
          stake: true
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: 2,
            revertMessage: 'RangeUnstake::StakeNotFound()'
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '10000',
            upper: '20000',
            positionId: aliceId,
            liquidityAmount: aliceLiquidity,
            balance0Increase: BigNumber.from(tokenAmount).sub(1),
            balance1Increase: BN_ZERO,
            revertMessage: 'PositionOwnerMismatch()',
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            revertMessage: ''
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '10000',
            upper: '20000',
            positionId: aliceId,
            liquidityAmount: aliceLiquidity,
            balance0Increase: BigNumber.from(tokenAmount).sub(1),
            balance1Increase: BN_ZERO,
            revertMessage: '',
        })

        // mint and stake separately
        // earn fees and mint a second time
        // burn half of staked position
        // advance past end time
    })

    it('pool0 - Should mint, then stake separately, then unstake and burn', async function () {
        const aliceLiquidity = BigNumber.from('419027207938949970576')
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
        const aliceId = await validateMint({
          signer: hre.props.alice,
          recipient: hre.props.alice.address,
          lower: '10000',
          upper: '20000',
          amount0: BigNumber.from(tokenAmount),
          amount1: BigNumber.from(tokenAmount),
          balance0Decrease: BigNumber.from('100000000000000000000'),
          balance1Decrease: BigNumber.from('0'),
          liquidityIncrease: BigNumber.from(aliceLiquidity),
          revertMessage: '',
          collectRevertMessage: '',
          stake: false
        })

        await validateStake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: 10,
            revertMessage: 'RangeStake::PositionNotFound()'
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            revertMessage: 'RangeUnstake::StakeNotFound()'
        })

        await validateStake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            revertMessage: ''
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '10000',
            upper: '20000',
            positionId: aliceId,
            liquidityAmount: aliceLiquidity,
            balance0Increase: BigNumber.from(tokenAmount).sub(1),
            balance1Increase: BN_ZERO,
            revertMessage: 'PositionOwnerMismatch()',
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            revertMessage: ''
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '10000',
            upper: '20000',
            positionId: aliceId,
            liquidityAmount: aliceLiquidity,
            balance0Increase: BigNumber.from(tokenAmount).sub(1),
            balance1Increase: BN_ZERO,
            revertMessage: '',
        })
        // burn half of staked position
    })

    it('pool0 - Should mint, then mint again and return fees to position owner', async function () {
        const aliceLiquidity = BigNumber.from('419027207938949970576')
        const aliceLiquidity2 = BigNumber.from('459844046199927274765')
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
        const aliceId = await validateMint({
          signer: hre.props.alice,
          recipient: hre.props.alice.address,
          lower: '10000',
          upper: '20000',
          amount0: BigNumber.from(tokenAmount),
          amount1: BigNumber.from(tokenAmount),
          balance0Decrease: BigNumber.from('100000000000000000000'),
          balance1Decrease: BigNumber.from('0'),
          liquidityIncrease: aliceLiquidity,
          revertMessage: '',
          collectRevertMessage: '',
          stake: true
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: BigNumber.from(tokenAmount).div(4),
            priceLimit: maxPrice,
            balanceInDecrease: '25000000000000000000',
            balanceOutIncrease: '8871796901358525748',
            revertMessage: '',
        })

        // on second mint we have updated liquidity
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '10000',
            upper: '20000',
            positionId: aliceId,
            amount0: BigNumber.from(tokenAmount),
            amount1: BigNumber.from(tokenAmount),
            balance0Decrease: BigNumber.from('99995561882490566021'),
            balance1Decrease: BigNumber.from('27435214079638242718'),
            liquidityIncrease: aliceLiquidity2,
            revertMessage: '',
            collectRevertMessage: '',
            stake: true
        })

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '10000',
            upper: '20000',
            positionId: aliceId,
            amount0: BigNumber.from(tokenAmount),
            amount1: BigNumber.from(tokenAmount),
            balance0Decrease: BigNumber.from('99995561882490566021'),
            balance1Decrease: BigNumber.from('27435214079638242718'),
            liquidityIncrease: aliceLiquidity2,
            revertMessage: 'PositionOwnerMismatch()',
            collectRevertMessage: '',
            stake: false
        })

        await validateMint({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            lower: '10000',
            upper: '20000',
            positionId: aliceId,
            amount0: BigNumber.from(tokenAmount),
            amount1: BigNumber.from(tokenAmount),
            balance0Decrease: BigNumber.from('99995561882490566021'),
            balance1Decrease: BigNumber.from('27435214079638242718'),
            liquidityIncrease: aliceLiquidity2,
            revertMessage: 'RangeStake::PositionOwnerMismatch()',
            collectRevertMessage: '',
            stake: true
        })

        await validateUnstake({
            signer: hre.props.bob,
            recipient: hre.props.bob.address,
            positionId: aliceId,
            revertMessage: 'RangeUnstake::PositionOwnerMisMatch()'
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '10000',
            upper: '20000',
            positionId: aliceId,
            liquidityAmount: aliceLiquidity.add(aliceLiquidity2),
            balance0Increase: BigNumber.from('191123764981132040271'),
            balance1Increase: BigNumber.from('52435214079638242717'),
            revertMessage: '',
            staked: true
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            revertMessage: 'RangeUnstake::PositionAlreadyUnstaked()'
        })
        // burn half of staked position
        // advance past end time
    })

    it('pool0 - Should mint, then mint again and return fees to position owner', async function () {
        const aliceLiquidity = BigNumber.from('419027207938949970576')
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
        const aliceId = await validateMint({
          signer: hre.props.alice,
          recipient: hre.props.alice.address,
          lower: '10000',
          upper: '20000',
          amount0: BigNumber.from(tokenAmount),
          amount1: BigNumber.from(tokenAmount),
          balance0Decrease: BigNumber.from('100000000000000000000'),
          balance1Decrease: BigNumber.from('0'),
          liquidityIncrease: aliceLiquidity,
          revertMessage: '',
          collectRevertMessage: '',
          stake: true
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '10000',
            upper: '20000',
            positionId: aliceId + 1,
            liquidityAmount: aliceLiquidity,
            balance0Increase: BigNumber.from('191123764981132040271'),
            balance1Increase: BigNumber.from('52435214079638242717'),
            revertMessage: 'BurnRangeStake::StakeNotFound()',
            staked: true
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: BigNumber.from(tokenAmount).div(4),
            priceLimit: maxPrice,
            balanceInDecrease: '25000000000000000000',
            balanceOutIncrease: '8871796901358525748',
            revertMessage: '',
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '10000',
            upper: '20000',
            positionId: aliceId,
            liquidityAmount: aliceLiquidity.div(2),
            balance0Increase: BigNumber.from('45566320608075454114'),
            balance1Increase: BigNumber.from('12499999999999999999'),
            revertMessage: '',
            staked: true
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '10000',
            upper: '20000',
            positionId: aliceId,
            liquidityAmount: aliceLiquidity.div(2),
            burnPercent: ethers.utils.parseUnits('1', 38),
            balance0Increase: BigNumber.from('45561882490566020135'),
            balance1Increase: BigNumber.from('12499999999999999999'),
            revertMessage: '',
            staked: true
        })
    });

    it('pool0 - Should mint, then mint again and return fees to position owner', async function () {
        const aliceLiquidity = BigNumber.from('154322912745161375')
        const aliceLiquidity2 = BigNumber.from('7430943319867')
        const aliceLiquidity3 = BigNumber.from('3086458254903227')
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

        const aliceId = await validateMint({
          signer: hre.props.alice,
          recipient: hre.props.alice.address,
          lower: '192930',
          upper: '206930',
          amount0: BigNumber.from('2076760730130'),
          amount1: BigNumber.from('1000000000000000000000'),
          balance0Decrease: BigNumber.from('2076760730130'),
          balance1Decrease: BigNumber.from('999999999999999994421'),
          liquidityIncrease: aliceLiquidity,
          revertMessage: '',
          collectRevertMessage: '',
          stake: true
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            amount0: BigNumber.from('100000000'),
            amount1: BigNumber.from('48151912037442989'),
            balance0Decrease: BigNumber.from('100000000'),
            balance1Decrease: BigNumber.from('48151912037442989'),
            liquidityIncrease: aliceLiquidity2,
            revertMessage: '',
            collectRevertMessage: '',
            stake: true
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            amount0: BigNumber.from('100000000'),
            amount1: BigNumber.from('48151912037442989'),
            balance0Decrease: BigNumber.from('100000000'),
            balance1Decrease: BigNumber.from('48151912037442989'),
            liquidityIncrease: aliceLiquidity2,
            revertMessage: '',
            collectRevertMessage: '',
            stake: true
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            amount0: BigNumber.from('100000000'),
            amount1: BigNumber.from('48151912037449469'),
            balance0Decrease: BigNumber.from('100000000'),
            balance1Decrease: BigNumber.from('48151912037442989'),
            liquidityIncrease: aliceLiquidity2,
            revertMessage: '',
            collectRevertMessage: '',
            stake: true
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            liquidityAmount: BigNumber.from('1543452055751209'),
            burnPercent: ethers.utils.parseUnits('1', 36),
            balance0Increase: BigNumber.from('20770607301'),
            balance1Increase: BigNumber.from('10001444557361118309'),
            revertMessage: '',
            staked: true
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            liquidityAmount: BigNumber.from('1528017535193697'),
            burnPercent: ethers.utils.parseUnits('1', 36),
            balance0Increase: BigNumber.from('20562901228'),
            balance1Increase: BigNumber.from('9901430111787507709'),
            revertMessage: '',
            staked: true
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            amount0: BigNumber.from('41535214603'),
            amount1: BigNumber.from('19999999999999996649'),
            balance0Decrease: BigNumber.from('41535214603'),
            balance1Decrease: BigNumber.from('19999999999999996649'),
            liquidityIncrease: aliceLiquidity3,
            revertMessage: '',
            collectRevertMessage: '',
            stake: true
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            liquidityAmount: BigNumber.from('0'),
            burnPercent: ethers.utils.parseUnits('1', 0),
            balance0Increase: BigNumber.from('0'),
            balance1Increase: BigNumber.from('0'),
            revertMessage: '',
            staked: true
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            revertMessage: ''
        })

        await validateStake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            revertMessage: ''
        })

        await validateUnstake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            revertMessage: ''
        })

        const aliceId3 = await validateMintLimit({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '199920',
            upper: '199930',
            amount: '100000000',
            mintPercent: ethers.utils.parseUnits('1', 24),
            zeroForOne: true,
            balanceInDecrease: '100000000',
            balanceOutIncrease: '48111686394178435',
            liquidityIncrease: '0',
            upperTickCleared: false,
            lowerTickCleared: false,
            revertMessage: '',
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            amount0: BigNumber.from('41535214603'),
            amount1: BigNumber.from('19998074804667013264'),
            balance0Decrease: BigNumber.from('41535214603'),
            balance1Decrease: BigNumber.from('19998074804667013264'),
            liquidityIncrease: BigNumber.from('3086309679115096'),
            revertMessage: 'PositionOwnerMismatch()',
            collectRevertMessage: '',
            stake: true
        })

        await validateStake({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            positionId: aliceId,
            revertMessage: '',
            balance1Increase: BigNumber.from('24067877135657'),
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            amount0: BigNumber.from('41535214603'),
            amount1: BigNumber.from('19998074804667013264'),
            balance0Decrease: BigNumber.from('41535214603'),
            balance1Decrease: BigNumber.from('19998074804667013264'),
            liquidityIncrease: BigNumber.from('3086309679115096'),
            revertMessage: '',
            collectRevertMessage: '',
            stake: true
        })

        await validateBurn({
            signer: hre.props.alice,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            liquidityAmount: BigNumber.from('78723251959097196'),
            burnPercent: ethers.utils.parseUnits('5', 37),
            balance0Increase: BigNumber.from('1059448825402'),
            balance1Increase: BigNumber.from('510095760058679693352'),
            revertMessage: '',
            staked: true
        })

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: BigNumber.from(tokenAmount).div(4),
            priceLimit: minPrice,
            balanceInDecrease: '1503864289552',
            balanceOutIncrease: '509840712178650359982',
            revertMessage: '',
        })

        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            amount0: BigNumber.from(tokenAmount),
            amount1: BigNumber.from(tokenAmount),
            balance0Decrease: BigNumber.from('100000000000000000000'),
            balance1Decrease: BigNumber.from('-255047880029339849'),
            liquidityIncrease: BigNumber.from('3071152388673759572111403'),
            revertMessage: '',
            collectRevertMessage: '',
            stake: true
        })

        await validateBurn({
            signer: hre.props.bob,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            liquidityAmount: BigNumber.from('3071152467397011531208600'),
            burnPercent: ethers.utils.parseUnits('1', 38),
            balance0Increase: BigNumber.from('100000002563313114953'),
            balance1Increase: BigNumber.from('0'),
            revertMessage: 'BurnRangeStake::PositionOwnerMismatch()',
            staked: true
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            liquidityAmount: BigNumber.from('3071152467397011531208600'),
            burnPercent: ethers.utils.parseUnits('1', 38),
            balance0Increase: BigNumber.from('100000002563313114953'),
            balance1Increase: BigNumber.from('0'),
            revertMessage: '',
            staked: true
        });

        await validateBurn({
            signer: hre.props.alice,
            lower: '192930',
            upper: '206930',
            positionId: aliceId,
            liquidityAmount: BigNumber.from('3071152467397011531208600'),
            burnPercent: ethers.utils.parseUnits('1', 38),
            balance0Increase: BigNumber.from('100000002563313114953'),
            balance1Increase: BigNumber.from('0'),
            revertMessage: 'BurnRangeStake::PositionAlreadyUnstaked()',
            staked: true
        });

        if (balanceCheck) {
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.limitPool.address)).toString())
            console.log('balance after token0:', (await hre.props.token0.balanceOf(hre.props.rangeStaker.address)).toString())
            console.log('balance after token1:', (await hre.props.token1.balanceOf(hre.props.rangeStaker.address)).toString())
        }
    });
})