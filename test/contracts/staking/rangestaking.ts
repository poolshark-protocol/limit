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
    validateMint,
    validateUnstake,
} from '../../utils/contracts/rangepool'
import { gBefore } from '../../utils/hooks.test'

alice: SignerWithAddress
describe('WethPool Tests', function () {
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
        console.log('limit pool address:', hre.props.limitPool.address)
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
            positionId: aliceId,
            revertMessage: ''
        })
        return
    
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
    })
})