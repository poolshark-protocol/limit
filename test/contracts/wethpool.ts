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

    it('pool0 - Should mint, swap from native, and swap to native', async function () {
        
        const wethToken0 = hre.props.weth9.address == (await hre.props.wethPool.token0())

        if (wethToken0) {
            let globalState = await hre.props.wethPool.globalState()
            if (debugMode) console.log('weth pool start:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())
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
            // globalState = await hre.props.wethPool.globalState()
            // console.log('weth pool swap1:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())
            
            // no-op swap
            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: wethToken0,
                amountIn: tokenAmountBn.mul(2),
                priceLimit: wethToken0 ? maxPrice : minPrice,
                balanceInDecrease: '396087570498016', // only gas is used; all other ETH is returned
                balanceOutIncrease: '0',
                revertMessage: '',
                nativeIn: true,
                poolContract: hre.props.wethPool,
                gasUsed: '396087570498016'
            })
            
            // globalState = await hre.props.wethPool.globalState()
            // console.log('weth pool swap2:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())
            
            // wrap ETH and swap
            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: wethToken0,
                amountIn: tokenAmountBn.mul(2),
                priceLimit: wethToken0 ? minPrice : maxPrice,
                balanceInDecrease: '396087570498016', //TODO: set close to acutal ETH value
                balanceOutIncrease: wethToken0 ? '99949999999999999995' : '62386513241259004',
                revertMessage: '',
                nativeIn: true,
                poolContract: hre.props.wethPool,
                gasUsed: '396087570498016'
            })

            // globalState = await hre.props.wethPool.globalState()
            // console.log('weth pool swap3 price', globalState.pool.price.toString(), globalState.pool.liquidity.toString())

            // swap to WETH and unwrap
            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: !wethToken0,
                amountIn: tokenAmountBn.mul(2),
                priceLimit: wethToken0 ? maxPrice : minPrice,
                balanceInDecrease: wethToken0 ? '200000000000000000000' : '139118081063935784',
                balanceOutIncrease: '123802240493864890', //TODO: set close to acutal ETH value
                revertMessage: '',
                nativeOut: true,
                poolContract: hre.props.wethPool,
                gasUsed: '396087570498016'
            })

            // globalState = await hre.props.wethPool.globalState()
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
                poolContract: hre.props.wethPool,
                poolTokenContract: hre.props.wethPoolToken,
            })

            // globalState = await hre.props.wethPool.globalState()
            // console.log('weth pool end price', globalState.pool.price.toString(), globalState.pool.liquidity.toString())

            if (debugMode) await getPositionLiquidity(true, aliceId)
        }   
    })

    it('pool - errantly send ETH to pool and retrieve with fees call', async function () {

        if (debugMode) console.log('pool eth balance before send:', (await ethers.provider.getBalance(hre.props.limitPool.address)).toString())
        if (debugMode) console.log('alice eth balance before send:', (await ethers.provider.getBalance(hre.props.alice.address)).toString())

        const sendTxn = await hre.props.alice.sendTransaction({
            to: hre.props.limitPool.address,
            value: ethers.utils.parseEther("50.0")
        });
        await sendTxn.wait();

        const sendTxn2 = await hre.props.alice.sendTransaction({
            to: hre.props.limitPoolToken.address,
            value: ethers.utils.parseEther("50.0")
        });
        await sendTxn2.wait();

        if (debugMode) console.log('pool eth balance after:', (await ethers.provider.getBalance(hre.props.limitPool.address)).toString())
        if (debugMode) console.log('pool token eth balance after:', (await ethers.provider.getBalance(hre.props.limitPoolToken.address)).toString())

        expect(await ethers.provider.getBalance(hre.props.limitPool.address)).to.be.equal(ethers.utils.parseEther("50.0"))
        expect(await ethers.provider.getBalance(hre.props.limitPoolToken.address)).to.be.equal(ethers.utils.parseEther("50.0"))

        const collectTxn = await hre.props.limitPoolManager.connect(hre.props.admin).collectProtocolFees([hre.props.limitPool.address])
        await collectTxn.wait()

        expect(await ethers.provider.getBalance(hre.props.limitPool.address)).to.be.equal(ethers.utils.parseEther("0.0"))
        expect(await ethers.provider.getBalance(hre.props.limitPoolToken.address)).to.be.equal(ethers.utils.parseEther("0.0"))

        if (debugMode) console.log('pool eth balance after collect:', (await ethers.provider.getBalance(hre.props.limitPool.address)).toString())
        if (debugMode) console.log('pool token eth balance after:', (await ethers.provider.getBalance(hre.props.limitPoolToken.address)).toString())
    })

    it('pool - send too low of ETH amount in msg.value', async function () {

        const wethToken0 = hre.props.weth9.address == (await hre.props.wethPool.token0())

        if (wethToken0) {
            let globalState = await hre.props.wethPool.globalState()
            if (debugMode) console.log('weth pool start:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())
            const aliceLiquidity = '10405966812730338361'
            // mint should revert
            const aliceId = await validateMintRange({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                lower: '69080',
                upper: '80070',
                amount0: BigNumber.from(tokenAmount),
                amount1: BigNumber.from(tokenAmount),
                balance0Decrease: BigNumber.from('7356461269128718'),
                balance1Decrease: BigNumber.from('99999999999999999991'),
                liquidityIncrease: BigNumber.from("5202983406365169180"),
                revertMessage: '',
                poolContract: hre.props.wethPool,
                poolTokenContract: hre.props.wethPoolToken
            })
            // globalState = await hre.props.wethPool.globalState()
            // console.log('weth pool swap1:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())
            
            // no-op swap
            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: true,
                amountIn: tokenAmountBn.mul(2),
                priceLimit: minPrice,
                balanceInDecrease: '396087570498016', // only gas is used; all other ETH is returned
                balanceOutIncrease: '0',
                revertMessage: 'WrapEth::LowEthBalance()',
                nativeIn: true,
                poolContract: hre.props.wethPool,
                gasUsed: '396087570498016',
                customMsgValue: BigNumber.from(2)
            })

            await expect(
                hre.props.token0
                .connect(hre.props.alice)
                .transferIntoTest()
            ).to.be.revertedWith('SafeTransfers::CannotTransferInEth()');
        }
    })
})