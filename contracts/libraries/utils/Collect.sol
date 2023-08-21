// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../interfaces/limit/ILimitPoolStructs.sol';
import '../limit/LimitPositions.sol';
import '../utils/SafeTransfers.sol';

library Collect {
    using SafeCast for int128;

    event CollectRange(
        uint128 amount0,
        uint128 amount1
    );

    function range(
        PoolsharkStructs.Immutables memory constants,
        address recipient,
        int128 amount0,
        int128 amount1
    ) internal {
        /// @dev - negative balances will revert
        if (amount0 > 0) {
            /// @dev - cast to ensure user doesn't owe the pool balance
            SafeTransfers.transferOut(recipient, constants.token0, amount0.toUint128());
        }
        if (amount1 > 0) {
            /// @dev - cast to ensure user doesn't owe the pool balance
            SafeTransfers.transferOut(recipient, constants.token1, amount1.toUint128());
        }
        emit CollectRange(amount0.toUint128(), amount1.toUint128());
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
