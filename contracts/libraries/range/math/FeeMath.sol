// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../Samples.sol';
import '../../utils/SafeCast.sol';
import "../../math/OverflowMath.sol";
import '../../../base/structs/PoolsharkStructs.sol';
import "../../../interfaces/range/IRangePoolStructs.sol";

/// @notice Math library that facilitates fee handling.
library FeeMath {
    using SafeCast for uint256;

    uint256 internal constant FEE_DELTA_CONST = 0;
    //TODO: change FEE_DELTA_CONST before launch
    // uint256 internal constant FEE_DELTA_CONST = 5000;
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    struct CalculateLocals {
        uint256 price;
        uint256 minPrice;
        uint256 lastPrice;
        uint256 swapFee;
        uint256 feeAmount;
        uint256 protocolFee;
        uint256 protocolFeesAccrued;
        uint256 amountRange;
        bool feeDirection;
    }

    function calculate(
        PoolsharkStructs.SwapCache memory cache,
        uint256 amountIn,
        uint256 amountOut,
        bool zeroForOne
    ) internal pure returns (
        PoolsharkStructs.SwapCache memory
    )
    {
        CalculateLocals memory locals;
        if (cache.state.pool.liquidity != 0) {
            // calculate dynamic fee
            {
                locals.minPrice = ConstantProduct.getPrice(cache.constants.bounds.min);
                // square prices to take delta
                locals.price = ConstantProduct.getPrice(cache.price);
                locals.lastPrice = ConstantProduct.getPrice(cache.averagePrice);
                if (locals.price < locals.minPrice)
                    locals.price = locals.minPrice;
                if (locals.lastPrice < locals.minPrice)
                    locals.lastPrice = locals.minPrice;
                // delta is % modifier on the swapFee
                uint256 delta = OverflowMath.mulDiv(
                        FEE_DELTA_CONST / uint16(cache.constants.tickSpacing), // higher FEE_DELTA_CONST means
                        (                                                      // more aggressive dynamic fee
                            locals.price > locals.lastPrice
                                ? locals.price - locals.lastPrice
                                : locals.lastPrice - locals.price
                        ) * 1_000_000,
                        locals.lastPrice 
                );
                // max fee increase at 5x
                if (delta > 4_000_000) delta = 4_000_000;
                // true means increased fee for zeroForOne = true
                locals.feeDirection = locals.price < locals.lastPrice;
                // adjust fee based on direction
                if (zeroForOne == locals.feeDirection) {
                    // if swapping away from twap price, increase fee
                    locals.swapFee = cache.constants.swapFee + delta * cache.constants.swapFee / 1e6;
                } else if (delta < 1e6) {
                    // if swapping towards twap price, decrease fee
                    locals.swapFee = cache.constants.swapFee - delta * cache.constants.swapFee / 1e6;
                } else {
                    // if swapping towards twap price and delta > 100%, set fee to zero
                    locals.swapFee = 0;
                }
                // console.log('price movement', locals.lastPrice, locals.price);
                // console.log('swap fee adjustment',cache.constants.swapFee + delta * cache.constants.swapFee / 1e6);
            }
            if (cache.exactIn) {
                // calculate output from range liquidity
                locals.amountRange = OverflowMath.mulDiv(amountOut, cache.state.pool.liquidity, cache.liquidity);
                // take enough fees to cover fee growth
                locals.feeAmount = OverflowMath.mulDivRoundingUp(locals.amountRange, locals.swapFee, 1e6);
                amountOut -= locals.feeAmount;
            } else {
                // calculate input from range liquidity
                locals.amountRange = OverflowMath.mulDiv(amountIn, cache.state.pool.liquidity, cache.liquidity);
                // take enough fees to cover fee growth
                locals.feeAmount = OverflowMath.mulDivRoundingUp(locals.amountRange, locals.swapFee, 1e6);
                amountIn += locals.feeAmount;
            }
            // load protocol fee from cache
            locals.protocolFee = zeroForOne == cache.exactIn ? cache.state.pool0.protocolFee : cache.state.pool1.protocolFee;
            // calculate fee
            locals.protocolFeesAccrued = OverflowMath.mulDivRoundingUp(locals.feeAmount, locals.protocolFee, 1e6);
            // fees for this swap step
            locals.feeAmount -= locals.protocolFeesAccrued;
            // add to total fees paid for swap
            cache.feeAmount += locals.feeAmount.toUint128();
            // save fee growth and protocol fees
            if (zeroForOne == cache.exactIn) {
                cache.state.pool0.protocolFees += uint128(locals.protocolFeesAccrued);
                cache.state.pool.feeGrowthGlobal1 += uint200(OverflowMath.mulDiv(locals.feeAmount, Q128, cache.state.pool.liquidity));
            } else {
                cache.state.pool1.protocolFees += uint128(locals.protocolFeesAccrued);
                cache.state.pool.feeGrowthGlobal0 += uint200(OverflowMath.mulDiv(locals.feeAmount, Q128, cache.state.pool.liquidity));
            }
        }
        cache.input  += amountIn;
        cache.output += amountOut;

        return cache;
    }
}