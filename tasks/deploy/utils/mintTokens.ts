import { InitialSetup } from '../../../test/utils/setup/initialSetup'
import { mintSigners20, mintSigners20WithRecipient } from '../../../test/utils/token'
import { getNonce } from '../../utils'

export class MintTokens {
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
        console.log('running address:', hre.props.alice.address)
        if (hre.network.name == 'hardhat') {
            hre.props.bob = signers[1]
            hre.carol = signers[2]
        }
        hre.nonce = await getNonce(hre, hre.props.alice.address)
        console.log(this.nonce)
        await this.initialSetup.readLimitPoolSetup(this.nonce)
        const token0Amount = ethers.utils.parseUnits('100', await hre.props.token0.decimals())
        const token1Amount = ethers.utils.parseUnits('100', await hre.props.token1.decimals())
            // 0x65f5B282E024e3d6CaAD112e848dEc3317dB0902
    // 0x1DcF623EDf118E4B21b4C5Dc263bb735E170F9B8
    // 0x9dA9409D17DeA285B078af06206941C049F692Dc
    // 0xBd5db4c7D55C086107f4e9D17c4c34395D1B1E1E
        await mintSigners20WithRecipient(hre.props.token0, token0Amount.mul(100), [hre.props.alice], '0x65f5B282E024e3d6CaAD112e848dEc3317dB0902')
        // await mintSigners20WithRecipient(hre.props.token1, token1Amount.mul(100), [hre.props.alice], '0x65f5B282E024e3d6CaAD112e848dEc3317dB0902')

        // const token0Balance = await hre.props.token0.balanceOf(
        //     '0x50924f626d1Ae4813e4a81E2c5589EC3882C13ca'
        // )
        // console.log(
        //     '0x50924f626d1Ae4813e4a81E2c5589EC3882C13ca',
        //     'token 0 balance:',
        //     token0Balance.toString()
        // )
        // const token1Balance = await hre.props.token1.balanceOf(
        //     '0x50924f626d1Ae4813e4a81E2c5589EC3882C13ca'
        // )
        // console.log(
        //     '0x50924f626d1Ae4813e4a81E2c5589EC3882C13ca',
        //     'token 1 balance:',
        //     token1Balance.toString()
        // )
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
