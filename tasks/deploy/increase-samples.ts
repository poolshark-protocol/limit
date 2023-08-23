import { task } from 'hardhat/config'
import { GetBeforeEach } from '../../test/utils/setup/beforeEachProps'
import { INCREASE_SAMPLES } from '../constants/taskNames'
import { IncreaseSamples } from './utils/increaseSamples'

class IncreaseSamplesTask {
    public increaseSamples: IncreaseSamples
    public getBeforeEach: GetBeforeEach

    constructor() {
        this.increaseSamples = new IncreaseSamples()
        this.getBeforeEach = new GetBeforeEach()
        hre.props = this.getBeforeEach.retrieveProps()
    }
}

task(INCREASE_SAMPLES)
    .setDescription('Increase TWAP Samples')
    .setAction(async function ({ ethers }) {
        const increaseSamples: IncreaseSamplesTask = new IncreaseSamplesTask()

        if (!increaseSamples.increaseSamples.canDeploy()) return

        await increaseSamples.increaseSamples.preDeployment()

        await increaseSamples.increaseSamples.runDeployment()

        await increaseSamples.increaseSamples.postDeployment()

        console.log('Limit pool deployment complete.\n')
    })
