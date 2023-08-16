import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { sign } from 'crypto';
import { BigNumber } from 'ethers'
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

export const Q64x96 = BigNumber.from('2').pow(96)
export const BN_ZERO = BigNumber.from('0')

export interface RangePosition {
    feeGrowthInside0Last: BigNumber
    feeGrowthInside1Last: BigNumber
    liquidity: BigNumber
    amount0: BigNumber
    amount1: BigNumber
}

export interface LimitPosition {
    amountIn: BigNumber
    amountOut: BigNumber
    liquidity: BigNumber
    epochLast: number
    crossedInto: boolean
}

export interface GlobalState {
    pool: RangePoolState
    pool0: LimitPoolState
    pool1: LimitPoolState
    liquidityGlobal: BigNumber
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
}

export interface SampleState {
    index: number
    length: number
    lengthNext: number
}

export interface LimitPoolState {
    price: BigNumber
    liquidity: BigNumber
    protocolFees: BigNumber
    protocolFee: number
    tickAtPrice: number
}

export interface ProtocolFees {
    token0: BigNumber
    token1: BigNumber
}

export interface PoolState {
    price: BigNumber
    liquidity: BigNumber
    liquidityGlobal: BigNumber
    swapEpoch: number
    tickAtPrice: number
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

export interface LimitTick {
    priceAt: BigNumber
    liquidityDelta: BigNumber
}

export interface ValidateMintParams {
    signer: SignerWithAddress
    recipient: string
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
}

export interface ValidateSwapParams {
    signer: SignerWithAddress
    recipient: string
    zeroForOne: boolean
    amountIn: BigNumber
    priceLimit: BigNumber
    balanceInDecrease: string
    balanceOutIncrease: string
    revertMessage: string
    syncRevertMessage?: string
    splitInto?: number
}

export interface ValidateBurnParams {
    signer: SignerWithAddress
    lower: string
    upper: string
    claim: string
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

export async function getPositionLiquidity(isPool0: boolean, owner: string, lower: number, upper: number, print: boolean = false): Promise<BigNumber> {
    let positionLiquidity: BigNumber = isPool0 ? (await hre.props.limitPool.positions0(owner, lower, upper)).liquidity
                                               : (await hre.props.limitPool.positions1(owner, lower, upper)).liquidity;
    if (print) {
        console.log('position liquidity:', positionLiquidity.toString())
    }
    return positionLiquidity
}

export async function validateSwap(params: ValidateSwapParams) {
    const signer = params.signer
    const recipient = params.recipient
    const zeroForOne = params.zeroForOne
    const amountIn = params.amountIn
    const priceLimit = params.priceLimit
    const balanceInDecrease = BigNumber.from(params.balanceInDecrease)
    const balanceOutIncrease = BigNumber.from(params.balanceOutIncrease)
    const revertMessage = params.revertMessage
    const syncRevertMessage = params.syncRevertMessage
    const splitInto = params.splitInto && params.splitInto > 1 ? params.splitInto : 1

    let balanceInBefore
    let balanceOutBefore
    if (zeroForOne) {
        balanceInBefore = await hre.props.token0.balanceOf(signer.address)
        balanceOutBefore = await hre.props.token1.balanceOf(signer.address)
        await hre.props.token0.connect(signer).approve(hre.props.poolRouter.address, amountIn)
    } else {
        balanceInBefore = await hre.props.token1.balanceOf(signer.address)
        balanceOutBefore = await hre.props.token0.balanceOf(signer.address)
        await hre.props.token1.connect(signer).approve(hre.props.poolRouter.address, amountIn)
    }

    const poolBefore: LimitPoolState = zeroForOne
        ? (await hre.props.limitPool.globalState()).pool1
        : (await hre.props.limitPool.globalState()).pool0
    const liquidityBefore = poolBefore.liquidity
    const priceBefore = poolBefore.price

    // quote pre-swap and validate balance changes match post-swap
    const quote = await hre.props.limitPool.quote({
        priceLimit: priceLimit,
        amount: amountIn,
        zeroForOne: zeroForOne,
        exactIn: true
    })

    const amountInQuoted = quote[0]
    const amountOutQuoted = quote[1]

    if (revertMessage == '') {
        if (splitInto > 1) await ethers.provider.send("evm_setAutomine", [false]);
        for (let i = 0; i < splitInto; i++) {
            let txn = await hre.props.poolRouter
            .connect(signer)
            .multiCall(
            [hre.props.limitPool.address],  
            [{
              to: signer.address,
              zeroForOne: zeroForOne,
              amount: amountIn.div(splitInto),
              priceLimit: priceLimit,
              exactIn: true,
              callbackData: ethers.utils.formatBytes32String('')
            }], {gasLimit: 3000000})
            if (splitInto == 1) await txn.wait()
        }
        if (splitInto > 1){
            await ethers.provider.send('evm_mine')
            await ethers.provider.send("evm_setAutomine", [true])
        } 
    } else {
        await expect(
            hre.props.poolRouter
            .connect(signer)
            .multiCall(
            [hre.props.limitPool.address],  
            [{
              to: signer.address,
              zeroForOne: zeroForOne,
              amount: amountIn,
              priceLimit: priceLimit,
              exactIn: true,
              callbackData: ethers.utils.formatBytes32String('')
            }], {gasLimit: 3000000})
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
    if (splitInto == 1) {
        expect(balanceInBefore.sub(balanceInAfter)).to.be.equal(amountInQuoted)
        expect(balanceOutAfter.sub(balanceOutBefore)).to.be.equal(amountOutQuoted)
    }

    const poolAfter: LimitPoolState = zeroForOne
        ? (await hre.props.limitPool.globalState()).pool1
        : (await hre.props.limitPool.globalState()).pool0
    const liquidityAfter = poolAfter.liquidity
    const priceAfter = poolAfter.price

    // expect(liquidityAfter).to.be.equal(finalLiquidity);
    // expect(priceAfter).to.be.equal(finalPrice);
}

export async function validateMint(params: ValidateMintParams) {
    const signer = params.signer
    const recipient = params.recipient
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

    let balanceInBefore
    let balanceOutBefore
    if (zeroForOne) {
        balanceInBefore = await hre.props.token0.balanceOf(params.signer.address)
        balanceOutBefore = await hre.props.token1.balanceOf(params.signer.address)
        await hre.props.token0
            .connect(params.signer)
            .approve(hre.props.limitPool.address, amountDesired)
    } else {
        balanceInBefore = await hre.props.token1.balanceOf(params.signer.address)
        balanceOutBefore = await hre.props.token0.balanceOf(params.signer.address)
        await hre.props.token1
            .connect(params.signer)
            .approve(hre.props.limitPool.address, amountDesired)
    }

    let lowerTickBefore: LimitTick
    let upperTickBefore: LimitTick
    let positionBefore: LimitPosition
    if (zeroForOne) {
        lowerTickBefore = (await hre.props.limitPool.ticks(expectedLower ? expectedLower : lower)).limit
        upperTickBefore = (await hre.props.limitPool.ticks(expectedUpper ? expectedUpper : upper)).limit
        positionBefore  = await hre.props.limitPool.positions0(
            recipient,
            expectedLower ? expectedLower : lower,
            upper
        )
    } else {
        lowerTickBefore = (await hre.props.limitPool.ticks(expectedLower ? expectedLower : lower)).limit
        upperTickBefore = (await hre.props.limitPool.ticks(expectedUpper ? expectedUpper : upper)).limit
        positionBefore  = await hre.props.limitPool.positions1(
            recipient,
            expectedLower ? expectedLower : lower,
            expectedUpper ? expectedUpper : upper
        )
    }

    if (revertMessage == '') {
        const txn = await hre.props.limitPool
            .connect(params.signer)
            .mintLimit({
                to: recipient,
                amount: amountDesired,
                lower: lower,
                upper: upper,
                zeroForOne: zeroForOne,
                mintPercent: mintPercent
            })
        await txn.wait()
    } else {
        await expect(
            hre.props.limitPool
                .connect(params.signer)
                .mintLimit({
                    to: params.signer.address,
                    lower: lower,
                    upper: upper,
                    amount: amountDesired,
                    zeroForOne: zeroForOne,
                    mintPercent: BN_ZERO
                })
        ).to.be.revertedWith(revertMessage)
        return
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
    if (zeroForOne) {
        lowerTickAfter = (await hre.props.limitPool.ticks(expectedLower ? expectedLower : lower)).limit
        upperTickAfter = (await hre.props.limitPool.ticks(expectedUpper ? expectedUpper : upper)).limit
        positionAfter = await hre.props.limitPool.positions0(
            recipient,
            expectedLower ? expectedLower : lower,
            expectedUpper ? expectedUpper : upper
        )
    } else {
        lowerTickAfter = (await hre.props.limitPool.ticks(expectedLower ? expectedLower : lower)).limit
        upperTickAfter = (await hre.props.limitPool.ticks(expectedUpper ? expectedUpper : upper)).limit
        positionAfter = await hre.props.limitPool.positions1(
            recipient,
            expectedLower ? expectedLower : lower,
            expectedUpper ? expectedUpper : upper
        )
    }

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
}

export async function validateBurn(params: ValidateBurnParams) {
    const signer = params.signer
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
    const compareSnapshot = params.compareSnapshot ? params.compareSnapshot : false

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
    let positionSnapshot: LimitPosition
    if (zeroForOne) {
        lowerTickBefore = (await hre.props.limitPool.ticks(expectedLower ?? lower)).limit
        upperTickBefore = (await hre.props.limitPool.ticks(upper)).limit
        positionBefore = await hre.props.limitPool.positions0(signer.address, lower, upper)
    } else {
        lowerTickBefore = (await hre.props.limitPool.ticks(lower)).limit
        upperTickBefore = (await hre.props.limitPool.ticks(expectedUpper ?? upper)).limit
        positionBefore = await hre.props.limitPool.positions1(signer.address, lower, upper)
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
        // positionSnapshot = await hre.props.limitPool.snapshotLimit({
        //     owner: signer.address,
        //     lower: lower,
        //     claim: claim,
        //     upper: upper,
        //     zeroForOne: zeroForOne,
        //     burnPercent: liquidityPercent
        // })
        const burnTxn = await hre.props.limitPool
            .connect(signer)
            .burnLimit({
                to: signer.address,
                lower: lower,
                claim: claim,
                upper: upper,
                zeroForOne: zeroForOne,
                burnPercent: liquidityPercent,
            })
        await burnTxn.wait()
    } else {
        await expect(
            hre.props.limitPool
                .connect(signer)
                .burnLimit({
                    to: signer.address,
                    lower: lower,
                    claim: claim,
                    upper: upper,
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
        expect(positionSnapshot.amountIn).to.be.equal(balanceInIncrease)
        expect(positionSnapshot.amountOut).to.be.equal(balanceOutIncrease)
    }

    let lowerTickAfter: LimitTick
    let upperTickAfter: LimitTick
    let positionAfter: LimitPosition
    if (zeroForOne) {
        lowerTickAfter = (await hre.props.limitPool.ticks(expectedLower ?? lower)).limit
        upperTickAfter = (await hre.props.limitPool.ticks(upper)).limit
        positionAfter = await hre.props.limitPool.positions0(signer.address, expectedLower ? expectedLower : claim, upper)
        if (expectedPositionLower) {
            positionAfter = await hre.props.limitPool.positions0(signer.address, expectedPositionLower, upper)
        } else {
            positionAfter = await hre.props.limitPool.positions0(signer.address, expectedLower ? expectedLower : claim, upper)
        }
    } else {
        lowerTickAfter = (await hre.props.limitPool.ticks(lower)).limit
        upperTickAfter = (await hre.props.limitPool.ticks(expectedUpper ?? upper)).limit
        if (expectedPositionUpper) {
            positionAfter = await hre.props.limitPool.positions1(signer.address, lower, expectedPositionUpper)
        } else 
            positionAfter = await hre.props.limitPool.positions1(signer.address, lower, expectedUpper ? expectedUpper : claim)
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
}
