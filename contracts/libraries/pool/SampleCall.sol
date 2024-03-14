// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.21;

import '../../interfaces/structs/RangePoolStructs.sol';
import '../Samples.sol';

library SampleCall {
    uint8 private constant _ENTERED = 2;

    event Event();

    function perform(
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.LimitImmutables memory constants,
        uint32[] memory secondsAgo
    )
        external
        view
        returns (
            int56[] memory tickSecondsAccum,
            uint160[] memory secondsPerLiquidityAccum,
            uint160 averagePrice,
            uint128 averageLiquidity,
            int24 averageTick
        )
    {
        if (state.unlocked == _ENTERED)
            require(false, 'ReentrancyGuardReadOnlyReentrantCall()');
        return
            Samples.get(
                address(this),
                RangePoolStructs.SampleParams(
                    state.pool.samples.index,
                    state.pool.samples.count,
                    uint32(block.timestamp),
                    secondsAgo,
                    state.pool.tickAtPrice,
                    state.pool.liquidity,
                    constants
                )
            );
    }
}
