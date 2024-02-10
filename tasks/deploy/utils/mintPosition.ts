import { BigNumber } from 'ethers'
import { BN_ZERO, } from '../../../test/utils/contracts/limitpool'
import { InitialSetup } from '../../../test/utils/setup/initialSetup'
import { getNonce } from '../../utils'
import { parseUnits } from 'ethers/lib/utils'
import { mintSigners20 } from '../../../test/utils/token'

export class MintPosition {
    private initialSetup: InitialSetup
    private nonce: number
    private minPrice: BigNumber = BN_ZERO
    private maxPrice: BigNumber = BigNumber.from('1461501637330902918203684832716283019655932542975')

    constructor() {
        this.initialSetup = new InitialSetup()
    }

    public async preDeployment() {
        //clear out deployments json file for this network
    }

    public async runDeployment() {
        const signers = await ethers.getSigners()
        hre.props.alice = signers[0]
        console.log(hre.network.name)
        if (hre.network.name == 'hardhat') {
            hre.props.bob = signers[1]
            hre.carol = signers[2]
        }
        hre.nonce = await getNonce(hre, hre.props.alice.address)
        console.log(this.nonce)
        await this.initialSetup.readLimitPoolSetup(this.nonce)
        console.log('read positions')

        const token0Amount = ethers.utils.parseUnits('1000', 18)
        console.log('mint tokens', hre.props.alice.address)
        // await mintSigners20(hre.props.token0, token0Amount.mul(10000), [hre.props.alice])
        // await mintSigners20(hre.props.token1, token0Amount, [hre.props.alice])
        // console.log('minted tokens')
        const liquidityAmount = '49802891105937278098768'

        // await getPrice(true)
    // 0x65f5B282E024e3d6CaAD112e848dEc3317dB0902
    // 0x1DcF623EDf118E4B21b4C5Dc263bb735E170F9B8
    // 0x9dA9409D17DeA285B078af06206941C049F692Dc
    // 0xBd5db4c7D55C086107f4e9D17c4c34395D1B1E1E
        // await validateMint({
        //     signer: hre.props.alice,
        //     recipient: '0x1DcF623EDf118E4B21b4C5Dc263bb735E170F9B8',
        //     lower: '-100',
        //     upper: '0',
        //     amount: token1Amount,
        //     zeroForOne: false,
        //     balanceInDecrease: token1Amount,
        //     liquidityIncrease: liquidityAmount,
        //     upperTickCleared: false,
        //     lowerTickCleared: true,
        //     revertMessage: '',
        //     positionId: 6
        // })

        // const quote = await hre.props.poolRouter.multiQuote(
        //     [hre.props.limitPool.address],
        //     [
        //         {
        //             priceLimit: BigNumber.from('3543191142285914205922034323214'),
        //             amount: ethers.utils.parseUnits('1600', 18),
        //             exactIn: true,
        //             zeroForOne: false
        //         }
        //     ],
        //     true
        // )

        // let txn = await hre.props.limitPool.connect(hre.props.alice).increaseSampleCount(60)
        // await txn.wait()

        // console.log('amount quoted:', quote[0][1].toString(), quote[0][2].toString(), quote[0][3].toString())
        // const globalStateBefore = (await hre.props.limitPool.globalState())
        // console.log('sample state', globalStateBefore.pool.price, globalStateBefore.pool.samples.index, globalStateBefore.pool.samples.count, globalStateBefore.pool.samples.countMax, globalStateBefore.pool.tickAtPrice)

        // const snapshot = await hre.props.limitPool.connect(hre.props.alice).snapshotRange(
        //     31
        // )

        // console.log('position snapshot', snapshot.feesOwed0.toString(), snapshot.feesOwed1.toString())
        const amountIn = parseUnits('100', 18)
        const signer = hre.props.alice
        // let approveTxn = await hre.props.token0.connect(signer).approve(hre.props.poolRouter.address, amountIn)
        console.log('approve tokens')
        let approveTxn = await hre.props.token1.connect(signer).approve(hre.props.poolRouter.address, amountIn)
        await approveTxn.wait()
        // const aliceId = await validateMintRange({
        //     signer: hre.props.alice,
        //     recipient: hre.props.alice.address,
        //     lower: '-200200',
        //     upper: '-200000',
        //     amount0: BN_ZERO,
        //     amount1: amountIn,
        //     balance0Decrease: BN_ZERO,
        //     balance1Decrease: amountIn,
        //     liquidityIncrease: BN_ZERO,
        //     revertMessage: '',
        // })
        // return
        // const token0Amount = ethers.utils.parseUnits('1', 16)

        // const amountIn = token0Amount

        // // // for (let i=0; i < 20; i++) {

        // 0 => 1 
        //0xe80dc9a69853483c745f8e32162f0bd5813c    b291 => new factory

            const zeroForOne = false

            const priceLimit = BigNumber.from('1644512651807278503717224857536888')
            console.log('before swap')
            let txn = await hre.props.poolRouter
            .connect(signer)
            .multiSwapSplit(
            ['0x50456024eEd7921FC69298a8B742598bAd35582a'], 
            {
                to: signer.address,
                priceLimit: priceLimit,
                amount: amountIn,
                zeroForOne: zeroForOne,
                exactIn: true,
                callbackData: ethers.utils.formatBytes32String('')
            },
            )
            await txn.wait()
        // }

        // return

        // const globalStateAfter = (await hre.props.limitPool.globalState())
        // console.log('sample state', globalStateAfter.pool.samples.index, globalStateAfter.pool.samples.count, globalStateAfter.pool.samples.countMax, globalStateAfter.pool.tickAtPrice)

        // await validateSwap({
        //     signer: hre.props.alice,
        //     recipient: hre.props.alice.address,
        //     zeroForOne: false,
        //     amountIn: token1Amount.mul(100),
        //     priceLimit: BigNumber.from('3256300000000000000000000'),
        //     balanceInDecrease: token1Amount.mul(10000),
        //     balanceOutIncrease: '15641085361593105857',
        //     revertMessage:'',
        // })

        // await validateBurn({
        //     signer: hre.props.alice,
        //     lower: '73800',
        //     claim: '73800',
        //     upper: '73830',
        //     positionId: 4,
        //     liquidityPercent: ethers.utils.parseUnits('1', 38),
        //     zeroForOne: true,
        //     balanceInIncrease: '0',
        //     balanceOutIncrease: token1Amount.sub(1),
        //     lowerTickCleared: false,
        //     upperTickCleared: false,
        //     revertMessage: '',
        // })

        // await validateBurnRange({
        //     signer: hre.props.alice,
        //     lower: '20',
        //     upper: '60',
        //     positionId: 7,
        //     burnPercent: ethers.utils.parseUnits('1', 38),
        //     liquidityAmount: BN_ZERO,
        //     balance0Increase: token1Amount.div(10).sub(1),
        //     balance1Increase: BigNumber.from('89946873348418057510'),
        //     revertMessage: '',
        //   })

        // await validateSync(60)

        // await getPrice(false, true)
        // await getLiquidity(false, true)

        // console.log('position minted')
    }

    public async postDeployment() {}

    public canDeploy(): boolean {
        let canDeploy = true

        if (!hre.network.name) {
            console.log('❌ ERROR: No network name present.')
            canDeploy = false
        }

        return canDeploy
    }
}
