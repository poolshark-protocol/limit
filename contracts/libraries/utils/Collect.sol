// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../interfaces/IERC20Minimal.sol';
import '../../interfaces/structs/LimitPoolStructs.sol';
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
        LimitPoolStructs.BurnLimitCache memory cache,
        LimitPoolStructs.BurnLimitParams memory params
    ) internal returns (
        LimitPoolStructs.BurnLimitCache memory
    )    
    {
        uint128 amount0 = params.zeroForOne ? cache.amountOut : cache.amountIn;
        uint128 amount1 = params.zeroForOne ? cache.amountIn : cache.amountOut;

        /// zero out balances and transfer out
        if (amount0 > 0) {
            cache.amountIn = 0;
            EchidnaAssertions.assertPoolBalanceExceeded(
                balance(cache.constants.token0),
                amount0
            );
            SafeTransfers.transferOut(params.to, cache.constants.token0, amount0);
        }
        if (amount1 > 0) {
            cache.amountOut = 0;
            EchidnaAssertions.assertPoolBalanceExceeded(
                balance(cache.constants.token1),
                amount1
            );
            SafeTransfers.transferOut(params.to, cache.constants.token1, amount1);
        }
        return cache;
    }

        function balance(
        address token
    ) private view returns (uint256) {
        (
            bool success,
            bytes memory data
        ) = token.staticcall(
                                    abi.encodeWithSelector(
                                        IERC20Minimal.balanceOf.selector,
                                        address(this)
                                    )
                                );
        require(success && data.length >= 32);
        return abi.decode(data, (uint256));
    }
}
