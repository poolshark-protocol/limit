import { expect } from "chai"
import { BigNumber, Contract } from "ethers"
import { BN_ZERO, Position, ValidateMintParams } from "./rangepool"
import { RangeTick, RangeStake, GlobalState } from "./limitpool"

export function getMintRangeInputData(stake: boolean): any {
    if (stake)
        return ethers.utils.defaultAbiCoder.encode(
            [
                {
                    components: [
                        {
                            internalType: "address",
                            name: "staker",
                            type: "address",
                        },
                    ],
                    name: "params",
                    type: "tuple",
                }
            ],
            [
                {
                    staker: hre.props.rangeStaker.address
                }
            ]
        )
    else
        return ethers.utils.formatBytes32String('')
}

export async function validateDeployTge(params: ValidateMintParams): Promise<number> {
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
        .deployTge(poolContract.address, hre.props.rangeStaker.address)
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

    let globalStateAfter: GlobalState = await poolContract.globalState();
    expect(globalStateAfter.pool.price).to.be.equal(BigNumber.from('2172618421097231267834892073346'))
  
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