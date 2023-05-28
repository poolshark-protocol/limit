import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { gBefore } from '../../utils/hooks.test'
import { BN_ZERO } from '../../utils/contracts/coverpool'

describe('TickMath Library Tests', function () {
    let token0Amount: BigNumber
    let token1Amount: BigNumber
    let token0Decimals: number
    let token1Decimals: number
    let currentPrice: BigNumber

    let alice: SignerWithAddress
    let bob: SignerWithAddress
    let carol: SignerWithAddress
    let constants

    before(async function () {
        await gBefore()
        constants = {
            source: hre.props.uniswapV3Source.address,
            bounds: {
                min: BigNumber.from('4302006101'),
                max: BigNumber.from('1459110375135176227217141799363990665779938914150')
            },
            token0: hre.props.token0.address,
            token1: hre.props.token1.address,
            inputPool: '0x0000000000000000000000000000000000000000',
            minAmountPerAuction: BN_ZERO,
            tickSpread: BigNumber.from('40'),
            twapLength: BigNumber.from('5'),
            auctionLength: BigNumber.from('5'),
            blockTime: BigNumber.from('1000'),
            token0Decimals: '18',
            token1Decimals: '18',
            minAmountLowerPriced: true,
            genesisTime: '0',
            minPositionWidth: '1'
        }
    })

    this.beforeEach(async function () {})

    // it('validatePrice - Should revert below min sqrt price', async function () {
    //     let minPrice = BigNumber.from('4297706460')
    //     await expect(
    //         hre.props.coverPool.swap({
    //             to: hre.props.admin.address,
    //             refundTo: hre.props.admin.address,
    //             zeroForOne: true,
    //             amountIn: BigNumber.from('0'),
    //             priceLimit: minPrice.sub(1)
    //         })
    //     ).to.be.revertedWith('PriceOutOfBounds()')
    // })

    // it('validatePrice - Should revert at or above max sqrt price', async function () {
    //     let maxPrice = BigNumber.from('1460570142285104104286607650833256105367815198571')
    //     await expect(
    //         hre.props.coverPool.swap({
    //             to: hre.props.admin.address,
    //             refundTo: hre.props.admin.address,
    //             zeroForOne: true,
    //             amountIn: BigNumber.from('0'),
    //             priceLimit: maxPrice.add(1)
    //         })
    //     ).to.be.revertedWith('PriceOutOfBounds()')
    // })

    // it('getPriceAtTick - Should get tick near min sqrt price', async function () {
    //     expect(
    //         await hre.props.constantProduct.getPriceAtTick(BigNumber.from('-887240'), constants)
    //     ).to.be.equal(BigNumber.from('4302006101'))
    // })

    // it('getTickAtPrice - Should get tick at min sqrt price', async function () {
    //     expect(
    //         await hre.props.constantProduct.getTickAtPrice(BigNumber.from('4302006102'), constants)
    //     ).to.be.equal(BigNumber.from('-887240'))
    // })

    // it('getTickAtPrice - Should get tick at sqrt price', async function () {
    //     expect(
    //         await hre.props.constantProduct.getTickAtPrice(BigNumber.from('83095200000000000000000000000'), constants)
    //     ).to.be.equal(BigNumber.from('953'))
    // })

    // it('getTickAtPrice - Should get tick near max sqrt price', async function () {
    //     expect(
    //         await hre.props.constantProduct.getTickAtPrice(
    //             BigNumber.from('1459110375135176227217141799363990665779938914149'), constants
    //         )
    //     ).to.be.equal(BigNumber.from('887239'))
    // })

    // it('getTickAtPrice - Should revert at max sqrt price', async function () {
    //     await expect(
    //         hre.props.constantProduct.getTickAtPrice(
    //             BigNumber.from('1461446703485210103287273052203988822378723970342'), constants
    //         )
    //     ).to.be.revertedWith('PriceOutOfBounds()')
    // })

    // it('getTickAtPrice - Should revert when sqrt price is below bounds', async function () {
    //     await expect(
    //         hre.props.constantProduct.getTickAtPrice(BigNumber.from('4295128738'), constants)
    //     ).to.be.revertedWith('PriceOutOfBounds()')
    // })

    // it('getTickAtPrice - Should revert when sqrt price is above bounds', async function () {
    //     await expect(
    //         hre.props.constantProduct.getTickAtPrice(
    //             BigNumber.from('1461446703485210103287273052203988822378723970343'),
    //             constants
    //         )
    //     ).to.be.revertedWith('PriceOutOfBounds()')
    // })
})
