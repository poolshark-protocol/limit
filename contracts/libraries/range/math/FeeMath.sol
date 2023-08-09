// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import "../../math/OverflowMath.sol";
import '../../../base/structs/PoolsharkStructs.sol';
import "../../../interfaces/range/IRangePoolStructs.sol";

/// @notice Math library that facilitates fee handling.
library FeeMath {
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    struct CalculateLocals {
        uint256 feeAmount;
        uint256 protocolFee;
        uint256 amountOutRange;
    }

    function calculate(
        PoolsharkStructs.SwapCache memory cache,
        uint256 amountOut,
        bool zeroForOne
    ) internal pure returns (
        PoolsharkStructs.SwapCache memory
    )
    {
        if (cache.state.pool.liquidity == 0) return cache;
        CalculateLocals memory locals;
        locals.amountOutRange = OverflowMath.mulDiv(amountOut, cache.state.pool.liquidity, cache.liquidity);
        locals.feeAmount = OverflowMath.mulDivRoundingUp(locals.amountOutRange, cache.constants.swapFee, 1e6); 
        locals.protocolFee = OverflowMath.mulDivRoundingUp(locals.feeAmount, zeroForOne ? cache.state.pool0.protocolFee : cache.state.pool1.protocolFee, 1e6);
        amountOut -= locals.feeAmount;
        locals.feeAmount -= locals.protocolFee;

        if (zeroForOne) {
           cache.state.pool0.protocolFees += uint128(locals.protocolFee);
           cache.state.pool.feeGrowthGlobal1 += uint200(OverflowMath.mulDiv(locals.feeAmount, Q128, cache.state.pool.liquidity));
        } else {
          cache.state.pool1.protocolFees += uint128(locals.protocolFee);
          cache.state.pool.feeGrowthGlobal0 += uint200(OverflowMath.mulDiv(locals.feeAmount, Q128, cache.state.pool.liquidity));
        }
        cache.output += amountOut;
        return cache;
    }
}