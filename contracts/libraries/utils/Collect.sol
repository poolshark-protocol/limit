// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import '../../interfaces/ILimitPoolStructs.sol';
import '../Epochs.sol';
import '../Positions.sol';
import '../utils/SafeTransfers.sol';

library Collect {
    function mint(
        ILimitPoolStructs.MintCache memory cache,
        ILimitPoolStructs.CollectParams memory params
    ) internal {
        if (params.syncFees.token0 == 0 && params.syncFees.token1 == 0) return;
        // store amounts for transferOut
        uint128 amountIn;
        uint128 amountOut;

        // factor in sync fees
        if (params.zeroForOne) {
            amountIn  += params.syncFees.token1;
            amountOut += params.syncFees.token0;
        } else {
            amountIn  += params.syncFees.token0;
            amountOut += params.syncFees.token1;
        }

        /// zero out balances and transfer out
        if (amountIn > 0) {
            SafeTransfers.transferOut(params.to, params.zeroForOne ? cache.constants.token1 : cache.constants.token0, amountIn);
        } 
        if (amountOut > 0) {
            SafeTransfers.transferOut(params.to, params.zeroForOne ? cache.constants.token0 : cache.constants.token1, amountOut);
        }
    }

    function burn(
        ILimitPoolStructs.BurnCache memory cache,
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.Position)))
            storage positions,
        ILimitPoolStructs.CollectParams memory params
        
    ) internal {
        params.zeroForOne ? params.upper = params.claim : params.lower = params.claim;

        // store amounts for transferOut
        uint128 amountIn  = positions[msg.sender][params.lower][params.upper].amountIn;
        uint128 amountOut = positions[msg.sender][params.lower][params.upper].amountOut;

        // factor in sync fees
        if (params.zeroForOne) {
            amountIn  += params.syncFees.token1;
            amountOut += params.syncFees.token0;
        } else {
            amountIn  += params.syncFees.token0;
            amountOut += params.syncFees.token1;
        }

        /// zero out balances and transfer out
        if (amountIn > 0) {
            positions[msg.sender][params.lower][params.upper].amountIn = 0;
            SafeTransfers.transferOut(params.to, params.zeroForOne ? cache.constants.token1 : cache.constants.token0, amountIn);
        } 
        if (amountOut > 0) {
            positions[msg.sender][params.lower][params.upper].amountOut = 0;
            SafeTransfers.transferOut(params.to, params.zeroForOne ? cache.constants.token0 : cache.constants.token1, amountOut);
        }
    }
}
