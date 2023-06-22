/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { gBefore } from '../utils/hooks.test'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'

alice: SignerWithAddress
describe('LimitPoolFactory Tests', function () {
    let token0Amount: BigNumber
    let token1Amount: BigNumber
    let token0Decimals: number
    let token1Decimals: number
    let currentPrice: BigNumber

    let alice: SignerWithAddress
    let bob: SignerWithAddress
    let carol: SignerWithAddress

    const liquidityAmount = BigNumber.from('99855108194609381495771')
    const minTickIdx = BigNumber.from('-887272')
    const maxTickIdx = BigNumber.from('887272')
    const uniV3String = ethers.utils.formatBytes32String('UNI-V3')

    before(async function () {
        await gBefore()
    })

    this.beforeEach(async function () {})

    it('Should not create pool with identical token address', async function () {
        await expect(
            hre.props.coverPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    uniV3String,
                    '0x0000000000000000000000000000000000000000',
                    '0x0000000000000000000000000000000000000000',
                    '500',
                    '20',
                    '5'
                )
        ).to.be.revertedWith('Transaction reverted: function returned an unexpected amount of data')
    })

    it('Should not create pool with invalid twap source', async function () {
        await expect(
            hre.props.coverPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    ethers.utils.formatBytes32String('test'),
                    '0x0000000000000000000000000000000000000000',
                    '0x0000000000000000000000000000000000000000',
                    '500',
                    '20',
                    '5'
                )
        ).to.be.revertedWith('TwapSourceNotFound()')
    })

    it('Should not create pool if the pair already exists', async function () {
        await expect(
            hre.props.coverPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    uniV3String,
                    hre.props.token1.address,
                    hre.props.token0.address,
                    '500',
                    '20',
                    '5'
                )
        ).to.be.revertedWith('PoolAlreadyExists()')
    })

    it('Should not create pool if volatility tier does not exist', async function () {
        await expect(
            hre.props.coverPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    uniV3String,
                    hre.props.token1.address,
                    hre.props.token0.address,
                    '2000',
                    '20',
                    '5'
                )
        ).to.be.revertedWith('VolatilityTierNotSupported()')
    })
})
