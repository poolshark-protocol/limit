/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { mintSigners20 } from '../utils/token'
import {
    BN_ONE,
    BN_ZERO,
    LimitPoolState,
    getLiquidity,
    getPositionLiquidity,
    validateSwap
} from '../utils/contracts/limitpool'
import {
    validateMint as validateMintRange,
    validateBurn as validateBurnRange,
} from '../utils/contracts/rangepool'
import { gBefore } from '../utils/hooks.test'

alice: SignerWithAddress
describe('WbtcPool Tests', function () {
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

    it.skip('pool - should try to replicate burnLimit txn', async function () {
        debugMode = true
        const isWethToken0 = hre.props.weth9.address == (await hre.props.wbtcPool.token0())

        //wbtc token0
        //weth token1

        if (isWethToken0 || debugMode) {
            let globalState = await hre.props.wbtcPool.globalState()
            if (debugMode) console.log('wbtc pool start:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())

            const aliceLiquidity = '199296353479'
            // mint should revert
            // "eventName": "MintRange",
            // "txnBlockNumber": "3708581",
            // "txnHash": "0x6396581889b5bafaee82aebc135b914838244a9fb63501441c3a60977bffd8e1"
            const aliceId = await validateMintRange({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                lower: '-201260',
                upper: '-199260',
                amount0: BigNumber.from('228168600673920'),
                amount1: BigNumber.from('412930'),
                balance0Decrease: BigNumber.from('228168600673920'),
                balance1Decrease: BigNumber.from('412930'),
                liquidityIncrease: BigNumber.from(aliceLiquidity),
                revertMessage: '',
                poolContract: hre.props.wbtcPool,
                poolTokenContract: hre.props.wbtcPoolToken
            })

            // globalState = await hre.props.wbtcPool.globalState()
            // console.log('weth pool swap1:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3708737",
            // "txnHash": "0xe030dd93be3786729a5dcf49cf48e35971d3f8361b38b44e1710181a6c25d222"
            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: true,
                amountIn: BigNumber.from('10000000000000'),
                priceLimit: BigNumber.from('3533530660410786729426943'),
                balanceInDecrease: '10000000000000', // only gas is used; all other ETH is returned
                balanceOutIncrease: '19935',
                revertMessage: '',
                nativeIn: false,
                poolContract: hre.props.wbtcPool,
                gasUsed: '396087570498016'
            })

            globalState = await hre.props.wbtcPool.globalState()
            if (debugMode) console.log('wbtc pool 2:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())

            // "eventName": "MintRange",
            // "txnBlockNumber": "3708825",
            // "txnHash": "0xc122f92228925070ca78e2bd7bbe410e46ab86c1695e724ec91e65433d8bedfd"
            const aliceId2 = await validateMintRange({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                lower: '-202590',
                upper: '-198120',
                amount0: BigNumber.from('10000000000000'),
                amount1: BigNumber.from('19894'),
                balance0Decrease: BigNumber.from('9999999998857'),
                balance1Decrease: BigNumber.from('19894'),
                liquidityIncrease: BigNumber.from('4218569163'),
                revertMessage: '',
                poolContract: hre.props.wbtcPool,
                poolTokenContract: hre.props.wbtcPoolToken
            })

            // globalState = await hre.props.wbtcPool.globalState()
            // console.log('weth pool swap2:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3710164",
            // "txnHash": "0x014671ab9283dc1efed4c20f3cf296916cafce6be5afeb0a8b8c26b8b1dbd5b2"
            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: isWethToken0,
                amountIn: tokenAmountBn.mul(2),
                priceLimit: isWethToken0 ? minPrice : maxPrice,
                balanceInDecrease: '396087570498016', //TODO: set close to acutal ETH value
                balanceOutIncrease: isWethToken0 ? '99949999999999999995' : '62386513241259004',
                revertMessage: '',
                nativeIn: true,
                poolContract: hre.props.wbtcPool,
                gasUsed: '396087570498016'
            })
            return
            // "eventName": "CollectRange",
            // "txnBlockNumber": "3710681",
            // "txnHash": "0xb3abaf17dddc1faeb665cecab389b7caaaf0bc005b04a85b814f1b92bacdea33"

            // globalState = await hre.props.wbtcPool.globalState()
            // console.log('weth pool swap3 price', globalState.pool.price.toString(), globalState.pool.liquidity.toString())

            // "eventName": "Swap",
            // "txnBlockNumber": "3718056",
            // "txnHash": "0xff530fa67e5d890364970be46c4cb3b06a9c993350e10a414f4a6d8e89316e38"


            // swap to WETH and unwrap
            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: !isWethToken0,
                amountIn: tokenAmountBn.mul(2),
                priceLimit: isWethToken0 ? maxPrice : minPrice,
                balanceInDecrease: isWethToken0 ? '200000000000000000000' : '139118081063935784',
                balanceOutIncrease: '123802240493864890', //TODO: set close to acutal ETH value
                revertMessage: '',
                nativeOut: true,
                poolContract: hre.props.wbtcPool,
                gasUsed: '396087570498016'
            })

            // globalState = await hre.props.wbtcPool.globalState()
            // console.log('weth pool burn price', globalState.pool.price.toString(), globalState.pool.liquidity.toString())

            await validateBurnRange({
                signer: hre.props.alice,
                positionId: aliceId,
                lower: '69080',
                upper: '80070',
                liquidityAmount: BigNumber.from(aliceLiquidity),
                balance0Increase: BigNumber.from('14775125117520274'),
                balance1Increase: BigNumber.from('200049999999999999998'),
                revertMessage: '',
                poolContract: hre.props.wbtcPool,
                poolTokenContract: hre.props.wbtcPoolToken,
            })

            // globalState = await hre.props.wbtcPool.globalState()
            // console.log('weth pool end price', globalState.pool.price.toString(), globalState.pool.liquidity.toString())

            if (debugMode) await getPositionLiquidity(true, aliceId)
        }
    })
})