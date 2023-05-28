import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { gBefore } from '../../utils/hooks.test'

describe('Ticks Library Tests', function () {
    let token0Amount: BigNumber
    let token1Amount: BigNumber
    let token0Decimals: number
    let token1Decimals: number
    let currentPrice: BigNumber

    let alice: SignerWithAddress
    let bob: SignerWithAddress
    let carol: SignerWithAddress

    //TODO: mint position and burn as if there were 100

    before(async function () {
        await gBefore()
    })

    this.beforeEach(async function () {})

    // it('accumulate() - pool0 - Should not rollover if filled', async function () {
    //     const result = await hre.props.ticksLib.accumulate(
    //         {previousTick: 0, nextTick: 20, swapEpochLast: 1},
    //         {}
    //     )
    //     expect(result[0]).to.be.equal(BigNumber.from("0"));
    //     expect(result[1]).to.be.equal(BigNumber.from("0"));
    // });

    // it('rollover() - pool0 - Should not rollover if filled', async function () {
    //     const result = await hre.props.ticksLib.rollover(
    //         {
    //             nextTickToCross0: "0",
    //             nextTickToAccum0: "0",
    //             stopTick0: "0",
    //             amountInDelta0: "0",
    //             amountOutDelta0: "0",
    //             nextTickToCross1: "0",
    //             nextTickToAccum1: "20",
    //             stopTick1: "20",
    //             amountInDelta1: "0",
    //             amountOutDelta1: "0"
    //         },
    //         {
    //             unlocked: "0",
    //             swapFee: "0",
    //             tickSpread: "0",
    //             twapLength: "0",
    //             latestTick: "0",
    //             genesisBlock: "0",
    //             swapEpoch: "0",
    //             liquidityGlobal: "0",
    //             latestPrice: "0"
    //         },
    //         BigNumber.from("79228162514264337593543950336"),
    //         BigNumber.from("99955008249587388643769"),
    //         true
    //     )
    //     expect(result[0]).to.be.equal(BigNumber.from("0"));
    //     expect(result[1]).to.be.equal(BigNumber.from("0"));
    // });

    // it('rollover() - pool1 - Should not rollover if filled', async function () {
    //     const result = await hre.props.ticksLib.rollover(
    //         BigNumber.from("0"),
    //         BigNumber.from("20"),
    //         BigNumber.from("79228162514264337593543950336"),
    //         BigNumber.from("99955008249587388643769"),
    //         BigNumber.from("0"),
    //         BigNumber.from("0"),
    //         false
    //     )
    //     expect(result[0]).to.be.equal(BigNumber.from("0"));
    //     expect(result[1]).to.be.equal(BigNumber.from("0"));
    // });

    // it('rollover() - pool0 - Should rollover unfilled amounts', async function () {
    //     const result = await hre.props.ticksLib.rollover(
    //         BigNumber.from("20"),
    //         BigNumber.from("0"),
    //         BigNumber.from("79307426338960776842885539845"),
    //         BigNumber.from("99955008249587388643769"),
    //         BigNumber.from("0"),
    //         BigNumber.from("0"),
    //         true
    //     )
    //     expect(result[0]).to.be.equal(BigNumber.from("79263824696439249340797497"));
    //     expect(result[1]).to.be.equal(BigNumber.from("79184604449414017477223073"));
    // });

    // it('rollover() - pool1 - Should rollover unfilled amounts', async function () {
    //     const result = await hre.props.ticksLib.rollover(
    //         BigNumber.from("0"),
    //         BigNumber.from("20"),
    //         BigNumber.from("79228162514264337593543950336"),
    //         BigNumber.from("99955008249587388643769"),
    //         BigNumber.from("0"),
    //         BigNumber.from("0"),
    //         false
    //     )
    //     expect(result[0]).to.be.equal(BigNumber.from("79184604449414017477223073"));
    //     expect(result[1]).to.be.equal(BigNumber.from("79263824696439249340797497"));
    // });

    // it('rollover() - pool1 - Should return 0 if currentLiquidity is 0', async function () {
    //     const result = await hre.props.ticksLib.rollover(
    //         BigNumber.from("0"),
    //         BigNumber.from("20"),
    //         BigNumber.from("79228162514264337593543950336"),
    //         BigNumber.from("0"),
    //         BigNumber.from("0"),
    //         BigNumber.from("0"),
    //         false
    //     )
    //     expect(result[0]).to.be.equal(BigNumber.from("0"));
    //     expect(result[1]).to.be.equal(BigNumber.from("0"));
    // });
})
