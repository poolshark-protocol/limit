module.exports = {
    skipFiles: [
        'test', 
        'utils',
        'libraries/TickMap.sol', 
        'libraries/EpochMap.sol',
        'libraries/utils/String.sol',
        'external',
        'staking/FinStaker.sol',
    ],
    configureYulOptimizer: true,
}
