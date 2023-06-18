// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import '../../interfaces/ILimitPoolStructs.sol';
import '../Ticks.sol';

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
        ILimitPoolStructs.QuoteParams memory params,
        ILimitPoolStructs.SwapCache memory cache,
        ILimitPoolStructs.TickMap storage tickMap,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks
    ) external view returns (
        ILimitPoolStructs.PoolState memory,
        ILimitPoolStructs.SwapCache memory    
    ) {
        return Ticks.quote(
            ticks,
            tickMap,
            params,
            cache,
            cache.pool
        );
    }
}
