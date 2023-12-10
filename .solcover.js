module.exports = {
    skipFiles: [
        'test', 
        'utils',
        'libraries/TickMap.sol', 
        'libraries/EpochMap.sol',
        'libraries/utils',
        'external',
        'staking/FinStaker.sol',
    ],
    configureYulOptimizer: true,
}
