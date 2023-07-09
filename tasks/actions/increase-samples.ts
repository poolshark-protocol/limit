import { task } from 'hardhat/config'
import { GetBeforeEach } from '../../test/utils/setup/beforeEachProps'
import { INCREASE_SAMPLES } from '../constants/taskNames'
import { IncreaseSamples } from '../deploy/utils/increaseSamples'

class IncreaseSamplesTask {
    public deployLimitPools: IncreaseSamples
    public getBeforeEach: GetBeforeEach

    constructor() {
        this.deployLimitPools = new IncreaseSamples()
        this.getBeforeEach = new GetBeforeEach()
        hre.props = this.getBeforeEach.retrieveProps()
    }
}

task(INCREASE_SAMPLES)
    .setDescription('Increase Twap Sample Length on Mock Pool')
    .setAction(async function ({ ethers }) {
        const deployLimitPools: IncreaseSamplesTask = new IncreaseSamplesTask()

        if (!deployLimitPools.deployLimitPools.canDeploy()) return

        await deployLimitPools.deployLimitPools.preDeployment()

        await deployLimitPools.deployLimitPools.runDeployment()

        await deployLimitPools.deployLimitPools.postDeployment()

        console.log('Hedge pool deployment complete.\n')
    })
