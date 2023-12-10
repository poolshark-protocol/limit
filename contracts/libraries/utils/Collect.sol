// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import '../../interfaces/structs/LimitPoolStructs.sol';
import '../limit/LimitPositions.sol';
import '../utils/SafeTransfers.sol';

library Collect {
    using SafeCast for int128;
    using SafeCast for uint128;

    event CollectRange0(uint128 amount0);

    event CollectRange1(uint128 amount1);

    function range(
        PoolsharkStructs.LimitImmutables memory constants,
        address recipient,
        int128 amount0,
        int128 amount1
    ) internal {
        /// @dev - negative balances will revert
        if (amount0 > 0) {
            /// @dev - cast to ensure user doesn't owe the pool balance
            SafeTransfers.transferOut(
                recipient,
                constants.token0,
                amount0.toUint128()
            );
            emit CollectRange0(amount0.toUint128());
        }
        if (amount1 > 0) {
            /// @dev - cast to ensure user doesn't owe the pool balance
            SafeTransfers.transferOut(
                recipient,
                constants.token1,
                amount1.toUint128()
            );
            emit CollectRange1(amount1.toUint128());
        }
    }

    function burnLimit(
        LimitPoolStructs.BurnLimitCache memory cache,
        PoolsharkStructs.BurnLimitParams memory params
    )
        internal
        returns (
            LimitPoolStructs.BurnLimitCache memory,
            int128 amount0Delta,
            int128 amount1Delta
        )
    {
        uint128 amount0 = params.zeroForOne ? cache.amountOut : cache.amountIn;
        uint128 amount1 = params.zeroForOne ? cache.amountIn : cache.amountOut;

        /// zero out balances and transfer out
        if (amount0 > 0) {
            cache.amountIn = 0;
            SafeTransfers.transferOut(
                params.to,
                cache.constants.token0,
                amount0
            );
        }
        if (amount1 > 0) {
            cache.amountOut = 0;
            SafeTransfers.transferOut(
                params.to,
                cache.constants.token1,
                amount1
            );
        }
        return (cache, amount0.toInt128(), amount1.toInt128());
    }
}
