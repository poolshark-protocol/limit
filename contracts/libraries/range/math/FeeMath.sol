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

    uint256 internal constant FEE_DELTA_CONST = 0;
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    struct CalculateLocals {
        uint256 price;
        uint256 minPrice;
        uint256 lastPrice;
        uint256 swapFee;
        uint256 feeAmount;
        uint256 protocolFee;
        uint256 protocolFeesAccrued;
        uint256 amountOutRange;
        bool feeDirection;
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
            {
                locals.minPrice = ConstantProduct.getPrice(cache.constants.bounds.min);
                locals.price = ConstantProduct.getPrice(cache.price);
                locals.lastPrice = ConstantProduct.getPrice(cache.averagePrice);
                if (locals.price < locals.minPrice)
                    locals.price = locals.minPrice;
                if (locals.lastPrice < locals.minPrice)
                    locals.lastPrice = locals.minPrice;
                console.log('liquidity check', cache.state.pool.liquidity, cache.price);
                uint256 delta = OverflowMath.mulDiv(
                        FEE_DELTA_CONST * uint16(cache.constants.tickSpacing), // higher FEE_DELTA_CONST means
                                                                               // more aggressive dynamic fee
                        (
                            locals.price > locals.lastPrice
                                ? locals.price - locals.lastPrice
                                : locals.lastPrice - locals.price
                        ) * 1_000_000,
                        locals.lastPrice 
                );
                // max fee increase at 5x
                if (delta > 5_000_000) delta = 5_000_000;
                // true means increased fee for zeroForOne = true
                locals.feeDirection = locals.price < locals.lastPrice;
                if (zeroForOne == locals.feeDirection) {
                    locals.swapFee = cache.constants.swapFee + delta * cache.constants.swapFee / 1e6;
                } else if (delta < 1e6) {
                    locals.swapFee = cache.constants.swapFee - delta * cache.constants.swapFee / 1e6;
                } else {
                    locals.swapFee = 0;
                }
            }
            // calculate output from range liquidity
            locals.amountOutRange = OverflowMath.mulDiv(amountOut, cache.state.pool.liquidity, cache.liquidity);

            // take enough fees to cover fee growth
            locals.feeAmount = OverflowMath.mulDivRoundingUp(locals.amountOutRange, locals.swapFee, 1e6);

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