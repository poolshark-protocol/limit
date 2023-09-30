import { BigNumber } from 'ethers'
import { BN_ZERO, getLiquidity, getPrice, validateBurn, validateMint, validateSwap, } from '../../../test/utils/contracts/limitpool'
import { InitialSetup } from '../../../test/utils/setup/initialSetup'
import { validateMint as validateMintRange, validateBurn as validateBurnRange } from '../../../test/utils/contracts/rangepool'
import { mintSigners20 } from '../../../test/utils/token'
import { getNonce } from '../../utils'

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
        const token0Amount = ethers.utils.parseUnits('100', await hre.props.token0.decimals())
        const token1Amount = ethers.utils.parseUnits('100', await hre.props.token1.decimals())
        await mintSigners20(hre.props.token0, token0Amount.mul(100000000), [hre.props.alice])
        await mintSigners20(hre.props.token1, token1Amount.mul(100000000), [hre.props.alice])

        const liquidityAmount = '49802891105937278098768'

        // await getPrice(true)
    // 0x65f5B282E024e3d6CaAD112e848dEc3317dB0902
    // 0x1DcF623EDf118E4B21b4C5Dc263bb735E170F9B8
    // 0x9dA9409D17DeA285B078af06206941C049F692Dc
    // 0xBd5db4c7D55C086107f4e9D17c4c34395D1B1E1E
        // await validateMint({
        //     signer: hre.props.alice,
        //     recipient: '0x9dA9409D17DeA285B078af06206941C049F692Dc',
        //     lower: '0',
        //     upper: '100',
        //     amount: token1Amount,
        //     zeroForOne: false,
        //     balanceInDecrease: token1Amount,
        //     liquidityIncrease: liquidityAmount,
        //     upperTickCleared: false,
        //     lowerTickCleared: true,
        //     revertMessage: '',
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

        // console.log('amount quoted:', quote[0][1].toString(), quote[0][2].toString(), quote[0][3].toString())
        // const globalStateBefore = (await hre.props.limitPool.globalState())
        // console.log('sample state', globalStateBefore.pool.samples.index, globalStateBefore.pool.samples.count, globalStateBefore.pool.samples.countMax, globalStateBefore.pool.tickAtPrice)
        // const aliceId = await validateMintRange({
        //     signer: hre.props.alice,
        //     recipient: '0xBd5db4c7D55C086107f4e9D17c4c34395D1B1E1E',
        //     lower: '-887000',
        //     upper: '887000',
        //     amount0: token0Amount.mul(10),
        //     amount1: token1Amount.mul(10),
        //     balance0Decrease: BigNumber.from('624999999999999999'),
        //     balance1Decrease: token1Amount.mul(10).sub(1),
        //     liquidityIncrease: BN_ZERO,
        //     revertMessage: '',
        // })

        // for (let i=0; i < 10; i++) {
        //     const signer = hre.props.alice
        //     const zeroForOne = false
        //     const amountIn = token1Amount.mul(10)
        //     const priceLimit = BigNumber.from('3169126500570573503741758013440')
        //     await hre.props.token1.connect(signer).approve(hre.props.poolRouter.address, amountIn)
        //     let txn = await hre.props.poolRouter
        //     .connect(signer)
        //     .multiSwapSplit(
        //     [hre.props.limitPool.address],
        //         [
        //         {
        //             to: signer.address,
        //             priceLimit: priceLimit,
        //             amount: amountIn,
        //             zeroForOne: zeroForOne,
        //             exactIn: true,
        //             callbackData: ethers.utils.formatBytes32String('')
        //         },
        //         ], {gasLimit: 3000000})
        //     await txn.wait()
        // }

        // const globalStateAfter = (await hre.props.limitPool.globalState())
        // console.log('sample state', globalStateAfter.pool.samples.index, globalStateAfter.pool.samples.count, globalStateAfter.pool.samples.countMax, globalStateAfter.pool.tickAtPrice)

        await validateSwap({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            zeroForOne: false,
            amountIn: token1Amount.div(100),
            priceLimit: BigNumber.from('1461446703485210103287273052203988822378723970342'),
            balanceInDecrease: token1Amount.div(10000),
            balanceOutIncrease: '15641085361593105857',
            revertMessage:'',
        })

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

        console.log('position minted')
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
