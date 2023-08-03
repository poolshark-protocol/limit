import { task } from 'hardhat/config'
import { GetBeforeEach } from '../../test/utils/setup/beforeEachProps'
import { DEPLOY_LIMITPOOLS, VERIFY_CONTRACTS } from '../constants/taskNames'
import { VerifyContracts } from './utils/verifyContracts'

class VerifyContractsTask {
    public deployLimitPools: VerifyContracts
    public getBeforeEach: GetBeforeEach

    constructor() {
        this.deployLimitPools = new VerifyContracts()
        this.getBeforeEach = new GetBeforeEach()
        hre.props = this.getBeforeEach.retrieveProps()
    }
}

task(VERIFY_CONTRACTS)
    .setDescription('Verifies all contracts')
    .setAction(async function ({ ethers }) {
        const deployLimitPools: VerifyContractsTask = new VerifyContractsTask()

        if (!deployLimitPools.deployLimitPools.canDeploy()) return

        await deployLimitPools.deployLimitPools.preDeployment()

        await deployLimitPools.deployLimitPools.runDeployment()

        await deployLimitPools.deployLimitPools.postDeployment()

        console.log('Contract verification complete.\n')
    })
