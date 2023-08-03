import { SUPPORTED_NETWORKS } from './scripts/constants/supportedNetworks'
import {
    DEPLOY_LIMITPOOL,
    DEPLOY_LIMITPOOLS,
    INCREASE_SAMPLES,
    MINT_POSITION,
    MINT_TOKENS,
    VERIFY_CONTRACTS,
} from './tasks/constants/taskNames'
import { purpleLog } from './test/utils/colors'

export function handleHardhatTasks() {
    handleLimitPoolTasks()
}

function handleLimitPoolTasks() {
    // for (const network in SUPPORTED_NETWORKS) {
    //     if (Object.keys(LOCAL_NETWORKS).includes(network)) continue;
    //     hre.masterNetwork = MASTER_NETWORKS[network];
    //     break;
    // }
    if (process.argv.includes(DEPLOY_LIMITPOOLS)) {
        import('./tasks/deploy/deploy-limitpools')
        logTask(DEPLOY_LIMITPOOLS)
    } else if (process.argv.includes(DEPLOY_LIMITPOOL)) {
        import('./tasks/deploy/deploy-limitpool')
        logTask(DEPLOY_LIMITPOOL)
    } else if (process.argv.includes(INCREASE_SAMPLES)) {
        import('./tasks/deploy/increase-samples')
        logTask(INCREASE_SAMPLES)
    } else if (process.argv.includes(MINT_TOKENS)) {
        import('./tasks/deploy/mint-tokens')
        logTask(MINT_TOKENS)
    } else if (process.argv.includes(MINT_POSITION)) {
        import('./tasks/deploy/mint-position')
        logTask(MINT_POSITION)
    } else if (process.argv.includes(VERIFY_CONTRACTS)) {
        import('./tasks/deploy/verify-contracts')
        logTask(VERIFY_CONTRACTS)
    }
}

function logTask(taskName: string) {
    purpleLog(`\n🎛  Running ${taskName} task...\n`)
}
