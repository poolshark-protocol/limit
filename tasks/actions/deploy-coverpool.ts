import { task } from 'hardhat/config'
import { GetBeforeEach } from '../../test/utils/setup/beforeEachProps'
import { DEPLOY_LIMITPOOL } from '../constants/taskNames'
import { DeployLimitPool } from '../deploy/utils/deployLimitPool'

class DeployLimitPoolTask {
    public deployLimitPool: DeployLimitPool
    public getBeforeEach: GetBeforeEach

    constructor() {
        this.deployLimitPool = new DeployLimitPool()
        this.getBeforeEach = new GetBeforeEach()
        hre.props = this.getBeforeEach.retrieveProps()
    }
}

task(DEPLOY_LIMITPOOL)
    .setDescription('Deploys Cover Pool')
    .setAction(async function ({ ethers }) {
        const deployLimitPool: DeployLimitPoolTask = new DeployLimitPoolTask()

        if (!deployLimitPool.deployLimitPool.canDeploy()) return

        await deployLimitPool.deployLimitPool.preDeployment()

        await deployLimitPool.deployLimitPool.runDeployment()

        await deployLimitPool.deployLimitPool.postDeployment()

        console.log('Li pool deployment complete.\n')
    })
