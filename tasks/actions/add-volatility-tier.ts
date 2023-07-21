import { task } from 'hardhat/config'
import { GetBeforeEach } from '../../test/utils/setup/beforeEachProps'
import { ADD_VOLATILITY_TIER, INCREASE_SAMPLES } from '../constants/taskNames'
import { AddVolatilityTier } from '../deploy/utils/addVolatilityTier'

class AddVolatilityTierTask {
    public addVolatilityTier: AddVolatilityTier
    public getBeforeEach: GetBeforeEach

    constructor() {
        this.addVolatilityTier = new AddVolatilityTier()
        this.getBeforeEach = new GetBeforeEach()
        hre.props = this.getBeforeEach.retrieveProps()
    }
}

task(ADD_VOLATILITY_TIER)
    .setDescription('Add Volatility Tier to Manager Contract')
    .setAction(async function ({ ethers }) {
        const addVolatilityTier: AddVolatilityTierTask = new AddVolatilityTierTask()

        if (!addVolatilityTier.addVolatilityTier.canDeploy()) return

        await addVolatilityTier.addVolatilityTier.preDeployment()

        await addVolatilityTier.addVolatilityTier.runDeployment()

        await addVolatilityTier.addVolatilityTier.postDeployment()

        console.log('Hedge pool deployment complete.\n')
    })
