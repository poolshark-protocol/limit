/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { mintSigners20 } from '../utils/token'
import {
    BN_ZERO,
    PoolState,
    validateBurn,
    validateMint,
    validateSwap
} from '../utils/contracts/limitpool'

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

    it('pool0 - Should deploy a new pool 13', async function () {
        // mint should revert
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '0',
            upper: '100',
            amount: tokenAmountBn,
            zeroForOne: true,
            balanceInDecrease: tokenAmountBn,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: false,
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
            lowerTickCleared: false,
            upperTickCleared: false,
            revertMessage: '',
        })
    })
})
