import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { gBefore } from '../../../utils/hooks.test'

describe('DyDxMath Library Tests', function () {
    let token0Amount: BigNumber
    let token1Amount: BigNumber
    let token0Decimals: number
    let token1Decimals: number
    let currentPrice: BigNumber

    let alice: SignerWithAddress
    let bob: SignerWithAddress
    let carol: SignerWithAddress

    before(async function () {
        await gBefore()
    })

    this.beforeEach(async function () {})

    // it('Should get accurate dx value when rounding up', async function () {
    //     expect(
    //         await hre.props.constantProduct.getDx(
    //             BigNumber.from('49753115595468372952776'),
    //             BigNumber.from('79545693927487839655804034730'),
    //             BigNumber.from('79625275426524748796330556128'),
    //             true
    //         )
    //     ).to.be.equal(BigNumber.from('49527266455736296113'))
    // })

    // it('Should get accurate dy value across first tick', async function () {
    //     expect(
    //         await hre.props.constantProduct.getDy(
    //             BigNumber.from('49753115595468372952776'),
    //             BigNumber.from('79545693927487839655804034730'),
    //             BigNumber.from('79625275426524748796330556128'),
    //             true
    //         )
    //     ).to.be.equal(BigNumber.from('49975001251999693578'))
    // })

    // it('Should get accurate dy value across second tick', async function () {
    //     expect(
    //         await hre.props.constantProduct.getDy(
    //             BigNumber.from('49753115595468372952776'),
    //             BigNumber.from('79625275426524748796330556128'),
    //             BigNumber.from('79704936542881920863903188245'),
    //             false
    //         )
    //     ).to.be.equal(BigNumber.from('50024998748000306422'))
    // })

    // it('Should get accurate dy value across multiple ticks', async function () {
    //     expect(
    //         await hre.props.constantProduct.getDy(
    //             BigNumber.from('49753115595468372952776'),
    //             BigNumber.from('79545693927487839655804034730'),
    //             BigNumber.from('79704936542881920863903188245'),
    //             false
    //         )
    //     ).to.be.equal(BigNumber.from('99999999999999999999'))
    // })

    // it('Should revert if getting liquidity value outside price bounds', async function () {
    //     await expect(
    //         hre.props.constantProduct.getLiquidityForAmounts(
    //             BigNumber.from('79386769463160146968577785965'),
    //             BigNumber.from('79545693927487839655804034729'),
    //             BigNumber.from('99855108194609381495771'),
    //             BigNumber.from('20'),
    //             BigNumber.from('20')
    //         )
    //     ).to.be.revertedWith('PriceOutsideBounds()')
    //     // )).to.be.revertedWith("PriceOutsideOfBounds()");
    // })
})
