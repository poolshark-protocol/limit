/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { mintSigners20 } from '../utils/token'
import {
    BN_ZERO,
    LimitPoolState,
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
import {
    validateMint as validateMintRange
} from '../utils/contracts/rangepool'
import { gBefore } from '../utils/hooks.test'

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

    it.only('pool0 - Should mint, swap from native, and swap to native', async function () {
        console.log('weth pool address', hre.props.wethPool.address)
        const aliceLiquidity = '10405966812730338361'
        // mint should revert
        const aliceId = await validateMintRange({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '69080',
            upper: '80070',
            amount0: BigNumber.from(tokenAmount),
            amount1: BigNumber.from(tokenAmount),
            balance0Decrease: BigNumber.from('62417722102310161'),
            balance1Decrease: BigNumber.from('99999999999999999996'),
            liquidityIncrease: BigNumber.from(aliceLiquidity),
            revertMessage: '',
            poolContract: hre.props.wethPool,
            poolTokenContract: hre.props.wethPoolToken
        })

        // no-op swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: '396087570498016', // only gas is used; all other ETH is returned
            balanceOutIncrease: '0',
            revertMessage: '',
            nativeIn: true,
            poolContract: hre.props.wethPool,
            gasUsed: '396087570498016'
        })

        // wrap ETH and swap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: true,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: minPrice,
            balanceInDecrease: '396087570498016', // only gas is used; all other ETH is returned
            balanceOutIncrease: '99949999999999999995',
            revertMessage: '',
            nativeIn: true,
            poolContract: hre.props.wethPool,
            gasUsed: '396087570498016'
        })

        // swap to WETH and unwrap
        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: tokenAmountBn.mul(2),
            priceLimit: maxPrice,
            balanceInDecrease: '200000000000000000000', // only gas is used; all other ETH is returned
            balanceOutIncrease: '123799952952450942',
            revertMessage: '',
            nativeOut: true,
            poolContract: hre.props.wethPool,
            gasUsed: '396087570498016'
        })

        return

        expect(await getLiquidity(true)).to.be.equal(BN_ZERO)

        await validateBurn({
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
            revertMessage: '',
        })

        if (debugMode) await getPositionLiquidity(true, aliceId)
    })
})