// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../interfaces/limit/ILimitPoolStructs.sol';
import '../limit/LimitPositions.sol';
import '../utils/SafeTransfers.sol';

library Collect {
    function burnLimit(
        ILimitPoolStructs.BurnLimitCache memory cache,
        ILimitPoolStructs.BurnLimitParams memory params
    ) internal returns (
        ILimitPoolStructs.BurnLimitCache memory
    )    
    {
        // store amounts for transferOut
        uint128 amountIn  = cache.position.amountIn;
        uint128 amountOut = cache.position.amountOut;

        /// zero out balances and transfer out
        if (amountIn > 0) {
            cache.position.amountIn = 0;
            SafeTransfers.transferOut(params.to, params.zeroForOne ? cache.constants.token1 : cache.constants.token0, amountIn);
        }
        if (amountOut > 0) {
            cache.position.amountOut = 0;
            SafeTransfers.transferOut(params.to, params.zeroForOne ? cache.constants.token0 : cache.constants.token1, amountOut);
        }

        return cache;
    }
}
