import { task } from 'hardhat/config'
import { GetBeforeEach } from '../../test/utils/setup/beforeEachProps'
import { DEPLOY_COVERPOOLS } from '../constants/taskNames'
import { DeployLimitPools } from '../deploy/utils/deployLimitPools'

class DeployLimitPoolsTask {
    public deployLimitPools: DeployLimitPools
    public getBeforeEach: GetBeforeEach

    constructor() {
        this.deployLimitPools = new DeployLimitPools()
        this.getBeforeEach = new GetBeforeEach()
        hre.props = this.getBeforeEach.retrieveProps()
    }
}

task(DEPLOY_COVERPOOLS)
    .setDescription('Deploys Hedge Pools')
    .setAction(async function ({ ethers }) {
        const deployLimitPools: DeployLimitPoolsTask = new DeployLimitPoolsTask()

        if (!deployLimitPools.deployLimitPools.canDeploy()) return

        await deployLimitPools.deployLimitPools.preDeployment()

        await deployLimitPools.deployLimitPools.runDeployment()

        await deployLimitPools.deployLimitPools.postDeployment()

        console.log('Hedge pool deployment complete.\n')
    })
