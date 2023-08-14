// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../../utils/SafeCast.sol';
import "../../math/OverflowMath.sol";
import '../../../base/structs/PoolsharkStructs.sol';
import "../../../interfaces/range/IRangePoolStructs.sol";

/// @notice Math library that facilitates fee handling.
library FeeMath {
    using SafeCast for uint256;

    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    struct CalculateLocals {
        uint256 feeAmount;
        uint256 protocolFee;
        uint256 protocolFeesAccrued;
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
        if (cache.state.pool.liquidity != 0) {
            CalculateLocals memory locals;

            // calculate output from range liquidity
            locals.amountOutRange = OverflowMath.mulDiv(amountOut, cache.state.pool.liquidity, cache.liquidity);

            // take enough fees to cover fee growth
            locals.feeAmount = OverflowMath.mulDivRoundingUp(locals.amountOutRange, cache.constants.swapFee, 1e6);

            // load protocol fee from cache
            locals.protocolFee = zeroForOne ? cache.state.pool0.protocolFee : cache.state.pool1.protocolFee;
            // calculate fee
            locals.protocolFeesAccrued = OverflowMath.mulDivRoundingUp(locals.feeAmount, locals.protocolFee, 1e6);
            amountOut -= locals.feeAmount;
            
            // fees for this swap step
            locals.feeAmount -= locals.protocolFeesAccrued;
            // add to total fees paid for swap
            cache.feeAmount += locals.feeAmount.toUint128();
            
            // save fee growth and protocol fees
            if (zeroForOne) {
                cache.state.pool0.protocolFees += uint128(locals.protocolFeesAccrued);
                cache.state.pool.feeGrowthGlobal1 += uint200(OverflowMath.mulDiv(locals.feeAmount, Q128, cache.state.pool.liquidity));
            } else {
                cache.state.pool1.protocolFees += uint128(locals.protocolFeesAccrued);
                cache.state.pool.feeGrowthGlobal0 += uint200(OverflowMath.mulDiv(locals.feeAmount, Q128, cache.state.pool.liquidity));
            }
        }
        cache.output += amountOut;
        return cache;
    }
}