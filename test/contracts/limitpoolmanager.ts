/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { gBefore } from '../utils/hooks.test'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { BN_ZERO, ZERO_ADDRESS } from '../utils/contracts/limitpool'

alice: SignerWithAddress
describe('LimitPoolManager Tests', function () {
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
  const psharkString = ethers.utils.formatBytes32String('PSHARK-RANGE')
  const constantProductString =  ethers.utils.formatBytes32String('CONSTANT-PRODUCT')

  before(async function () {
    await gBefore()
  })

  this.beforeEach(async function () {})

  it('Should be able to change owner', async function () {
    // check pool contract owner
    expect(await
        hre.props.limitPoolFactory
          .owner()
      ).to.be.equal(hre.props.limitPoolManager.address)

    // check admin contract owner
    expect(await
      hre.props.limitPoolManager
        .owner()
    ).to.be.equal(hre.props.admin.address)

    // expect revert if non-owner calls admin function
    await expect(
        hre.props.limitPoolManager
          .connect(hre.props.bob)
          .transferOwner(hre.props.bob.address)
    ).to.be.revertedWith('OwnerOnly()')

    // transfer ownership to bob
    await hre.props.limitPoolManager.connect(hre.props.admin).transferOwner(hre.props.bob.address)
    
    // expect bob to be the new admin
    expect(await
        hre.props.limitPoolManager
          .owner()
      ).to.be.equal(hre.props.bob.address)
    
    await expect(
        hre.props.limitPoolManager
          .connect(hre.props.admin)
          .transferOwner(hre.props.bob.address)
    ).to.be.revertedWith('OwnerOnly()')

    // transfer ownership back to previous admin
    await hre.props.limitPoolManager.connect(hre.props.bob).transferOwner(hre.props.admin.address)
    
    // check admin is owner again
    expect(await
        hre.props.limitPoolManager
        .owner()
    ).to.be.equal(hre.props.admin.address)
  })

  it('Should be able to change feeTo', async function () {
    // check admin contract feeTo
    expect(await
      hre.props.limitPoolManager
        .feeTo()
    ).to.be.equal(hre.props.admin.address)

    // owner should not be able to claim fees
    await hre.props.limitPoolManager.connect(hre.props.admin).transferOwner(hre.props.bob.address)

    // expect revert if non-owner calls admin function
    await expect(
        hre.props.limitPoolManager
          .connect(hre.props.bob)
          .transferFeeTo(hre.props.bob.address)
    ).to.be.revertedWith('FeeToOnly()')

    await hre.props.limitPoolManager.connect(hre.props.bob).transferOwner(hre.props.admin.address)

    // transfer ownership to bob
    await hre.props.limitPoolManager.connect(hre.props.admin).transferFeeTo(hre.props.bob.address)
    
    // expect bob to be the new admin
    expect(await
        hre.props.limitPoolManager
          .feeTo()
      ).to.be.equal(hre.props.bob.address)
    
    await expect(
        hre.props.limitPoolManager
          .connect(hre.props.admin)
          .transferFeeTo(hre.props.bob.address)
    ).to.be.revertedWith('FeeToOnly()')

    // transfer ownership back to previous admin
    await hre.props.limitPoolManager.connect(hre.props.bob).transferFeeTo(hre.props.admin.address)
    
    // check admin is owner again
    expect(await
        hre.props.limitPoolManager
        .feeTo()
    ).to.be.equal(hre.props.admin.address)
  })

  it('Should collect fees from limit pools', async function () {
    // check initial protocol fees
    await
      hre.props.limitPoolManager
        .collectProtocolFees([hre.props.limitPool.address])
    
    // without protocol fees balances should not change

    // anyone can send fees to the feeTo address
    hre.props.limitPoolManager
          .connect(hre.props.bob)
          .collectProtocolFees([hre.props.limitPool.address])
  })

  it('Should not set factory', async function () {
    // check initial protocol fees
    expect(await
      hre.props.limitPoolManager
        .factory()
    ).to.be.equal(hre.props.limitPoolFactory.address)

    // should revert when non-admin calls
    await expect(
        hre.props.limitPoolManager
          .connect(hre.props.bob)
          .setFactory(hre.props.bob.address)
    ).to.be.revertedWith('OwnerOnly()')

    await expect(
      hre.props.limitPoolManager
        .connect(hre.props.admin)
        .setFactory(hre.props.bob.address)
  ).to.be.revertedWith('FactoryAlreadySet()')

    expect(await
      hre.props.limitPoolManager
        .factory()
    ).to.be.equal(hre.props.limitPoolFactory.address)
  })

  it('Should not enable the same fee tier', async function () {
    await expect(
      hre.props.limitPoolManager
        .connect(hre.props.admin)
        .enableFeeTier("500", "40")
    ).to.be.revertedWith('FeeTierAlreadyEnabled()')
  })

  it('Should not create fee tier w/ invalid tick spacing', async function () {
    await expect(
      hre.props.limitPoolManager
        .connect(hre.props.admin)
        .enableFeeTier("100", "0")
    ).to.be.revertedWith('InvalidTickSpacing()')
    await expect(
      hre.props.limitPoolManager
        .connect(hre.props.admin)
        .enableFeeTier("100", "-10")
    ).to.be.revertedWith('InvalidTickSpacing()')
  })

  it('Should not create fee tier without tick spacing divisible by 2', async function () {
    await expect(
      hre.props.limitPoolManager
        .connect(hre.props.admin)
        .enableFeeTier("100", "5")
    ).to.be.revertedWith('InvalidTickSpacing()')
  })

  it('Should not create fee tier with invalid swap fee', async function () {
    await expect(
      hre.props.limitPoolManager
        .connect(hre.props.admin)
        .enableFeeTier("0", "10")
    ).to.be.revertedWith('InvalidSwapFee()')
    await expect(
      hre.props.limitPoolManager
        .connect(hre.props.admin)
        .enableFeeTier("10001", "10")
    ).to.be.revertedWith('InvalidSwapFee()')
  })

  /// @dev - pool type id is incremented each time
  // it('Should not enable pool type a second time', async function () {
  //   await expect(
  //     hre.props.limitPoolManager
  //       .connect(hre.props.admin)
  //       .enablePoolType(
  //         hre.props.limitPoolImpl.address,
  //         hre.props.positionERC1155.address,
  //         constantProductString
  //       )
  //   ).to.be.revertedWith('PoolTypeAlreadyExists()')
  // })

  it('Should not enable pool type w/ invalid impl addresses', async function () {
    await expect(
      hre.props.limitPoolManager
        .connect(hre.props.admin)
        .enablePoolType(
          ZERO_ADDRESS,
          hre.props.limitPoolImpl.address,
          constantProductString
        )
    ).to.be.revertedWith('InvalidPoolImplAddress()')
    await expect(
      hre.props.limitPoolManager
        .connect(hre.props.admin)
        .enablePoolType(
          hre.props.limitPoolImpl.address,
          ZERO_ADDRESS,
          constantProductString
        )
    ).to.be.revertedWith('InvalidTokenImplAddress()')
    await expect(
      hre.props.limitPoolManager
        .connect(hre.props.admin)
        .enablePoolType(
          hre.props.limitPoolImpl.address,
          hre.props.limitPoolImpl.address,
          constantProductString
        )
    ).to.be.revertedWith('InvalidImplAddresses()')
  })

  // it('Should enable new twap source', async function () {
  //   await hre.props.limitPoolManager
  //       .connect(hre.props.admin)
  //       .enableTwapSource(psharkString, hre.props.uniswapV3Source.address, hre.props.uniswapV3Source.address)
    
  //   const twapSource = await hre.props.limitPoolManager
  //     .twapSources(psharkString)
  //   expect(twapSource[0]).to.be.equal(hre.props.uniswapV3Source.address)
  //   expect(twapSource[1]).to.be.equal(hre.props.uniswapV3Source.address)
  // })


  // it('Should not enable twap source with OwnerOnly()', async function () {
  //   await expect(
  //     hre.props.limitPoolManager
  //       .connect(hre.props.bob)
  //       .enableTwapSource(psharkString, hre.props.uniswapV3Source.address, hre.props.uniswapV3Source.address)
  //   ).to.be.revertedWith('OwnerOnly()')
  // })

  // it('Should not enable twap source with invalid string', async function () {
  //   await expect(
  //     hre.props.limitPoolManager
  //       .connect(hre.props.admin)
  //       .enableTwapSource(ethers.utils.formatBytes32String(''), hre.props.uniswapV3Source.address, hre.props.uniswapV3Source.address)
  //   ).to.be.revertedWith('TwapSourceNameInvalid()')
  // })

  it('Should not update protocol fees on pool', async function () {
    let globalStateBefore = await hre.props.limitPool.globalState();
    await expect(
      hre.props.limitPoolManager
        .connect(hre.props.bob)
        .modifyProtocolFees(
          [hre.props.limitPool.address],
          [
            {
              protocolSwapFee0: 500,
              protocolSwapFee1: 500,
              protocolFillFee0: 500,
              protocolFillFee1: 500,
              setFeesFlags: 0
            }
          ]
        )
    ).to.be.revertedWith('OwnerOnly()')
    await expect(
        hre.props.limitPool
        .connect(hre.props.admin)
        .fees({
          protocolSwapFee0: 500,
          protocolSwapFee1: 500,
          protocolFillFee0: 500,
          protocolFillFee1: 500,
          setFeesFlags: 0
        })
    ).to.be.revertedWith('OwnerOnly()')
    await expect(
      hre.props.limitPoolManager
        .connect(hre.props.bob)
        .modifyProtocolFees(
          [hre.props.limitPool.address],
          [
            {
              protocolSwapFee0: 500,
              protocolSwapFee1: 500,
              protocolFillFee0: 500,
              protocolFillFee1: 500,
              setFeesFlags: 0
            }
          ]
        )
    ).to.be.revertedWith('OwnerOnly()')
    const txn = await hre.props.limitPoolManager
    .connect(hre.props.admin)
    .modifyProtocolFees(
      [hre.props.limitPool.address],
      [
        {
          protocolSwapFee0: 500,
          protocolSwapFee1: 500,
          protocolFillFee0: 500,
          protocolFillFee1: 500,
          setFeesFlags: 0
        }
      ]
    )
    await txn.wait();
    let globalStateAfter = await hre.props.limitPool.globalState();
    expect(globalStateBefore.pool.protocolSwapFee0).to.be.equal(globalStateAfter.pool.protocolSwapFee0)
    expect(globalStateBefore.pool.protocolSwapFee1).to.be.equal(globalStateAfter.pool.protocolSwapFee1)
    expect(globalStateBefore.pool0.protocolFillFee).to.be.equal(globalStateBefore.pool0.protocolFillFee)
    expect(globalStateBefore.pool1.protocolFillFee).to.be.equal(globalStateBefore.pool1.protocolFillFee)
    // erc-20 balance should not change
  })

  // modify each protocol fee one by one and verify others do not change

  // mint position and complete a swap with protocol fee turned on
  // verify protocol fees are incremented correctly for swap and fill fees
  // then turn all protocol fees off
})
