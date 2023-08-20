// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../interfaces/limit/ILimitPoolStructs.sol';
import '../limit/LimitPositions.sol';
import '../utils/SafeTransfers.sol';

library Collect {

    function range(
        IRangePoolStructs.RangePosition memory position,
        PoolsharkStructs.Immutables memory constants,
        address recipient
    ) internal returns (
        IRangePoolStructs.RangePosition memory
    ) {
        // store amounts for transferOut
        uint128 amount0  = position.amount0;
        uint128 amount1 = position.amount1;

        /// zero out balances and transfer out
        if (amount0 > 0) {
            position.amount0 = 0;
            SafeTransfers.transferOut(recipient, constants.token0, amount0);
        }
        if (amount1 > 0) {
            position.amount1 = 0;
            SafeTransfers.transferOut(recipient, constants.token1, amount1);
        }
        return position;
    }

    function burnLimit(
        ILimitPoolStructs.BurnLimitCache memory cache,
        ILimitPoolStructs.BurnLimitParams memory params
    ) internal returns (
        ILimitPoolStructs.BurnLimitCache memory
    )    
    {
        uint128 amount0 = params.zeroForOne ? cache.amountOut : cache.amountIn;
        uint128 amount1 = params.zeroForOne ? cache.amountIn : cache.amountOut;

        /// zero out balances and transfer out
        if (amount0 > 0) {
            cache.amountIn = 0;
            SafeTransfers.transferOut(params.to, cache.constants.token0, amount0);
        }
        if (amount1 > 0) {
            cache.amountOut = 0;
            SafeTransfers.transferOut(params.to, cache.constants.token1, amount1);
        }

        return cache;
    }
}
