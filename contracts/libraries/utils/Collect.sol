// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import '../../interfaces/ILimitPoolStructs.sol';
import '../Positions.sol';
import '../utils/SafeTransfers.sol';
import 'hardhat/console.sol';

library Collect {
    function burn(
        ILimitPoolStructs.BurnCache memory cache,
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.Position)))
            storage positions,
        ILimitPoolStructs.CollectParams memory params
        
    ) internal {
        params.zeroForOne ? params.lower = params.claim : params.upper = params.claim;

        // store amounts for transferOut
        uint128 amountIn  = positions[msg.sender][params.lower][params.upper].amountIn;
        uint128 amountOut = positions[msg.sender][params.lower][params.upper].amountOut;

        console.log('cPL check 2', uint24(-params.claim), positions[msg.sender][params.lower][params.upper].claimPriceLast);

        // console.log('position amounts', amountIn, amountOut);

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
