/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { gBefore } from '../utils/hooks.test'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'

const constantProductString =  ethers.utils.formatBytes32String('CONSTANT-PRODUCT')
const constantSumString = ethers.utils.formatBytes32String('CONSTANT-SUM')

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

    it('Should not initialize pool from non-factory address', async function () {
        await expect(
            hre.props.limitPool
                .connect(hre.props.admin)
                .initialize(
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('FactoryOnly()')
    })

    it('Should not create pool with identical token address', async function () {
        await expect(
            hre.props.limitPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    constantProductString,
                    '0x0000000000000000000000000000000000000000',
                    '0x0000000000000000000000000000000000000000',
                    '500',
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('InvalidTokenAddress()')
    })

    it('Should not create pool with invalid token address', async function () {
        await expect(
            hre.props.limitPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    constantProductString,
                    '0x0000000000000000000000000000000000000000',
                    hre.props.token0.address,
                    '500',
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('InvalidTokenAddress()')
        
        await expect(
            hre.props.limitPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    constantProductString,
                    '0x0000000000000000000000000000000000000000',
                    hre.props.token0.address,
                    '500',
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('InvalidTokenAddress()')
    })


    it('Should not create pool if the pair already exists', async function () {
        await expect(
            hre.props.limitPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    constantProductString,
                    hre.props.token1.address,
                    hre.props.token0.address,
                    '500',
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('PoolAlreadyExists()')

        await expect(
            hre.props.limitPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    constantProductString,
                    hre.props.token0.address,
                    hre.props.token1.address,
                    '500',
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('PoolAlreadyExists()')
    })

    it('Should not create pool if the fee tier is not valid', async function () {
        await expect(
            hre.props.limitPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    constantProductString,
                    hre.props.token1.address,
                    hre.props.token0.address,
                    '5',
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('FeeTierNotSupported()')
    })

    it('Should not create pool if the pool type is not valid', async function () {
        await expect(
            hre.props.limitPoolFactory
                .connect(hre.props.admin)
                .createLimitPool(
                    constantSumString,
                    hre.props.token1.address,
                    hre.props.token0.address,
                    '500',
                    '396140812571321687967719751680'
                )
        ).to.be.revertedWith('PoolTypeNotSupported()')
    })
})
