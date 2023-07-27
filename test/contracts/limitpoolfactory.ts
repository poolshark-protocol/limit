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
            hre.props.limitPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    '0x0000000000000000000000000000000000000000',
                    '0x0000000000000000000000000000000000000000',
                    '10',
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('InvalidTokenAddress()')
    })

    it('Should not create pool with invalid token address', async function () {
        await expect(
            hre.props.limitPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    '0x0000000000000000000000000000000000000000',
                    hre.props.token0.address,
                    '10',
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('InvalidTokenAddress()')
        
        await expect(
            hre.props.limitPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    '0x0000000000000000000000000000000000000000',
                    hre.props.token0.address,
                    '10',
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('InvalidTokenAddress()')
    })


    it('Should not create pool if the pair already exists', async function () {
        await expect(
            hre.props.limitPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    hre.props.token1.address,
                    hre.props.token0.address,
                    '10',
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('PoolAlreadyExists()')
    })

    it('Should not create pool if the tick spacing is not valid', async function () {
        await expect(
            hre.props.limitPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    hre.props.token1.address,
                    hre.props.token0.address,
                    '5',
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('TickSpacingNotSupported()')
    })
})
