import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { LimitPool, PositionERC1155 } from '../../../typechain'
import { BN_ONE, RangePoolState, RangeStake, RangeTick, Tick } from './limitpool'
import { getMintRangeInputData } from './poolsharkrouter'

export const Q96 = BigNumber.from('2').pow(96)
export const BN_ZERO = BigNumber.from('0')
export interface Position {
  feeGrowthInside0Last: BigNumber
  feeGrowthInside1Last: BigNumber
  liquidity: BigNumber
  lower: number
  upper: number
}

export interface SampleState {
  index: number
  length: number
  lengthNext: number
}

export interface ProtocolFees {
  token0: BigNumber
  token1: BigNumber
}

export interface SwapCache {
  cross: boolean
  crossTick: number
  swapFee: number
  protocolFee: number
  input: BigNumber
  output: BigNumber
  amountIn: BigNumber
}

export interface ValidateMintParams {
  signer: SignerWithAddress
  recipient: string
  lower: string
  upper: string
  amount0: BigNumber
  amount1: BigNumber
  balance0Decrease: BigNumber
  balance1Decrease: BigNumber
  positionId?: number
  liquidityIncrease: BigNumber
  revertMessage: string
  collectRevertMessage?: string
  balanceCheck?: boolean
  poolContract?: LimitPool
  poolTokenContract?: PositionERC1155
  stake?: boolean
  customMsgValue?: BigNumber
}

export interface ValidateSampleParams {
  secondsPerLiquidityAccum: string
  tickSecondsAccum: string
  averagePrice: string
  averageLiquidity: string
  averageTick: number
}

export interface ValidateSwapParams {
  signer: SignerWithAddress
  recipient: string
  zeroForOne: boolean
  amount: BigNumber
  sqrtPriceLimitX96: BigNumber
  balanceInDecrease: BigNumber
  balanceOutIncrease: BigNumber
  revertMessage: string
  exactIn?: boolean
  poolContract?: LimitPool
}

export interface ValidateBurnParams {
  signer: SignerWithAddress
  lower: string
  upper: string
  positionId: number
  burnPercent?: BigNumber
  liquidityAmount: BigNumber
  balance0Increase: BigNumber
  balance1Increase: BigNumber
  revertMessage: string
  poolContract?: LimitPool
  poolTokenContract?: PositionERC1155
  staked?: boolean
  recipient?: string
}

export interface ValidateStakeParams {
  signer: SignerWithAddress
  recipient: string
  positionId: number
  balance0Increase?: BigNumber
  balance1Increase?: BigNumber
  revertMessage: string
  poolContract?: LimitPool
  poolTokenContract?: PositionERC1155
}

export interface ValidateUnstakeParams {
  signer: SignerWithAddress
  recipient: string
  positionId: number
  balance0Increase?: BigNumber
  balance1Increase?: BigNumber
  revertMessage: string
  poolContract?: LimitPool
  poolTokenContract?: PositionERC1155
}

export async function getTickAtPrice() {
  const tickAtPrice = (await hre.props.limitPool.globalState()).pool.tickAtPrice
  console.log('tick at price:', tickAtPrice)
}

export async function getPrice(poolContract?: LimitPool) {
  const poolPrice = (await (poolContract ?? hre.props.limitPool).globalState()).pool.price
  console.log('pool price:', poolPrice.toString())
}

export async function getRangeLiquidity() {
  const poolLiquidity = (await hre.props.limitPool.globalState()).pool.liquidity
  console.log('range pool liquidity:', poolLiquidity.toString())
}

export async function getRangeBalanceOf(owner: string, positionId: number): Promise<BigNumber> {
  const balance = await hre.props.limitPoolToken.balanceOf(owner, positionId)
  console.log('position token balance')
  console.log('----------------------')
  console.log('balance:', balance.toString())
  return balance
}

export async function getTickFeeGrowth(index: number) {
  const tick: Tick = await hre.props.limitPool.ticks(index)
  console.log('feegrowth for', index, ':', tick.range.feeGrowthOutside0.toString(), tick.range.feeGrowthOutside1.toString())
}

export async function getTickLiquidity(index: number) {
  const tick: Tick = await hre.props.limitPool.ticks(index)
  console.log('liquiditydelta for', index, ':', tick.range.liquidityDelta.toString())
}

export async function getFeeGrowthGlobal() {
  const pool: RangePoolState = await (await hre.props.limitPool.globalState()).pool
  console.log('feegrowth global:', pool.feeGrowthGlobal0.toString(), pool.feeGrowthGlobal1.toString())
}

// export async function getRangeFeeGrowth(lower: number, upper: number) {
//   const feeGrowth = await hre.props.rangePositionsLib.rangeFeeGrowth(
//     hre.props.limitPool.address,
//     lower,
//     upper
//   )
//   console.log('range fee growth', lower, upper, ':', feeGrowth.feeGrowthInside0.toString(), feeGrowth.feeGrowthInside1.toString())
// }

export async function getPositionFeeGrowth(positionId: number) {
  const position = await hre.props.limitPool.positions(positionId)
  console.log('position fee growth', positionId, position.feeGrowthInside0Last.toString(), position.feeGrowthInside1Last.toString())
}

export async function getSnapshot(positionId: number) {
  const snapshot = await hre.props.limitPool.snapshotRange(
    positionId
  )
  console.log('snapshot for position', positionId, ':')
  console.log('feesOwed0:', snapshot.feesOwed0.toString())
  console.log('feesOwed1:', snapshot.feesOwed1.toString())
  console.log()
}

export async function getSample(print = false) {
  const sample = await hre.props.limitPool.sample([0])
  if(print) {
    console.log('sample for [0]:')
    console.log('seconds per liquidity accum:', sample.secondsPerLiquidityAccum[0].toString())
    console.log('tick seconds accum:', sample.tickSecondsAccum[0].toString())
    console.log('average liquidity:', sample.averageLiquidity.toString())
    console.log('average price:', sample.averagePrice.toString())
    console.log('average tick:', sample.averageTick.toString())
  }
  return sample
}

export async function validateSample(params: ValidateSampleParams) {
  const secondsPerLiquidityAccum = params.secondsPerLiquidityAccum
  const tickSecondsAccum = BigNumber.from(params.tickSecondsAccum)
  const averagePrice = BigNumber.from(params.averagePrice)
  const averageTick = BigNumber.from(params.averageTick)
  const averageLiquidity = BigNumber.from(params.averageLiquidity)

  const sample = await getSample()

  expect(sample.secondsPerLiquidityAccum[0]).to.be.equal(secondsPerLiquidityAccum)
  expect(sample.tickSecondsAccum[0]).to.be.equal(tickSecondsAccum)
  expect(sample.averagePrice).to.be.equal(averagePrice)
  expect(sample.averageTick).to.be.equal(averageTick)
  expect(sample.averageLiquidity).to.be.equal(averageLiquidity)
}

export async function validateSwap(params: ValidateSwapParams) {
  const signer = params.signer
  const recipient = params.recipient
  const zeroForOne = params.zeroForOne
  const amount = params.amount
  const sqrtPriceLimitX96 = params.sqrtPriceLimitX96
  const balanceInDecrease = params.balanceInDecrease
  const balanceOutIncrease = params.balanceOutIncrease
  const revertMessage = params.revertMessage
  const poolContract = params.poolContract ?? hre.props.limitPool
  const poolBefore: RangePoolState = (await poolContract.globalState()).pool
  const liquidityBefore = poolBefore.liquidity
  const priceBefore = poolBefore.price
  const nearestTickBefore = poolBefore.tickAtPrice

  // quote pre-swap and validate balance changes match post-swap
  const quote = await poolContract.quote({
    zeroForOne: zeroForOne,
    amount: amount,
    exactIn: params.exactIn ?? true,
    priceLimit: sqrtPriceLimitX96
  })
  const inAmount = quote[0]
  const outAmount = quote[1]
  const priceAfterQuote = quote[2]


  let balanceInBefore
  let balanceOutBefore
  if (zeroForOne) {
    balanceInBefore = await hre.props.token0.balanceOf(signer.address)
    balanceOutBefore = await hre.props.token1.balanceOf(signer.address)
    let approve0Txn
    if (params.exactIn ?? true) {
      approve0Txn = await hre.props.token0.approve(hre.props.poolRouter.address, amount)
    } else {
      approve0Txn = await hre.props.token0.approve(hre.props.poolRouter.address, inAmount)
    }
    await approve0Txn.wait()
  } else {
    balanceInBefore = await hre.props.token1.balanceOf(signer.address)
    balanceOutBefore = await hre.props.token0.balanceOf(signer.address)
    let approve1Txn
    if (params.exactIn ?? true) {
      approve1Txn = await hre.props.token1.approve(hre.props.poolRouter.address, amount)
    } else {
      approve1Txn = await hre.props.token1.approve(hre.props.poolRouter.address, inAmount)
    }
    await approve1Txn.wait()
  }

  const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
  const exchangeRateLimit = inAmount?.gt(BN_ZERO) ? outAmount.mul(Q96).div(inAmount) : BN_ZERO

  if (revertMessage == '') {
    let txn = await hre.props.poolRouter
      .connect(signer)
      .multiSwapSplit(
      [poolContract.address],  
      {
        to: signer.address,
        zeroForOne: zeroForOne,
        amount: amount,
        priceLimit: sqrtPriceLimitX96,
        exactIn: params.exactIn ?? true,
        callbackData: ethers.utils.formatBytes32String('')
      },
      exchangeRateLimit,
      blockTimestamp + 1,
      {gasLimit: 10000000})
    await txn.wait()
  } else {
    await expect(
      hre.props.poolRouter
      .connect(signer)
      .multiSwapSplit(
        [poolContract.address],  
        {
          to: signer.address,
          zeroForOne: zeroForOne,
          amount: amount,
          priceLimit: sqrtPriceLimitX96,
          exactIn: params.exactIn ?? true,
          callbackData: ethers.utils.formatBytes32String('')
        },
        exchangeRateLimit,
        blockTimestamp + 1
      )
    ).to.be.revertedWith(revertMessage)
    return
  }

  let balanceInAfter
  let balanceOutAfter
  if (zeroForOne) {
    balanceInAfter = await hre.props.token0.balanceOf(signer.address)
    balanceOutAfter = await hre.props.token1.balanceOf(signer.address)
  } else {
    balanceInAfter = await hre.props.token1.balanceOf(signer.address)
    balanceOutAfter = await hre.props.token0.balanceOf(signer.address)
  }

  expect(balanceInBefore.sub(balanceInAfter)).to.be.equal(balanceInDecrease)
  expect(balanceOutAfter.sub(balanceOutBefore)).to.be.equal(balanceOutIncrease)
  expect(balanceInBefore.sub(balanceInAfter)).to.be.equal(inAmount)
  expect(balanceOutAfter.sub(balanceOutBefore)).to.be.equal(outAmount)

  const poolAfter: RangePoolState = (await poolContract.globalState()).pool
  const liquidityAfter = poolAfter.liquidity
  const priceAfter = poolAfter.price

  expect(priceAfter).to.be.equal(priceAfterQuote)
  // check feeGrowth before and after swap

  // expect(liquidityAfter).to.be.equal(finalLiquidity);
  // expect(priceAfter).to.be.equal(finalPrice);
}

export async function validateMint(params: ValidateMintParams): Promise<number> {
  const signer = params.signer
  const recipient = params.recipient
  const lower = BigNumber.from(params.lower)
  const upper = BigNumber.from(params.upper)
  const amount0 = params.amount0
  const amount1 = params.amount1
  const balance0Decrease = params.balance0Decrease
  const balance1Decrease = params.balance1Decrease
  const liquidityIncrease = params.liquidityIncrease
  const revertMessage = params.revertMessage
  const collectRevertMessage = params.collectRevertMessage
  const positionId = params.positionId ? params.positionId : 0
  const poolContract = params.poolContract ?? hre.props.limitPool
  const poolTokenContract = params.poolTokenContract ?? hre.props.limitPoolToken
  const expectedPositionId = params.positionId ? params.positionId
                                               : (await poolContract.globalState()).positionIdNext

  const stake = params.stake ?? false

  let balance0Before
  let balance1Before
  const token0 = await hre.ethers.getContractAt('Token20', await poolContract.token0())
  const token1 = await hre.ethers.getContractAt('Token20', await poolContract.token1())
  balance0Before = await token0.balanceOf(params.signer.address)
  balance1Before = await token1.balanceOf(params.signer.address)
  const approve0Txn = await token0
    .connect(params.signer)
    .approve(hre.props.poolRouter.address, amount0)
  await approve0Txn.wait()
  const approve1Txn = await token1
    .connect(params.signer)
    .approve(hre.props.poolRouter.address, amount1)
  await approve1Txn.wait()

  let lowerTickBefore: RangeTick
  let upperTickBefore: RangeTick
  let positionBefore: Position
  let positionTokens: Contract
  let positionTokenBalanceBefore: BigNumber
  lowerTickBefore = (await poolContract.ticks(lower)).range
  upperTickBefore = (await poolContract.ticks(upper)).range

  positionBefore = await poolContract.positions(positionId)
  positionTokens = await hre.ethers.getContractAt('PositionERC1155', poolTokenContract.address);
  positionTokenBalanceBefore = await positionTokens.balanceOf(stake ? hre.props.rangeStaker.address : signer.address, expectedPositionId);
  // if (params.positionId && !stake)
  //   expect(positionTokenBalanceBefore).to.be.equal(1)
  if (revertMessage == '') {
    const txn = await hre.props.poolRouter
      .connect(params.signer)
      .multiMintRange(
        [poolContract.address],
        [
          {
            to: recipient,
            lower: lower,
            upper: upper,
            positionId: positionId,
            amount0: amount0,
            amount1: amount1,
            callbackData: getMintRangeInputData(stake),
          }
        ], {gasLimit: 3_000_000})
    await txn.wait()
  } else {
    await expect(
      hre.props.poolRouter
      .connect(params.signer)
      .multiMintRange(
        [poolContract.address],
        [
          {
            to: recipient,
            lower: lower,
            upper: upper,
            positionId: positionId,
            amount0: amount0,
            amount1: amount1,
            callbackData: getMintRangeInputData(stake),
          }
        ])
    ).to.be.revertedWith(revertMessage)
    return
  }
  let balance0After
  let balance1After
  balance0After = await token0.balanceOf(params.signer.address)
  balance1After = await token1.balanceOf(params.signer.address)

  expect(balance0Before.sub(balance0After)).to.be.equal(balance0Decrease)
  expect(balance1Before.sub(balance1After)).to.be.equal(balance1Decrease)

  let lowerTickAfter: RangeTick
  let upperTickAfter: RangeTick
  let positionAfter: Position
  let positionTokenBalanceAfter: BigNumber
  lowerTickAfter = (await poolContract.ticks(lower)).range
  upperTickAfter = (await poolContract.ticks(upper)).range

  positionAfter = await poolContract.positions(expectedPositionId)
  positionTokens = await hre.ethers.getContractAt('PositionERC1155', poolTokenContract.address);
  positionTokenBalanceAfter = await positionTokens.balanceOf(stake ? hre.props.rangeStaker.address : signer.address, expectedPositionId);
  if (!params.positionId)
    expect(positionTokenBalanceAfter.sub(positionTokenBalanceBefore)).to.be.equal(BigNumber.from(1))
  expect(lowerTickAfter.liquidityDelta.sub(lowerTickBefore.liquidityDelta)).to.be.equal(
    liquidityIncrease
  )
  expect(upperTickAfter.liquidityDelta.sub(upperTickBefore.liquidityDelta)).to.be.equal(
    BN_ZERO.sub(liquidityIncrease)
  )
  expect(positionAfter.liquidity.sub(positionBefore.liquidity)).to.be.equal(liquidityIncrease)
  if (stake) {
    // check fg0/1 and liquidity match
    const stakeKey = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
      ["address", "uint32"], // encode as address array
      [ poolContract.address, expectedPositionId ]
    ))
    const rangeStake: RangeStake = await hre.props.rangeStaker.rangeStakes(stakeKey)
    expect(positionAfter.feeGrowthInside0Last).to.be.equal(rangeStake.feeGrowthInside0Last)
    expect(positionAfter.feeGrowthInside1Last).to.be.equal(rangeStake.feeGrowthInside1Last)
    expect(positionAfter.liquidity).to.be.equal(rangeStake.liquidity)
    expect(rangeStake.positionId).to.be.equal(expectedPositionId)
    expect(rangeStake.pool).to.be.equal(poolContract.address)
    expect(rangeStake.isStaked).to.be.equal(true)
    expect(rangeStake.owner).to.be.equal(params.recipient)
  }
  return expectedPositionId
}

export async function validateBurn(params: ValidateBurnParams) {
  const signer = params.signer
  const recipient = params.recipient ?? params.signer.address
  const lower = BigNumber.from(params.lower)
  const upper = BigNumber.from(params.upper)
  let liquidityAmount = params.liquidityAmount
  const balance0Increase = params.balance0Increase
  const balance1Increase = params.balance1Increase
  const revertMessage = params.revertMessage
  const poolContract = params.poolContract ?? hre.props.limitPool
  const poolTokenContract = params.poolTokenContract ?? hre.props.limitPoolToken
  const staked = params.staked ?? false

  let balance0Before
  let balance1Before
  const token0 = await hre.ethers.getContractAt('Token20', await poolContract.token0())
  const token1 = await hre.ethers.getContractAt('Token20', await poolContract.token1())
  balance0Before = await token0.balanceOf(signer.address)
  balance1Before = await token1.balanceOf(signer.address)

  let lowerTickBefore: RangeTick
  let upperTickBefore: RangeTick
  let positionBefore: Position
  let positionToken: PositionERC1155
  let positionTokenBalanceBefore: BigNumber
  let positionTokenTotalSupply: BigNumber
  lowerTickBefore = (await poolContract.ticks(lower)).range
  upperTickBefore = (await poolContract.ticks(upper)).range
  // check position token balance
  positionToken = poolTokenContract
  positionTokenBalanceBefore = await positionToken.balanceOf(staked ? hre.props.rangeStaker.address : signer.address, params.positionId);
  positionBefore = await poolContract.positions(params.positionId)
  let burnPercent = params.burnPercent
  let positionSnapshot: [BigNumber, BigNumber, BigNumber, BigNumber]
  if (!burnPercent && positionBefore.liquidity.gt(BN_ZERO)) {
    burnPercent = liquidityAmount
                        .mul(ethers.utils.parseUnits('1', 38))
                        .div(positionBefore.liquidity)
    liquidityAmount = burnPercent
                        .mul(positionBefore.liquidity)
                        .div(ethers.utils.parseUnits('1', 38))
  }
  if (revertMessage == '') {
    positionSnapshot = await poolContract.snapshotRange(params.positionId)
    const burnTxn = !staked ? await poolContract
      .connect(signer)
      .burnRange({
        to: recipient,
        positionId: params.positionId,
        burnPercent: burnPercent ?? BN_ZERO
    }, {gasLimit: 3_000_000})
    : await hre.props.rangeStaker
    .connect(signer)
    .burnRangeStake(
      poolContract.address,
      {
        to: recipient,
        positionId: params.positionId,
        burnPercent: burnPercent
      }
    , {gasLimit: 3_000_000})
    await burnTxn.wait()
  } else {
    await expect(
      !staked ? poolContract.connect(signer).burnRange({
        to: recipient,
        positionId: params.positionId,
        burnPercent: burnPercent ?? BN_ZERO,
      }, {gasLimit: 3_000_000})
    : hre.props.rangeStaker
      .connect(signer)
      .burnRangeStake(
        poolContract.address,
        {
          to: recipient,
          positionId: params.positionId,
          burnPercent: burnPercent ?? BN_ZERO
        }
      , {gasLimit: 3_000_000})
    ).to.be.revertedWith(revertMessage)
    return
  }

  let balance0After
  let balance1After
  balance0After = await token0.balanceOf(signer.address)
  balance1After = await token1.balanceOf(signer.address)

  expect(balance0After.sub(balance0Before)).to.be.equal(balance0Increase)
  expect(balance1After.sub(balance1Before)).to.be.equal(balance1Increase)

  let lowerTickAfter: RangeTick
  let upperTickAfter: RangeTick
  let positionAfter: Position
  let positionTokenBalanceAfter: BigNumber
  lowerTickAfter = (await poolContract.ticks(lower)).range
  upperTickAfter = (await poolContract.ticks(upper)).range
  // check position token balance after
  positionTokenBalanceAfter = await positionToken.balanceOf(staked ? hre.props.rangeStaker.address : signer.address, params.positionId);
  positionAfter = await poolContract.positions(params.positionId)
  if (burnPercent.eq(ethers.utils.parseUnits('1', 38)))
    expect(positionTokenBalanceAfter.sub(positionTokenBalanceBefore)).to.be.equal(-1)
  expect(lowerTickAfter.liquidityDelta.sub(lowerTickBefore.liquidityDelta)).to.be.equal(
    BN_ZERO.sub(liquidityAmount)
  )
  expect(upperTickAfter.liquidityDelta.sub(upperTickBefore.liquidityDelta)).to.be.equal(
    liquidityAmount
  )
  expect(positionAfter.liquidity.sub(positionBefore.liquidity)).to.be.equal(BN_ZERO.sub(liquidityAmount))
}

export async function validateStake(params: ValidateStakeParams) {
  const signer = params.signer
  // let liquidityAmount = params.liquidityAmount
  const balance0Increase = params.balance0Increase ?? BN_ZERO
  const balance1Increase = params.balance1Increase ?? BN_ZERO
  const revertMessage = params.revertMessage
  const poolContract = params.poolContract ?? hre.props.limitPool
  const poolTokenContract = hre.props.limitPoolToken

  let balance0Before
  let balance1Before
  const token0 = await hre.ethers.getContractAt('Token20', await poolContract.token0())
  const token1 = await hre.ethers.getContractAt('Token20', await poolContract.token1())
  balance0Before = await token0.balanceOf(signer.address)
  balance1Before = await token1.balanceOf(signer.address)

  let lowerTickBefore: RangeTick
  let upperTickBefore: RangeTick
  let positionBefore: Position
  let positionToken: PositionERC1155
  let positionTokenBalanceBefore: BigNumber
  let positionTokenTotalSupply: BigNumber
  // check position token balance
  positionToken = poolTokenContract
  positionTokenBalanceBefore = await positionToken.balanceOf(hre.props.rangeStaker.address, params.positionId);
  positionBefore = await poolContract.positions(params.positionId)
  let positionSnapshot: [BigNumber, BigNumber, BigNumber, BigNumber]
  const approveTxn = await poolTokenContract.connect(signer).setApprovalForAll(hre.props.rangeStaker.address, true)
  if (revertMessage == '') {
    positionSnapshot = await poolContract.snapshotRange(params.positionId)
    const unstakeTxn = await hre.props.rangeStaker
      .connect(signer)
      .stakeRange({
        to: params.recipient,
        pool: hre.props.limitPool.address,
        positionId: params.positionId,
    })
    await unstakeTxn.wait()
  } else {
    await expect(
      hre.props.rangeStaker.connect(signer)
      .stakeRange({
        to: params.recipient,
        pool: hre.props.limitPool.address,
        positionId: params.positionId,
    })
    ).to.be.revertedWith(revertMessage)
    return
  }

  let balance0After
  let balance1After
  balance0After = await token0.balanceOf(signer.address)
  balance1After = await token1.balanceOf(signer.address)

  expect(balance0After.sub(balance0Before)).to.be.equal(balance0Increase)
  expect(balance1After.sub(balance1Before)).to.be.equal(balance1Increase)

  let lowerTickAfter: RangeTick
  let upperTickAfter: RangeTick
  let positionAfter: Position
  let positionTokenBalanceAfter: BigNumber
  // check position token balance after
  positionTokenBalanceAfter = await positionToken.balanceOf(hre.props.rangeStaker.address, params.positionId);
  positionAfter = await poolContract.positions(params.positionId)
  expect(positionTokenBalanceAfter.sub(positionTokenBalanceBefore)).to.be.equal(BN_ONE)
}

export async function validateUnstake(params: ValidateUnstakeParams) {
  const signer = params.signer
  // let liquidityAmount = params.liquidityAmount
  const balance0Increase = params.balance0Increase ?? BN_ZERO
  const balance1Increase = params.balance1Increase ?? BN_ZERO
  const revertMessage = params.revertMessage
  const poolContract = params.poolContract ?? hre.props.limitPool
  const poolTokenContract = hre.props.limitPoolToken

  let balance0Before
  let balance1Before
  const token0 = await hre.ethers.getContractAt('Token20', await poolContract.token0())
  const token1 = await hre.ethers.getContractAt('Token20', await poolContract.token1())
  balance0Before = await token0.balanceOf(signer.address)
  balance1Before = await token1.balanceOf(signer.address)

  let lowerTickBefore: RangeTick
  let upperTickBefore: RangeTick
  let positionBefore: Position
  let positionToken: PositionERC1155
  let positionTokenBalanceBefore: BigNumber
  let positionTokenTotalSupply: BigNumber
  // check position token balance
  positionToken = poolTokenContract
  positionTokenBalanceBefore = await positionToken.balanceOf(signer.address, params.positionId);
  positionBefore = await poolContract.positions(params.positionId)
  let positionSnapshot: [BigNumber, BigNumber, BigNumber, BigNumber]

  if (revertMessage == '') {
    // positionSnapshot = await poolContract.snapshotRange(params.positionId)
    const unstakeTxn = await hre.props.rangeStaker
      .connect(signer)
      .unstakeRange({
        to: params.recipient,
        pool: hre.props.limitPool.address,
        positionId: params.positionId
    })
    await unstakeTxn.wait()
  } else {
    await expect(
      hre.props.rangeStaker.connect(signer)
      .unstakeRange({
        to: params.recipient,
        pool: hre.props.limitPool.address,
        positionId: params.positionId
    })
    ).to.be.revertedWith(revertMessage)
    return
  }

  let balance0After
  let balance1After
  balance0After = await token0.balanceOf(signer.address)
  balance1After = await token1.balanceOf(signer.address)

  expect(balance0After.sub(balance0Before)).to.be.equal(balance0Increase)
  expect(balance1After.sub(balance1Before)).to.be.equal(balance1Increase)

  let lowerTickAfter: RangeTick
  let upperTickAfter: RangeTick
  let positionAfter: Position
  let positionTokenBalanceAfter: BigNumber
  // check position token balance after
  positionTokenBalanceAfter = await positionToken.balanceOf(signer.address, params.positionId);
  positionAfter = await poolContract.positions(params.positionId)
  expect(positionTokenBalanceAfter.sub(positionTokenBalanceBefore)).to.be.equal(BN_ONE)
}