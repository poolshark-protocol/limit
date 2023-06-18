// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import '../../interfaces/ILimitPoolStructs.sol';
import '../Positions.sol';
import '../utils/Collect.sol';
import '../utils/SafeTransfers.sol';

library SwapCall {
    event SwapPool0(
        address indexed recipient,
        uint128 amountIn,
        uint128 amountOut,
        uint160 priceLimit,
        uint160 newPrice
    );

    event SwapPool1(
        address indexed recipient,
        uint128 amountIn,
        uint128 amountOut,
        uint160 priceLimit,
        uint160 newPrice
    );

    function perform(
        ILimitPoolStructs.SwapParams memory params,
        ILimitPoolStructs.SwapCache memory cache,
        ILimitPoolStructs.TickMap storage tickMap,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks
    ) external returns (ILimitPoolStructs.PoolState memory) {
        SafeTransfers.transferIn(params.zeroForOne ? cache.constants.token0 : cache.constants.token1, params.amountIn);
         (cache.pool, cache) = Ticks.swap(
            ticks,
            tickMap,
            params,
            cache,
            cache.pool
        );
        if (params.zeroForOne) {
            if (cache.input > 0) {
                SafeTransfers.transferOut(params.to, cache.constants.token0, cache.input);
            }
            SafeTransfers.transferOut(params.to, cache.constants.token1, cache.output);
        } else {
            if (cache.input > 0) {
                SafeTransfers.transferOut(params.to, cache.constants.token1, cache.input);
            }
            SafeTransfers.transferOut(params.to, cache.constants.token0, cache.output);
        }
        return cache.pool;
    }
}
