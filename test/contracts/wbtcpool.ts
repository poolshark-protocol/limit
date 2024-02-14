/* global describe it before ethers */
const hardhat = require('hardhat')
const { expect } = require('chai')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber } from 'ethers'
import { mintSigners20 } from '../utils/token'
import {
    BN_ONE,
    BN_ZERO,
    LimitPoolState,
    getLiquidity,
    getPositionLiquidity,
    validateSwap
} from '../utils/contracts/limitpool'
import {
    validateMint as validateMintRange,
    validateBurn as validateBurnRange,
} from '../utils/contracts/rangepool'
import { gBefore } from '../utils/hooks.test'

alice: SignerWithAddress
describe('WbtcPool Tests', function () {
    let tokenAmount: string
    let tokenAmountBn: BigNumber
    let token0Decimals: number
    let token1Decimals: number
    let minPrice: BigNumber
    let maxPrice: BigNumber

    let alice: SignerWithAddress
    let bob: SignerWithAddress
    let carol: SignerWithAddress

    const liquidityAmount = BigNumber.from('20051041647900280328782')
    const minTickIdx = BigNumber.from('-887272')
    const maxTickIdx = BigNumber.from('887272')

    ////////// DEBUG FLAGS //////////
    let debugMode           = false
    let balanceCheck        = false
    let deltaMaxBeforeCheck = false
    let deltaMaxAfterCheck  = false
    let latestTickCheck     = false

    //every test should clear out all liquidity

    before(async function () {
        await gBefore()
        let currentBlock = await ethers.provider.getBlockNumber()
        const pool0: LimitPoolState = (await hre.props.limitPool.globalState()).pool0
        const liquidity = pool0.liquidity
        const globalState = await hre.props.limitPool.globalState()
        const price = pool0.price

        expect(liquidity).to.be.equal(BN_ZERO)

        minPrice = BigNumber.from('0')
        maxPrice = BigNumber.from('1461501637330902918203684832716283019655932542975')
        token0Decimals = await hre.props.token0.decimals()
        token1Decimals = await hre.props.token1.decimals()
        tokenAmountBn = ethers.utils.parseUnits('100', token0Decimals)
        tokenAmount = ethers.utils.parseUnits('100', token0Decimals).toString()
        alice = hre.props.alice
        bob = hre.props.bob
        carol = hre.props.carol

        await hre.props.weth9.connect(hre.props.alice).deposit({value: ethers.utils.parseEther('1000')});
    })

    this.beforeEach(async function () {
        await mintSigners20(hre.props.token0, tokenAmountBn.mul(10), [hre.props.alice, hre.props.bob])

        await mintSigners20(hre.props.token1, tokenAmountBn.mul(10), [hre.props.alice, hre.props.bob])

        if (debugMode) await getLiquidity(true, true)
        if (debugMode) await getLiquidity(false, true)
    })

    it.only('pool - should try to replicate burnLimit txn', async function () {
        debugMode = true
        const isWethToken0 = hre.props.weth9.address == (await hre.props.wbtcPool.token0())

        //wbtc token0
        //weth token1

        if (isWethToken0 || debugMode) {
            let globalState = await hre.props.wbtcPool.globalState()
            if (debugMode) console.log('wbtc pool start:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())

            const aliceLiquidity = '199296353479'
            // mint should revert
            // "eventName": "MintRange",
            // "txnBlockNumber": "3708581",
            // "txnHash": "0x6396581889b5bafaee82aebc135b914838244a9fb63501441c3a60977bffd8e1"
            const aliceId = await validateMintRange({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                lower: '-201260',
                upper: '-199260',
                amount0: BigNumber.from('228168600673920'),
                amount1: BigNumber.from('412930'),
                balance0Decrease: BigNumber.from('228168600673920'),
                balance1Decrease: BigNumber.from('412930'),
                liquidityIncrease: BigNumber.from(aliceLiquidity),
                revertMessage: '',
                poolContract: hre.props.wbtcPool,
                poolTokenContract: hre.props.wbtcPoolToken
            })

            // globalState = await hre.props.wbtcPool.globalState()
            // console.log('weth pool swap1:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3708737",
            // "txnHash": "0xe030dd93be3786729a5dcf49cf48e35971d3f8361b38b44e1710181a6c25d222"
            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: true,
                amountIn: BigNumber.from('10000000000000'),
                priceLimit: BigNumber.from('3533530660410786729426943'),
                balanceInDecrease: '10000000000000', // only gas is used; all other ETH is returned
                balanceOutIncrease: '19935',
                revertMessage: '',
                poolContract: hre.props.wbtcPool,
                gasUsed: '396087570498016'
            })

            globalState = await hre.props.wbtcPool.globalState()
            if (debugMode) console.log('wbtc pool 2:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())

            // "eventName": "MintRange",
            // "txnBlockNumber": "3708825",
            // "txnHash": "0xc122f92228925070ca78e2bd7bbe410e46ab86c1695e724ec91e65433d8bedfd"
            const aliceId2 = await validateMintRange({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                lower: '-202590',
                upper: '-198120',
                amount0: BigNumber.from('10000000000000'),
                amount1: BigNumber.from('19894'),
                balance0Decrease: BigNumber.from('9999999998857'),
                balance1Decrease: BigNumber.from('19894'),
                liquidityIncrease: BigNumber.from('4218569163'),
                revertMessage: '',
                poolContract: hre.props.wbtcPool,
                poolTokenContract: hre.props.wbtcPoolToken
            })

            // globalState = await hre.props.wbtcPool.globalState()
            // console.log('weth pool swap2:', globalState.pool.price.toString(), globalState.pool.liquidity.toString())

            // "eventName": "Swap",
            // "txnBlockNumber": "3710164",
            // "txnHash": "0x014671ab9283dc1efed4c20f3cf296916cafce6be5afeb0a8b8c26b8b1dbd5b2"
            // [
            //     [
            //         "0xedbc3e195150df6e8681b313be9282757193f527",
            //         "4295128739",
            //         "4000000000000000",
            //         "true",
            //         "true",
            //         "0x0000000000000000000000000000000000000000000000000000000000000000"
            //     ]
            // ]
            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: true,
                amountIn: BigNumber.from('4000000000000000'),
                priceLimit: BigNumber.from('4295128739'),
                balanceInDecrease: '217667149288595', //TODO: set close to acutal ETH value
                balanceOutIncrease: '412453',
                revertMessage: '',
                poolContract: hre.props.wbtcPool,
                gasUsed: '396087570498016'
            })
            //4295558252

            // "eventName": "CollectRange",
            // "txnBlockNumber": "3710681",
            // "txnHash": "0xb3abaf17dddc1faeb665cecab389b7caaaf0bc005b04a85b814f1b92bacdea33"

            await validateBurnRange({
                signer: hre.props.alice,
                positionId: aliceId,
                lower: '-201260',
                upper: '-199260',
                burnPercent: BigNumber.from('0'),
                liquidityAmount: BigNumber.from('0'),
                balance0Increase: BigNumber.from('0'),
                balance1Increase: BigNumber.from('413'),
                revertMessage: '',
                poolContract: hre.props.wbtcPool,
                poolTokenContract: hre.props.wbtcPoolToken,
            })

            // globalState = await hre.props.wbtcPool.globalState()
            // console.log('weth pool swap3 price', globalState.pool.price.toString(), globalState.pool.liquidity.toString())

            // "eventName": "Swap",
            // "txnBlockNumber": "3718056",
            // "txnHash": "0xff530fa67e5d890364970be46c4cb3b06a9c993350e10a414f4a6d8e89316e38"
            //[
//     [
//         "0x185cfafca1f2d364c1acb7d568b0f221623d40ed", // recipient
//         "3163270585662392003198975", // priceLimit
//         "1", // amount
//         "true", // exactIn
//         "false", // zeroForOne
//         "0x0000000000000000000000000000000000000000000000000000000000000000"
//     ]
// ]
            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: false,
                amountIn: BigNumber.from(1),
                priceLimit: BigNumber.from('3163270585662392003198975'),
                balanceInDecrease: '1',
                balanceOutIncrease: '627328368', //TODO: set close to acutal ETH value
                revertMessage: '',
                exactIn: true,
                poolContract: hre.props.wbtcPool,
            })

            // "eventName": "MintRange",
            // "txnBlockNumber": "3726616",
            // "txnHash": "0x4b20686b0197a38715a7bbc0853517b38cf060ceece5098092fe03a06ea47f52"

            const aliceId3 = await validateMintRange({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                lower: '-206650',
                upper: '-198540',
                amount0: BigNumber.from('144100547632765'),
                amount1: BigNumber.from('230000'),
                balance0Decrease: BigNumber.from('144100547628172'),
                balance1Decrease: BigNumber.from('230000'),
                liquidityIncrease: BigNumber.from('31371753518'),
                revertMessage: '',
                poolContract: hre.props.wbtcPool,
                poolTokenContract: hre.props.wbtcPoolToken
            })

            // "eventName": "Swap",
            // "txnBlockNumber": "3733325",
            // "txnHash": "0x430fa312f9f70b2bd7447735e9c7335a0805a41f1d05b0a830519422f6a8600d"
            // [
            //     [
            //         "0x8d4fd78f7e630989ef93ea38c0437235a2c4ff3d",
            //         "4295128739",
            //         "2000000000000000",
            //         "true",
            //         "true",
            //         "0x0000000000000000000000000000000000000000000000000000000000000000"
            //     ]
            // ]

            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: true,
                amountIn: BigNumber.from(2000000000000000),
                priceLimit: BigNumber.from('4295128739'),
                balanceInDecrease: '176935993593373',
                balanceOutIncrease: '229769', //TODO: set close to acutal ETH value
                revertMessage: '',
                exactIn: true,
                poolContract: hre.props.wbtcPool,
            })

            // "eventName": "Swap",
            // "txnBlockNumber": "3743732",
            // "txnHash": "0xf540a682a688ba89547f84b205d6662e97e4e297d4df3468687090d960a1fc04"
            // [
            //     [
            //         "0xb70880e6232bf1057fc38bbd98ca8a9d5cd043ef",
            //         "2694521153432377362481152",
            //         "44510",
            //         "true",
            //         "false",
            //         "0x0000000000000000000000000000000000000000000000000000000000000000"
            //     ]
            // ]
            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: false,
                amountIn: BigNumber.from(44510),
                priceLimit: BigNumber.from('2694521153432377362481152'),
                balanceInDecrease: '44510',
                balanceOutIncrease: '40156359086696', //TODO: set close to acutal ETH value
                revertMessage: '',
                exactIn: true,
                poolContract: hre.props.wbtcPool,
            })

            // "eventName": "Swap",
            // "txnBlockNumber": "3744061",
            // "txnHash": "0xb2a1766ea34e13fd4ae6666b1492b7ed26442789f4ba0bfe167e76d969e0941d"
            // [
            //     [
            //         "0x0bddf4e169c35b77186c6ce1c987408689c4634d",
            //         "4295128739",
            //         "20000000000000000",
            //         "true",
            //         "true",
            //         "0x0000000000000000000000000000000000000000000000000000000000000000"
            //     ]
            // ]
            await validateSwap({
                signer: hre.props.alice,
                recipient: hre.props.alice.address,
                zeroForOne: true,
                amountIn: BigNumber.from('40196555642340'),
                priceLimit: BigNumber.from('4295128739'),
                balanceInDecrease: '40196555642340',
                balanceOutIncrease: '44464',
                revertMessage: '',
                exactIn: true,
                poolContract: hre.props.wbtcPool,
            })
            return
            // "eventName": "MintLimit",
            // "txnBlockNumber": "3744525",
            // "txnHash": "0x5e10629e3d2498c12cd2be3903401b25b96ba7214c1db9f91884a3b51625d88c"
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3744633",
            // "txnHash": "0x62256b80063fe225afb3e793ff0582e1fae7e90f52be4f66fa3edede62f8790a"

            // "eventName": "Swap",
            // "txnBlockNumber": "3744695",
            // "txnHash": "0xed610b8fade9c89cf0bf0bc943aae61a6c9c4f5b01e7c685f664d2b7766d36f2"

            // "eventName": "BurnLimit",
            // "txnBlockNumber": "3745009",
            // "txnHash": "0xfc98ee29ade08d61e4dc4d7114db6ae5c2c17b00b6e4ad3a075c781f5d571f8a"
            
            // "eventName": "MintLimit",
            // "txnBlockNumber": "3745085",
            // "txnHash": "0x46e2b61e7714babda275582069d47376347f89124347634daafa91147b95eef0"

            // "eventName": "Swap",
            // "txnBlockNumber": "3746146",
            // "txnHash": "0xfe7773937ba635b8de514709c6d89ddbfdc00d88c59ed734ef1631c2c8273f1d"

            // "eventName": "Swap",
            // "txnBlockNumber": "3746243",
            // "txnHash": "0xdb62a681833c627f22be5a585a58d1aa056a432fb753842425f9ce3b0dbee240"
                        
            // "eventName": "Swap",
            // "txnBlockNumber": "3747706",
            // "txnHash": "0x07b0d03ae0afc29667e42b15d64e213215d015e09af9140b72bdf04f0f928aab"
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3747809",
            // "txnHash": "0xf14dfebf0a37ee8f2907d952263a1936006af7bb84b278aae6d75a683cf7db58"
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3747830",
            // "txnHash": "0xdee09f647794f7ccfe246d3cc0650ae5a519d240f646355205e8f9929982290b"
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3747835",
            // "txnHash": "0xb4e19ff82cb74ab2a4bffa2bb445bc8e59122ce33222e55b1f2078ed887980b0"
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3747852",
            // "txnHash": "0xa7a56e82b2988f25cea1d178e1eaddadf68ab1149b37c9711bd4d77bddc67dbf"
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3747881",
            // "txnHash": "0x542bf6c759e985328fbadfdc5b89a78fbddc65870919753262e618cebcc8a1f1"
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3747905",
            // "txnHash": "0x470b0f723e48ad484f25b3bccbb2aa265db51e2b2e6e4658dbd65f533ce12c65"
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3748238",
            // "txnHash": "0x52bb346fb1b6f2108e67b674ff6d9c91d660c1f7f812964f711020ba7aebf88d"
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3748269",
            // "txnHash": "0x14d29f5ae810bdb7230bc8a307934baf7dc51af09e8ebef281ab536c43a7b62c"
            
            // "eventName": "MintRange",
            // "txnBlockNumber": "3748666",
            // "txnHash": "0x2c8d403fa2ba20ddf4790a90307534cf79f33b8eb09ce52a041c7e64507a39ef"
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3750166",
            // "txnHash": "0xf4d522af2773fca93665d9243229b5c719d79f53f4174c161a977276516dfcb9"

            // "eventName": "Swap",
            // "txnBlockNumber": "3750167",
            // "txnHash": "0xf44eed135da58a7887bfe6c2700b51d0602196f67f0fd90ea7d842c9d0c38a7b"

            // "eventName": "Swap",
            // "txnBlockNumber": "3750180",
            // "txnHash": "0xc0b33d64dfe678b8d09424e56ab7425fce82f3f0a345b674dbc1a9afeab68dc3"

            // "eventName": "Swap",
            // "txnBlockNumber": "3750181",
            // "txnHash": "0x04bf46eb703f4c149c053d71a9ddb2ff645e79c9b3a1ffaaefc2b6dbb1c007e0"

            // "eventName": "MintRange",
            // "txnBlockNumber": "3750451",
            // "txnHash": "0x6f861fc08ca744e36ff7c162806e3bc7fc3d73b432985ed36fddcd218b227a62"
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3751159",
            // "txnHash": "0x760769361c127db7d6cdee1a01679005b19752d98000eb1193158f0cd0db6e5f"

            // "eventName": "Swap",
            // "txnBlockNumber": "3751329",
            // "txnHash": "0x34ebaaeae09d90c52ac83258d2e93314e5a9a540d8f19d76f1b8fabf641d3f23"

            // "eventName": "MintRange",
            // "txnBlockNumber": "3751899",
            // "txnHash": "0xb195864646fb9838f738c7f29c671aa50d0513743e4dae3b942d357194d227d5"

            // "eventName": "Swap",
            // "txnBlockNumber": "3752319",
            // "txnHash": "0x3b226bf7a386be7d9b7c721e1321b4f815a4786eb3ed261339d9d825f7b3dd33"

            // "eventName": "Swap",
            // "txnBlockNumber": "3752607",
            // "txnHash": "0x918f13f02583ff15da921ce60c8f66e2400960162d05ac9f7dc4283879ac61dd"

            // "eventName": "MintLimit",
            // "txnBlockNumber": "3753626",
            // "txnHash": "0x4ee90348b7521749969fa5456af603cdc131a8dccf5cfbf7c5835e736c8be7ab"

            // "eventName": "MintLimit",
            // "txnBlockNumber": "3753847",
            // "txnHash": "0x17cfb12e6b2f889d51cdfbd02355d3b1a1eddc8b624483252e8c2f726333703b"

            // "eventName": "BurnLimit",
            // "txnBlockNumber": "3753875",
            // "txnHash": "0xeb928f38b7c40d04e2a02d7facb466710ea7dbc76c98eb57054abc4b4d326c0b"

            // "eventName": "Swap",
            // "txnBlockNumber": "3754139",
            // "txnHash": "0x2b958e9726b4cf85f6366a8b58f3e2d661cb8df6be095e809c514ef3dfcfbc62"
            
            // "eventName": "Swap",
            // "txnBlockNumber": "3754463",
            // "txnHash": "0x9d2709c197e9a6e947d551e44af1a4f047dafcf0924ea2a50bda7f12979b4019"

            // "eventName": "Swap",
            // "txnBlockNumber": "3754519",
            // "txnHash": "0x41d6892c4b63fcef79e3b1aae7ca9f757e0691ff1386a82f7e97bd8534f174eb"

            // "eventName": "BurnLimit",
            // "txnBlockNumber": "3755060",
            // "txnHash": "0xfbb5cb41b66be1b5171f7051a73d33068b40cad03c265fe3393ee71094ae5c1c"

            // "eventName": "BurnLimit",
            // "txnBlockNumber": "3756333",
            // "txnHash": "0x3625c2d10cdcd2d915146f82203e9e71294414335698d28593ace27074335890"

            // "eventName": "Swap",
            // "txnBlockNumber": "3757992",
            // "txnHash": "0x53fb10fe62e24cf1a3423cd90fb7c5f69221b5ace009f1dfad8119e8ce32fe64"

            //3760377
            // burnLimit
            // https://explorer.mode.network/tx/0x90b4151fe2f93adca2457cc49fef1285020f75be0314bf08fc64630d4fa9923a
            // globalState = await hre.props.wbtcPool.globalState()
            // console.log('weth pool end price', globalState.pool.price.toString(), globalState.pool.liquidity.toString())

            if (debugMode) await getPositionLiquidity(true, aliceId)
        }
    })
})