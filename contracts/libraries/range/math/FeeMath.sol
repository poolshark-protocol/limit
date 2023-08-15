// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../Samples.sol';
import '../../utils/SafeCast.sol';
import "../../math/OverflowMath.sol";
import '../../../base/structs/PoolsharkStructs.sol';
import "../../../interfaces/range/IRangePoolStructs.sol";
import 'hardhat/console.sol';

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
    ) internal view returns (
        PoolsharkStructs.SwapCache memory
    )
    {
        if (cache.state.pool.liquidity != 0) {
            CalculateLocals memory locals;

            // 1. calculate twap price for last 10 seconds

            // if no 10 second sample, take as long of a sample as possible

                        // compute spread.

            // uint256 price = _getPrice(cache.price);
            // uint256 lastPrice = _getPrice(averagePrice);

            // 1000 => 0 and 5000

            // int16 delta = SafeCast.toUint16(
            //     OverflowMath.mulDiv(
            //         c, // set to 7500
            //         (
            //             price > lastPrice
            //                 ? price - lastPrice
            //                 : lastPrice - price
            //         ) * 1_000_000,
            //         lastPrice * 10_000
            //     )
            // );

            // impactDirection = price > lastPrice;
            // positive value if price went up
            // negative value if price went down
            // zeroForOne => - (fee)
            // !zeroForOne => + (fee)
            // take greater fee in direction of delta
            // take lesser fee in opposing direction of delta

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