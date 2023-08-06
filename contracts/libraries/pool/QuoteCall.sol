// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../interfaces/limit/ILimitPoolStructs.sol';
import '../limit/TicksLimit.sol';

library QuoteCall {
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
        PoolsharkStructs.QuoteParams memory params,
        ILimitPoolStructs.SwapCache memory cache,
        PoolsharkStructs.TickMap storage tickMap,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks
    ) external view returns (
        uint256,
        uint256,
        uint160
    ) {
        return TicksLimit.quote(
            ticks,
            tickMap,
            params,
            cache,
            cache.pool
        );
    }
}
