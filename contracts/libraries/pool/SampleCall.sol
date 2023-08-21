// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../interfaces/range/IRangePoolStructs.sol';
import '../range/Samples.sol';

library SampleCall {
    uint8 private constant _ENTERED = 2;

    event Swap(
        address indexed recipient,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut,
        uint160 price,
        uint128 liquidity,
        int24 tickAtPrice
    );

    function perform(
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.Immutables memory constants,
        uint32[] memory secondsAgo
    ) external view returns (
        int56[]   memory tickSecondsAccum,
        uint160[] memory secondsPerLiquidityAccum,
        uint160 averagePrice,
        uint128 averageLiquidity,
        int24 averageTick
    ) {
        if (state.unlocked == _ENTERED)
            require(false, 'ReentrancyGuardReadOnlyReentrantCall()');
        return Samples.get(
            address(this),
            IRangePoolStructs.SampleParams(
                state.pool.samples.index,
                state.pool.samples.length,
                uint32(block.timestamp),
                secondsAgo,
                state.pool.tickAtPrice,
                state.pool.liquidity,
                constants
            )
        );
    }
}
