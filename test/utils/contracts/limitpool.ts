import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { sign } from 'crypto';
import { BigNumber, Contract } from 'ethers'
import { LimitPool } from '../../../typechain';
import { gasUsed } from '../blocks';
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

export const Q64x96 = BigNumber.from('2').pow(96)
export const BN_ZERO = BigNumber.from('0')
export const BN_ONE = BigNumber.from('1')
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export interface RangePosition {
    feeGrowthInside0Last: BigNumber
    feeGrowthInside1Last: BigNumber
    liquidity: BigNumber
    amount0: BigNumber
    amount1: BigNumber
}

export interface LimitPosition {
    liquidity: BigNumber
    epochLast: number
    lower: number
    upper: number
    crossedInto: boolean
}

export interface GlobalState {
    pool: RangePoolState
    pool0: LimitPoolState
    pool1: LimitPoolState
    liquidityGlobal: BigNumber
    positionIdNext: number
    epoch: number
    unlocked: number
}

export interface RangePoolState {
    samples: SampleState
    feeGrowthGlobal0: BigNumber
    feeGrowthGlobal1: BigNumber
    secondsPerLiquidityAccum: BigNumber
    price: BigNumber
    liquidity: BigNumber
    tickSecondsAccum: BigNumber
    tickAtPrice: number
    protocolSwapFee0: number
    protocolSwapFee1: number
}

export interface LimitPoolState {
    price: BigNumber
    liquidity: BigNumber
    protocolFees: BigNumber
    protocolFillFee: number
    tickAtPrice: number
}

export interface SampleState {
    index: number
    count: number
    countMax: number
}

export interface Tick {
    range: RangeTick
    limit: LimitTick
}

export interface RangeTick {
    feeGrowthOutside0: BigNumber
    feeGrowthOutside1: BigNumber
    secondsPerLiquidityAccumOutside: BigNumber
    liquidityDelta: BigNumber
    tickSecondsAccumOutside: BigNumber
}

export interface RangeStake {
    pool: string
    owner: string
    feeGrowthInside0Last: BigNumber
    feeGrowthInside1Last: BigNumber
    liquidity: BigNumber
    positionId: number
    isStaked: boolean
}

export interface LimitTick {
    priceAt: BigNumber
    liquidityDelta: BigNumber
}

export interface ValidateMintParams {
    signer: SignerWithAddress
    recipient?: string
    lower: string
    upper: string
    amount: string
    zeroForOne: boolean
    balanceInDecrease: string
    balanceOutIncrease?: string
    liquidityIncrease: string
    positionLiquidityChange?: string
    upperTickCleared: boolean
    upperTickCrossed?: boolean
    lowerTickCleared: boolean
    lowerTickCrossed?: boolean
    revertMessage: string
    collectRevertMessage?: string
    expectedLower?: string
    expectedUpper?: string
    mintPercent?: BigNumber
    positionId?: number
}

export interface ValidateSwapParams {
    signer: SignerWithAddress
    recipient?: string
    zeroForOne: boolean
    amountIn: BigNumber
    priceLimit: BigNumber
    balanceInDecrease: string
    balanceOutIncrease: string
    revertMessage: string
    syncRevertMessage?: string
    splitInto?: number
    nativeIn?: boolean
    nativeOut?: boolean
    poolContract?: LimitPool
    gasUsed?: string
}

export interface ValidateBurnParams {
    signer: SignerWithAddress
    lower: string
    upper: string
    claim: string
    positionId: number
    liquidityAmount?: BigNumber
    liquidityPercent?: BigNumber
    zeroForOne: boolean
    balanceInIncrease: string
    balanceOutIncrease: string
    lowerTickCleared: boolean
    upperTickCleared: boolean
    expectedLower?: string
    expectedUpper?: string
    expectedPositionLower? :string
    expectedPositionUpper?: string
    positionLiquidityChange?: string
    compareSnapshot?: boolean
    recipient?: string
    revertMessage: string
}

export async function getLiquidity(isPool0: boolean, print: boolean = false): Promise<BigNumber> {
    let liquidity: BigNumber = isPool0 ? (await hre.props.limitPool.globalState()).pool0.liquidity
                                       : (await hre.props.limitPool.globalState()).pool1.liquidity;
    if (print) {
        console.log(isPool0 ? 'pool0' : 'pool1', 'liquidity:', liquidity.toString())
    }
    return liquidity
}

export async function getPrice(isPool0: boolean, print: boolean = false): Promise<BigNumber> {
    let pool: LimitPoolState = isPool0 ? (await hre.props.limitPool.globalState()).pool0
                                   : (await hre.props.limitPool.globalState()).pool1;
    let price: BigNumber = pool.price
    let tickAtPrice: number = pool.tickAtPrice
    if (print) {
        console.log('price:', price.toString(), tickAtPrice)
    }
    return price
}

export async function getSwapEpoch(isPool0: boolean, print: boolean = false): Promise<number> {
    let swapEpoch: number = isPool0 ? (await hre.props.limitPool.globalState()).epoch
                                    : (await hre.props.limitPool.globalState()).epoch
    if (print) {
        console.log(isPool0 ? 'pool0' : 'pool1','swap epoch:', swapEpoch)
    }
    return swapEpoch
}

export async function getTickAtPrice(isPool0: boolean, print: boolean = false): Promise<number> {
    let tickAtPrice: number = isPool0 ? (await hre.props.limitPool.globalState()).pool0.tickAtPrice
                                       : (await hre.props.limitPool.globalState()).pool1.tickAtPrice
    if (print) {
        console.log(isPool0 ? 'pool0' : 'pool1','tick at price:', tickAtPrice)
    }
    return tickAtPrice
}

export async function getTick(isPool0: boolean, tickIndex: number, print: boolean = false): Promise<Tick> {
    let tick: Tick = isPool0 ? (await hre.props.limitPool.ticks(tickIndex))
                             : (await hre.props.limitPool.ticks(tickIndex));
    if (print) {
        console.log(tickIndex,'tick:', tick.limit.liquidityDelta.toString(), tick.limit.priceAt.toString())
    }
    return tick
}

export async function getPositionLiquidity(isPool0: boolean, positionId: number, print: boolean = false): Promise<BigNumber> {
    let positionLiquidity: BigNumber = isPool0 ? (await hre.props.limitPool.positions0(positionId)).liquidity
                                               : (await hre.props.limitPool.positions1(positionId)).liquidity;
    if (print) {
        console.log('position liquidity:', positionLiquidity.toString())
    }
    return positionLiquidity
}

export async function validateSwap(params: ValidateSwapParams) {
    const signer = params.signer
    const recipient = params.recipient ?? params.signer.address
    const zeroForOne = params.zeroForOne
    const amountIn = params.amountIn
    const priceLimit = params.priceLimit
    const balanceInDecrease = BigNumber.from(params.balanceInDecrease)
    const balanceOutIncrease = BigNumber.from(params.balanceOutIncrease)
    const revertMessage = params.revertMessage
    const syncRevertMessage = params.syncRevertMessage
    const splitInto = params.splitInto && params.splitInto > 1 ? params.splitInto : 1
    const nativeIn = params.nativeIn ?? false
    const nativeOut = params.nativeOut ?? false
    const poolContract = params.poolContract ?? hre.props.limitPool
    const gasUsed = params.gasUsed ? BigNumber.from(params.gasUsed) : BN_ZERO

    let balanceInBefore
    let balanceOutBefore
    const token0 = await hre.ethers.getContractAt('Token20', await poolContract.token0())
    const token1 = await hre.ethers.getContractAt('Token20', await poolContract.token1())
    if (zeroForOne) {
        balanceInBefore = nativeIn
                                ? await hre.ethers.provider.getBalance(signer.address)
                                : await token0.balanceOf(signer.address)
        balanceOutBefore = nativeOut
                                ? await hre.ethers.provider.getBalance(signer.address)
                                : await token1.balanceOf(signer.address)
        await token0.connect(signer).approve(hre.props.poolRouter.address, amountIn)
    } else {
        balanceInBefore = nativeIn
                                ? await hre.ethers.provider.getBalance(signer.address)
                                : await token1.balanceOf(signer.address)
        balanceOutBefore = nativeOut
                                ? await hre.ethers.provider.getBalance(signer.address)
                                : await token0.balanceOf(signer.address)
        await token1.connect(signer).approve(hre.props.poolRouter.address, amountIn)
    }

    const poolBefore: LimitPoolState = zeroForOne
        ? (await poolContract.globalState()).pool1
        : (await poolContract.globalState()).pool0
    const liquidityBefore = poolBefore.liquidity
    const priceBefore = poolBefore.price

    // quote pre-swap and validate balance changes match post-swap

    let amountInQuoted
    let amountOutQuoted
    let priceAfterQuoted

    let etherUsed = BN_ZERO

    if (revertMessage == '') {
        const poolPrice = zeroForOne ? (await (poolContract.globalState())).pool0.price
                                     : (await (poolContract.globalState())).pool1.price
        // const quote = await hre.props.poolRouter.multiQuote(
        //     [poolContract.address, poolContract.address],
        //     [{
        //         priceLimit: poolPrice,
        //         amount: amountIn,
        //         zeroForOne: zeroForOne,
        //         exactIn: true
        //     },
        //     {
        //         priceLimit: priceLimit,
        //         amount: amountIn,
        //         zeroForOne: zeroForOne,
        //         exactIn: true
        //     },
        //     ],
        //     false
        // )
        // const quote = await hre.props.poolRouter.multiQuote(
        //     [
        //         "0x5c83c95242e7c36a26e50e2de8d95198cab6aabb",
        //         "0x7af8be3e1f0d7de23649e9ad146be3b5433fb4ee",
        //         "0x83e8902a1b28faedc9d09ce1a45671be424efaf3"
        //     ],
        //     [
        //         {
        //             priceLimit: priceLimit,
        //             amount: amountIn,
        //             zeroForOne: zeroForOne,
        //             exactIn: true
        //         },
        //         {
        //             priceLimit: priceLimit,
        //             amount: amountIn,
        //             zeroForOne: zeroForOne,
        //             exactIn: true
        //         },
        //         {
        //             priceLimit: priceLimit,
        //             amount: amountIn,
        //             zeroForOne: zeroForOne,
        //             exactIn: true
        //         }
        //     ],
        //     true
        // )
        const quote = await poolContract.quote({
            priceLimit: priceLimit,
            amount: amountIn,
            zeroForOne: zeroForOne,
            exactIn: true
        })
        if (quote.length > 0) {
            amountInQuoted = quote[0]
            amountOutQuoted = quote[1]
            priceAfterQuoted = quote[2]
        } else {
            amountInQuoted = BN_ZERO
            amountOutQuoted = BN_ZERO
            priceAfterQuoted = poolPrice
        }

        // console.log('quote results', amountInQuoted.toString(), amountOutQuoted.toString(), priceAfterQuoted.toString())

        if (splitInto > 1) await ethers.provider.send("evm_setAutomine", [false]);
        for (let i = 0; i < splitInto; i++) {
            let txn = await hre.props.poolRouter
            .connect(signer)
            .multiSwapSplit(
            [poolContract.address, poolContract.address],
                [{
                    to: recipient,
                    priceLimit: zeroForOne ? (await (poolContract.globalState())).pool0.price
                                           : (await (poolContract.globalState())).pool1.price,
                    amount: amountIn,
                    zeroForOne: zeroForOne,
                    exactIn: true,
                    callbackData: ethers.utils.formatBytes32String('')
                },
                {
                    to: recipient,
                    priceLimit: priceLimit,
                    amount: amountIn,
                    zeroForOne: zeroForOne,
                    exactIn: true,
                    callbackData: ethers.utils.formatBytes32String('')
                },
                ], {gasLimit: 3000000, value: getSwapMsgValue(nativeIn, nativeOut, amountIn)})
            if (splitInto == 1) {
                const receipt = await txn.wait();
            }
        }
        if (splitInto > 1){
            await ethers.provider.send('evm_mine')
            await ethers.provider.send("evm_setAutomine", [true])
        } 
    } else {
        await expect(
            hre.props.poolRouter
            .connect(signer)
            .multiSwapSplit(
            [poolContract.address],  
            [{
              to: recipient,
              zeroForOne: zeroForOne,
              amount: amountIn,
              priceLimit: priceLimit,
              exactIn: true,
              callbackData: ethers.utils.formatBytes32String('')
            }], {gasLimit: 3000000, value: getSwapMsgValue(nativeIn, nativeOut, amountIn)})
        ).to.be.revertedWith(revertMessage)
        return
    }

    let balanceInAfter
    let balanceOutAfter
    if (zeroForOne) {
        balanceInAfter = nativeIn ? (await hre.ethers.provider.getBalance(signer.address))
                                  : await token0.balanceOf(signer.address)
        balanceOutAfter = nativeOut ? await hre.ethers.provider.getBalance(signer.address)
                                    : await token1.balanceOf(signer.address)
    } else {
        balanceInAfter = nativeIn ? (await hre.ethers.provider.getBalance(signer.address))
                                  : await token1.balanceOf(signer.address)
        balanceOutAfter = nativeOut ? await hre.ethers.provider.getBalance(signer.address)
                                    : await token0.balanceOf(signer.address)
    }

    if (!nativeIn) expect(balanceInBefore.sub(balanceInAfter)).to.be.equal(balanceInDecrease)
    if (!nativeOut) expect(balanceOutAfter.sub(balanceOutBefore)).to.be.equal(balanceOutIncrease)
    if (splitInto == 1) {
        if (!nativeIn) expect(balanceInBefore.sub(balanceInAfter)).to.be.equal(amountInQuoted) // gasUsed only if nativeIn
        if (!nativeOut) expect(balanceOutAfter.sub(balanceOutBefore)).to.be.equal(amountOutQuoted)
    }

    const poolAfter: RangePoolState = (await poolContract.globalState()).pool
    const liquidityAfter = poolAfter.liquidity
    const priceAfter = poolAfter.price

    // expect(liquidityAfter).to.be.equal(finalLiquidity);
    // if (zeroForOne ? priceLimit)
    expect(priceAfter).to.be.equal(priceAfterQuoted);
}

export async function validateMint(params: ValidateMintParams): Promise<number> {
    const signer = params.signer
    const recipient = params.recipient ?? params.signer.address
    const lower = BigNumber.from(params.lower)
    const upper = BigNumber.from(params.upper)
    const amountDesired = params.amount
    const zeroForOne = params.zeroForOne
    const balanceInDecrease = BigNumber.from(params.balanceInDecrease)
    const liquidityIncrease = BigNumber.from(params.liquidityIncrease)
    const upperTickCleared = params.upperTickCleared
    const lowerTickCleared = params.lowerTickCleared
    const revertMessage = params.revertMessage
    const collectRevertMessage = params.collectRevertMessage
    const expectedUpper = params.expectedUpper ? BigNumber.from(params.expectedUpper) : null
    const expectedLower = params.expectedLower ? BigNumber.from(params.expectedLower) : null
    const balanceOutIncrease = params.balanceOutIncrease ? BigNumber.from(params.balanceOutIncrease) : BN_ZERO
    const lowerTickCrossed = params.lowerTickCrossed ? params.lowerTickCrossed : false
    const upperTickCrossed = params.upperTickCrossed ? params.upperTickCrossed : false
    const mintPercent = params.mintPercent ? params.mintPercent : BN_ZERO
    const positionId = params.positionId ? params.positionId : 0
    const expectedPositionId = params.positionId ? params.positionId
                                                 : (await hre.props.limitPool.globalState()).positionIdNext

    let balanceInBefore
    let balanceOutBefore
    if (zeroForOne) {
        balanceInBefore = await hre.props.token0.balanceOf(params.signer.address)
        balanceOutBefore = await hre.props.token1.balanceOf(params.signer.address)
        await hre.props.token0
            .connect(params.signer)
            .approve(hre.props.poolRouter.address, amountDesired)
    } else {
        balanceInBefore = await hre.props.token1.balanceOf(params.signer.address)
        balanceOutBefore = await hre.props.token0.balanceOf(params.signer.address)
        await hre.props.token1
            .connect(params.signer)
            .approve(hre.props.poolRouter.address, amountDesired)
    }

    let lowerTickBefore: LimitTick
    let upperTickBefore: LimitTick
    let positionBefore: LimitPosition
    let positionTokens: Contract
    let positionTokenBalanceBefore: BigNumber
    positionTokens = await hre.ethers.getContractAt('PositionERC1155', hre.props.limitPoolToken.address);
    positionTokenBalanceBefore = await positionTokens.balanceOf(signer.address, expectedPositionId);
    let liquidityGlobalBefore = (await hre.props.limitPool.globalState()).liquidityGlobal
    if (zeroForOne) {
        lowerTickBefore = (await hre.props.limitPool.ticks(expectedLower ? expectedLower : lower)).limit
        upperTickBefore = (await hre.props.limitPool.ticks(expectedUpper ? expectedUpper : upper)).limit
        positionBefore  = await hre.props.limitPool.positions0(
            expectedPositionId
        )
    } else {
        lowerTickBefore = (await hre.props.limitPool.ticks(expectedLower ? expectedLower : lower)).limit
        upperTickBefore = (await hre.props.limitPool.ticks(expectedUpper ? expectedUpper : upper)).limit
        positionBefore  = await hre.props.limitPool.positions1(
            expectedPositionId
        )
    }

    if (revertMessage == '') {
        const txn = await hre.props.poolRouter
            .connect(params.signer)
            .multiMintLimit(
                [hre.props.limitPool.address],
                [
                    {
                        to: recipient,
                        amount: amountDesired,
                        positionId: positionId,
                        lower: lower,
                        upper: upper,
                        zeroForOne: zeroForOne,
                        mintPercent: mintPercent,
                        callbackData: ethers.utils.formatBytes32String('')
                    }
                ], {gasLimit: 3000000})
        await txn.wait()
    } else {
        await expect(
            hre.props.limitPool
                .connect(params.signer)
                .mintLimit({
                    to: recipient,
                    positionId: positionId,
                    lower: lower,
                    upper: upper,
                    amount: amountDesired,
                    zeroForOne: zeroForOne,
                    mintPercent: BN_ZERO,
                    callbackData: ethers.utils.formatBytes32String('')
                })
        ).to.be.revertedWith(revertMessage)
        return expectedPositionId
    }
    
    let balanceInAfter
    let balanceOutAfter
    if (zeroForOne) {
        balanceInAfter = await hre.props.token0.balanceOf(params.signer.address)
        balanceOutAfter = await hre.props.token1.balanceOf(params.signer.address)
    } else {
        balanceInAfter = await hre.props.token1.balanceOf(params.signer.address)
        balanceOutAfter = await hre.props.token0.balanceOf(params.signer.address)
    }

    expect(balanceInBefore.sub(balanceInAfter)).to.be.equal(balanceInDecrease)
    expect(balanceOutAfter.sub(balanceOutBefore)).to.be.equal(balanceOutIncrease)

    let lowerTickAfter: LimitTick
    let upperTickAfter: LimitTick
    let positionAfter: LimitPosition
    let positionTokenBalanceAfter: BigNumber
    positionTokens = await hre.ethers.getContractAt('PositionERC1155', hre.props.limitPoolToken.address);
    positionTokenBalanceAfter = await positionTokens.balanceOf(signer.address, expectedPositionId);
    let liquidityGlobalAfter = (await hre.props.limitPool.globalState()).liquidityGlobal
    if (zeroForOne) {
        lowerTickAfter = (await hre.props.limitPool.ticks(expectedLower ? expectedLower : lower)).limit
        upperTickAfter = (await hre.props.limitPool.ticks(expectedUpper ? expectedUpper : upper)).limit
        positionAfter = await hre.props.limitPool.positions0(
            expectedPositionId
        )
    } else {
        lowerTickAfter = (await hre.props.limitPool.ticks(expectedLower ? expectedLower : lower)).limit
        upperTickAfter = (await hre.props.limitPool.ticks(expectedUpper ? expectedUpper : upper)).limit
        positionAfter = await hre.props.limitPool.positions1(
            expectedPositionId
        )
    }
    if (!params.positionId && positionAfter.liquidity.gt(BN_ZERO))
        expect(positionTokenBalanceAfter.sub(positionTokenBalanceBefore)).to.be.equal(BigNumber.from(1))

    if (zeroForOne) {
        //liquidity change for lower should be -liquidityAmount
        if (!upperTickCleared) {
            expect(upperTickAfter.liquidityDelta.sub(upperTickBefore.liquidityDelta)).to.be.equal(
                BN_ZERO.sub(liquidityIncrease)
            )
        } else {
            expect(upperTickAfter.liquidityDelta).to.be.equal(BN_ZERO.sub(liquidityIncrease))
        }
        if (!lowerTickCleared) {
            expect(lowerTickAfter.liquidityDelta.sub(lowerTickBefore.liquidityDelta)).to.be.equal(
               liquidityIncrease
            )
        } else {
            if (lowerTickCrossed) expect(lowerTickAfter.liquidityDelta).to.be.equal(BN_ZERO)
            else expect(lowerTickAfter.liquidityDelta.sub(lowerTickBefore.liquidityDelta)).to.be.equal(BN_ZERO)
        }
    } else {
        if (!lowerTickCleared) {
            expect(lowerTickAfter.liquidityDelta.sub(lowerTickBefore.liquidityDelta)).to.be.equal(
                BN_ZERO.sub(liquidityIncrease)
            )
        } else {
            expect(lowerTickAfter.liquidityDelta).to.be.equal(BN_ZERO.sub(liquidityIncrease))
        }
        if (!upperTickCleared) {
            expect(upperTickAfter.liquidityDelta.sub(upperTickBefore.liquidityDelta)).to.be.equal(
                liquidityIncrease
            )
        } else {
            if (upperTickCrossed)
                expect(upperTickAfter.liquidityDelta).to.be.equal(BN_ZERO)
            else
                expect(upperTickAfter.liquidityDelta.sub(upperTickBefore.liquidityDelta)).to.be.equal(BN_ZERO)
        }
    }
    const positionLiquidityChange = params.positionLiquidityChange ? BigNumber.from(params.positionLiquidityChange) : liquidityIncrease
    expect(positionAfter.liquidity.sub(positionBefore.liquidity)).to.be.equal(positionLiquidityChange)
    expect(liquidityGlobalAfter.sub(liquidityGlobalBefore)).to.be.equal(positionLiquidityChange)
    return expectedPositionId
}

export async function validateBurn(params: ValidateBurnParams) {
    const signer = params.signer
    const recipient = params.recipient ?? params.signer.address
    const lower = BigNumber.from(params.lower)
    const upper = BigNumber.from(params.upper)
    const claim = BigNumber.from(params.claim)
    let liquidityAmount = params.liquidityAmount ? params.liquidityAmount : null
    let liquidityPercent = params.liquidityPercent ? params.liquidityPercent : null
    const zeroForOne = params.zeroForOne
    const balanceInIncrease = BigNumber.from(params.balanceInIncrease)
    const balanceOutIncrease = BigNumber.from(params.balanceOutIncrease)
    const upperTickCleared = params.upperTickCleared
    const lowerTickCleared = params.lowerTickCleared
    const revertMessage = params.revertMessage
    const expectedUpper = params.expectedUpper ? BigNumber.from(params.expectedUpper) : null
    const expectedLower = params.expectedLower ? BigNumber.from(params.expectedLower) : null
    const expectedPositionLower = params.expectedPositionLower ? BigNumber.from(params.expectedPositionLower) : null
    const expectedPositionUpper = params.expectedPositionUpper ? BigNumber.from(params.expectedPositionUpper) : null
    const compareSnapshot = params.compareSnapshot ? params.compareSnapshot : true

    let balanceInBefore
    let balanceOutBefore
    if (zeroForOne) {
        balanceInBefore = await hre.props.token1.balanceOf(signer.address)
        balanceOutBefore = await hre.props.token0.balanceOf(signer.address)
    } else {
        balanceInBefore = await hre.props.token0.balanceOf(signer.address)
        balanceOutBefore = await hre.props.token1.balanceOf(signer.address)
    }

    let lowerTickBefore: LimitTick
    let upperTickBefore: LimitTick
    let positionBefore: LimitPosition
    let positionSnapshots: [BigNumber[], BigNumber[]]
    let positionTokens: Contract
    let positionTokenBalanceBefore: BigNumber
    positionTokens = await hre.ethers.getContractAt('PositionERC1155', hre.props.limitPoolToken.address);
    positionTokenBalanceBefore = await positionTokens.balanceOf(signer.address, params.positionId);
    let liquidityGlobalBefore = (await hre.props.limitPool.globalState()).liquidityGlobal
    if (zeroForOne) {
        lowerTickBefore = (await hre.props.limitPool.ticks(expectedLower ?? lower)).limit
        upperTickBefore = (await hre.props.limitPool.ticks(upper)).limit
        positionBefore = await hre.props.limitPool.positions0(params.positionId)
    } else {
        lowerTickBefore = (await hre.props.limitPool.ticks(lower)).limit
        upperTickBefore = (await hre.props.limitPool.ticks(expectedUpper ?? upper)).limit
        positionBefore = await hre.props.limitPool.positions1(params.positionId)
    }
    if (liquidityAmount) {
        if (positionBefore.liquidity.gt(BN_ZERO)) {
            liquidityPercent = liquidityAmount.mul(ethers.utils.parseUnits("1",38)).div(positionBefore.liquidity)
            liquidityAmount = liquidityPercent.mul(positionBefore.liquidity).div(ethers.utils.parseUnits("1",38))
        }
        else if (liquidityAmount.gt(BN_ZERO))
            liquidityPercent = ethers.utils.parseUnits("1", 38);
        else
            liquidityPercent = BN_ZERO
    } else {
        liquidityAmount = liquidityPercent.mul(positionBefore.liquidity).div(ethers.utils.parseUnits("1",38))
    }
    if (revertMessage == '') {
        positionSnapshots = await hre.props.poolRouter.multiSnapshotLimit(
        [hre.props.limitPool.address],
        [    
            {
                owner: signer.address,
                positionId: params.positionId,
                claim: claim,
                zeroForOne: zeroForOne,
                burnPercent: liquidityPercent
            }
        ])
        const burnTxn = await hre.props.limitPool
            .connect(signer)
            .burnLimit({
                to: recipient,
                positionId: params.positionId,
                claim: claim,
                zeroForOne: zeroForOne,
                burnPercent: liquidityPercent,
            }, {gasLimit: 3_000_000})
        await burnTxn.wait()
    } else {
        await expect(
            hre.props.limitPool
                .connect(signer)
                .burnLimit({
                    to: recipient,
                    positionId: params.positionId,
                    claim: claim,
                    zeroForOne: zeroForOne,
                    burnPercent: liquidityPercent,
                })
        ).to.be.revertedWith(revertMessage)
        return
    }

    let balanceInAfter
    let balanceOutAfter
    if (zeroForOne) {
        balanceInAfter = await hre.props.token1.balanceOf(signer.address)
        balanceOutAfter = await hre.props.token0.balanceOf(signer.address)
    } else {
        balanceInAfter = await hre.props.token0.balanceOf(signer.address)
        balanceOutAfter = await hre.props.token1.balanceOf(signer.address)
    }

    expect(balanceInAfter.sub(balanceInBefore)).to.be.equal(balanceInIncrease)
    expect(balanceOutAfter.sub(balanceOutBefore)).to.be.equal(balanceOutIncrease)

    if (compareSnapshot) {
        expect(positionSnapshots[0][0]).to.be.equal(balanceInIncrease)
        expect(positionSnapshots[1][0]).to.be.equal(balanceOutIncrease)
    }

    let lowerTickAfter: LimitTick
    let upperTickAfter: LimitTick
    let positionAfter: LimitPosition
    let positionTokenBalanceAfter: BigNumber
    positionTokens = await hre.ethers.getContractAt('PositionERC1155', hre.props.limitPoolToken.address);
    positionTokenBalanceAfter = await positionTokens.balanceOf(signer.address, params.positionId);
    let liquidityGlobalAfter = (await hre.props.limitPool.globalState()).liquidityGlobal
    if (zeroForOne) {
        lowerTickAfter = (await hre.props.limitPool.ticks(expectedLower ?? lower)).limit
        upperTickAfter = (await hre.props.limitPool.ticks(upper)).limit
        positionAfter = await hre.props.limitPool.positions0(params.positionId)
        if (positionAfter.liquidity.gt(BN_ZERO)) {
            if (expectedPositionLower) {
                expect(positionAfter.lower).to.be.equal(expectedPositionLower)
            } else {
                expect(positionAfter.lower).to.be.equal(expectedLower ? expectedLower : claim)
            }
            expect(positionAfter.upper).to.be.equal(upper)
        }
    } else {
        lowerTickAfter = (await hre.props.limitPool.ticks(lower)).limit
        upperTickAfter = (await hre.props.limitPool.ticks(expectedUpper ?? upper)).limit
        positionAfter = await hre.props.limitPool.positions1(params.positionId)
        if (positionAfter.liquidity.gt(BN_ZERO)) {
            if (expectedPositionUpper) {
                expect(positionAfter.upper).to.be.equal(expectedPositionUpper)
            } else {
                expect(positionAfter.upper).to.be.equal(expectedUpper ? expectedUpper : claim)   
            }
            expect(positionAfter.lower).to.be.equal(lower)
        } else {
            expect(positionAfter.lower).to.be.equal(0)
            expect(positionAfter.upper).to.be.equal(0)
        }
    }
    if (positionAfter.liquidity.eq(BN_ZERO)) {
        expect(positionTokenBalanceAfter.sub(positionTokenBalanceBefore)).to.be.equal(-1)
    }
    //dependent on zeroForOne
    if (zeroForOne) {
        if (!upperTickCleared) {
            expect(upperTickAfter.liquidityDelta.sub(upperTickBefore.liquidityDelta)).to.be.equal(
                liquidityAmount
            )
        } else {
            expect(upperTickAfter.liquidityDelta.sub(upperTickBefore.liquidityDelta)).to.be.equal(
                BN_ZERO
            )
        }
        if (!lowerTickCleared) {
            expect(lowerTickAfter.liquidityDelta.sub(lowerTickBefore.liquidityDelta)).to.be.equal(
                BN_ZERO.sub(liquidityAmount)
            )
        } else {
            expect(lowerTickAfter.liquidityDelta.sub(lowerTickBefore.liquidityDelta)).to.be.equal(
                BN_ZERO
            )
        }
    } else {
        //liquidity change for lower should be -liquidityAmount
        if (!lowerTickCleared) {
            expect(lowerTickAfter.liquidityDelta.sub(lowerTickBefore.liquidityDelta)).to.be.equal(
                liquidityAmount
            )
        } else {
            expect(lowerTickAfter.liquidityDelta.sub(lowerTickBefore.liquidityDelta)).to.be.equal(
                BN_ZERO
            )
        }
        if (!upperTickCleared) {
            expect(upperTickAfter.liquidityDelta.sub(upperTickBefore.liquidityDelta)).to.be.equal(
                BN_ZERO.sub(liquidityAmount)
            )
        } else {
            expect(upperTickAfter.liquidityDelta.sub(upperTickBefore.liquidityDelta)).to.be.equal(
                BN_ZERO
            )
        }
    }
    const positionLiquidityChange = params.positionLiquidityChange ? BigNumber.from(params.positionLiquidityChange) : liquidityAmount
    expect(positionAfter.liquidity.sub(positionBefore.liquidity)).to.be.equal(
        BN_ZERO.sub(positionLiquidityChange)
    )
    expect(liquidityGlobalAfter.sub(liquidityGlobalBefore)).to.be.equal(BN_ZERO.sub(positionLiquidityChange))
}

export function getSwapMsgValue(nativeIn: boolean, nativeOut: boolean, amountIn: BigNumber): BigNumber {
    if (nativeIn) {
        return amountIn
    } else if (nativeOut) {
        return BN_ONE
    } else {
        return BN_ZERO
    }
}
