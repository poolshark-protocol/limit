import { BigNumber } from 'ethers'
import { BN_ZERO, getLiquidity, getPrice, validateBurn, validateMint, validateSwap, } from '../../../test/utils/contracts/limitpool'
import { InitialSetup } from '../../../test/utils/setup/initialSetup'
import { mintSigners20 } from '../../../test/utils/token'
import { getNonce } from '../../utils'

export class MintPosition {
    private initialSetup: InitialSetup
    private nonce: number

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
        await mintSigners20(hre.props.token0, token0Amount.mul(10), [hre.props.alice])
        await mintSigners20(hre.props.token1, token1Amount.mul(10), [hre.props.alice])

        const liquidityAmount = '199760153929825488153727'

        // await getPrice(true)
    // 0x34e800D1456d87A5F62B774AD98cea54a3A40048
    // 0x1DcF623EDf118E4B21b4C5Dc263bb735E170F9B8
        await validateMint({
            signer: hre.props.alice,
            recipient: hre.props.alice.address,
            lower: '60',
            upper: '100',
            amount: token1Amount,
            zeroForOne: false,
            balanceInDecrease: token1Amount,
            liquidityIncrease: liquidityAmount,
            upperTickCleared: false,
            lowerTickCleared: true,
            revertMessage: '',
        })

        //         await validateSwap({
        // signer: hre.props.alice,
        // recipient: hre.props.alice.address,
        // zeroForOne: true,
        // amountIn: token1Amount.div(10000),
        // priceLimit: BigNumber.from('79228162514264337593543950336'),
        // balanceInDecrease: token1Amount.mul(30),
        // balanceOutIncrease: token1Amount.mul(30),
        // revertMessage:''
        // })

        // await validateBurn({
        //     signer: hre.props.alice,
        //     lower: '60',
        //     claim: '60',
        //     upper: '100',
        //     liquidityPercent: ethers.utils.parseUnits('1', 38),
        //     zeroForOne: false,
        //     balanceInIncrease: BN_ZERO,
        //     balanceOutIncrease: token1Amount.sub(1),
        //     lowerTickCleared: false,
        //     upperTickCleared: false,
        //     revertMessage: '',
        // })

        // await validateSync(60)

        await getPrice(false, true)
        await getLiquidity(false, true)

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
