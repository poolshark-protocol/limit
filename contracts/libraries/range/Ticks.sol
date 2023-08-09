// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../../base/structs/PoolsharkStructs.sol';
import '../../interfaces/range/IRangePoolStructs.sol';
import '../../interfaces/range/IRangePoolFactory.sol';
import '../../interfaces/range/IRangePool.sol';
import './math/FeeMath.sol';
import './Positions.sol';
import '../math/OverflowMath.sol';
import '../math/ConstantProduct.sol';
import '../TickMap.sol';
import './Samples.sol';

/// @notice Tick management library
library Ticks {
    error LiquidityOverflow();
    error LiquidityUnderflow();
    error InvalidLowerTick();
    error InvalidUpperTick();
    error InvalidPositionAmount();
    error InvalidPositionBounds();

    event Initialize(
        uint160 startPrice,
        int24 tickAtPrice,
        int24 minTick,
        int24 maxTick
    );

    event Swap(
        address indexed recipient,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut,
        uint160 price,
        uint128 liquidity,
        int24 tickAtPrice
    );

    uint256 internal constant Q96 = 0x1000000000000000000000000;
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    function initialize(
        PoolsharkStructs.TickMap storage tickMap,
        IRangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.GlobalState memory state,
        int16 tickSpacing
    ) external returns (
        PoolsharkStructs.GlobalState memory
    )    
    {
        int24 minTick = ConstantProduct.minTick(tickSpacing);
        int24 maxTick = ConstantProduct.maxTick(tickSpacing);
        uint160 minPrice = ConstantProduct.minPrice(tickSpacing);
        uint160 maxPrice = ConstantProduct.maxPrice(tickSpacing);
        if (state.pool.price < minPrice || state.pool.price >= maxPrice)
            require(false, 'StartPriceInvalid()');

        TickMap.set(tickMap, minTick, tickSpacing);
        TickMap.set(tickMap, maxTick, tickSpacing);
        PoolsharkStructs.Immutables memory constants;
        constants.tickSpacing = tickSpacing;
        state.pool.tickAtPrice = ConstantProduct.getTickAtPrice(state.pool.price, constants);
        
        emit Initialize(
            state.pool.price,
            state.pool.tickAtPrice,
            minTick,
            maxTick
        );
        state.pool = Samples.initialize(samples, state.pool);
        
        return state;
    }

    function validate(
        int24 lower,
        int24 upper,
        int16 tickSpacing
    ) internal pure {
        if (lower % tickSpacing != 0) require(false, 'InvalidLowerTick()');
        if (lower <= ConstantProduct.minTick(tickSpacing)) require(false, 'InvalidLowerTick()');
        if (upper % tickSpacing != 0) require(false, 'InvalidUpperTick()');
        if (upper >= ConstantProduct.maxTick(tickSpacing)) require(false, 'InvalidUpperTick()');
        if (lower >= upper) require(false, 'InvalidPositionBounds()');
    }

    // function swap(
    //     mapping(int24 => PoolsharkStructs.Tick) storage ticks,
    //     IRangePoolStructs.Sample[65535] storage samples,
    //     PoolsharkStructs.TickMap storage tickMap,
    //     IRangePoolStructs.SwapParams memory params,
    //     PoolsharkStructs.SwapCache memory cache,
    //     PoolsharkStructs.GlobalState memory pool
    // ) internal returns (
    //         PoolsharkStructs.GlobalState memory,
    //         PoolsharkStructs.SwapCache memory
    //     )
    // {
    //     cache = PoolsharkStructs.SwapCache({
    //         constants: cache.constants,
    //         pool: cache.pool,
    //         price: pool.price,
    //         liquidity: pool.liquidity,
    //         cross: true,
    //         crossTick: params.zeroForOne ? TickMap.previous(tickMap, pool.tickAtPrice, cache.constants.tickSpacing, true) 
    //                                      : TickMap.next(tickMap, pool.tickAtPrice, cache.constants.tickSpacing, true),
    //         crossPrice: 0,
    //         protocolFee: pool.protocolFee,
    //         input:  0,
    //         output: 0,
    //         exactIn: params.exactIn,
    //         amountLeft: params.amount,
    //         tickSecondsAccum: 0,
    //         secondsPerLiquidityAccum: 0
    //     });
    //     if (!cache.exactIn) cache.amountLeft = OverflowMath.mulDivRoundingUp(uint256(params.amount), 1e6, (1e6 - cache.constants.swapFee));
    //     // grab latest sample and store in cache for _cross
    //     (
    //         cache.tickSecondsAccum,
    //         cache.secondsPerLiquidityAccum
    //     ) = Samples.getSingle(
    //             IRangePool(address(this)), 
    //             IRangePoolStructs.SampleParams(
    //                 pool.samples.index,
    //                 pool.samples.length,
    //                 uint32(block.timestamp),
    //                 new uint32[](2),
    //                 pool.tickAtPrice,
    //                 pool.liquidity,
    //                 cache.constants
    //             ),
    //             0
    //     );
    //     while (cache.cross) {
    //         cache.crossPrice = ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants);
    //         (pool, cache) = _quoteSingle(params.zeroForOne, params.priceLimit, pool, cache);
    //         if (cache.cross) {
    //             (pool, cache) = _cross(
    //                 ticks,
    //                 tickMap,
    //                 pool,
    //                 cache,
    //                 params.zeroForOne
    //             );
    //         }
    //     }
    //     /// @dev - write oracle entry after start of block
    //     (
    //         pool.samples.index,
    //         pool.samples.length
    //     ) = Samples.save(
    //         samples,
    //         pool,
    //         pool.tickAtPrice
    //     );
    //     pool.price = cache.price;
    //     pool.liquidity = cache.liquidity;
    //     if (cache.price != cache.crossPrice) {
    //         pool.tickAtPrice = ConstantProduct.getTickAtPrice(cache.price);
    //     } else {
    //         pool.tickAtPrice = cache.crossTick;
    //     }
    //     emit Swap(
    //         params.to,
    //         params.zeroForOne,
    //         cache.input,
    //         cache.output, /// @dev - subgraph will do math to compute fee amount
    //         pool.price,
    //         pool.liquidity,
    //         pool.tickAtPrice
    //     );
    //     return (pool, cache);
    // }

    // function _quoteSingle(
    //     PoolsharkStructs.GlobalState memory pool,
    //     PoolsharkStructs.SwapCache memory cache,
    //     PoolsharkStructs.Immutables memory constants,
    //     uint160 priceLimit,
    //     bool zeroForOne
    // ) internal pure returns (
    //     PoolsharkStructs.GlobalState memory,
    //     PoolsharkStructs.SwapCache memory
    // ) {
    //     if ((zeroForOne ? priceLimit >= cache.price
    //                     : priceLimit <= cache.price) ||
    //         cache.price == constants.bounds.min ||
    //         cache.price == constants.bounds.max ||
    //         cache.amountLeft == 0)
    //     {
    //         cache.cross = false;
    //         return (pool, cache);
    //     }
    //     uint256 nextPrice = cache.crossPrice;
    //     uint256 amountOut;
    //     if (zeroForOne) {
    //         // Trading token 0 (x) for token 1 (y).
    //         // price  is decreasing.
    //         if (nextPrice < priceLimit) {
    //             nextPrice = priceLimit;
    //         }
    //         uint256 amountMax = cache.exactIn ? ConstantProduct.getDx(cache.liquidity, nextPrice, cache.price, true)
    //                                           : ConstantProduct.getDy(cache.liquidity, nextPrice, cache.price, false);
    //         if (cache.amountLeft <= amountMax) {
    //             // We can swap within the current range.
    //             uint256 liquidityPadded = uint256(cache.liquidity) << 96;
    //             // calculate price after swap
    //             uint256 newPrice;
    //             if (cache.exactIn) {
    //                 newPrice = OverflowMath.mulDivRoundingUp(
    //                     liquidityPadded,
    //                     cache.price,
    //                     liquidityPadded + uint256(cache.price) * uint256(cache.amountLeft)
    //                 );
    //                 amountOut = ConstantProduct.getDy(cache.liquidity, newPrice, uint256(cache.price), false);
    //                 cache.input += cache.amountLeft;
    //             } else {
    //                 newPrice = cache.price - 
    //                     OverflowMath.divRoundingUp(cache.amountLeft << 96, cache.liquidity);
    //                 amountOut = cache.amountLeft;
    //                 cache.input += ConstantProduct.getDx(cache.liquidity, newPrice, uint256(cache.price), true);
    //             }
    //             cache.amountLeft = 0;
    //             cache.cross = false;
    //             cache.price = uint160(newPrice);
    //         } else {
    //             if (cache.exactIn) {
    //                 amountOut = ConstantProduct.getDy(cache.liquidity, nextPrice, cache.price, false);
    //                 cache.input += amountMax;
    //             } else {
    //                 amountOut = amountMax;
    //                 cache.input += ConstantProduct.getDx(cache.liquidity, nextPrice, cache.price, true);
    //             }
    //             cache.amountLeft -= amountMax;
    //             if (nextPrice == cache.crossPrice
    //                     && nextPrice != cache.price) { cache.cross = true; }
    //             else cache.cross = false;
    //             cache.price = uint160(nextPrice);
    //         }
    //     } else {
    //         // Price is increasing.
    //         if (nextPrice > priceLimit) {
    //             nextPrice = priceLimit;
    //         }
    //         uint256 amountMax = cache.exactIn ? ConstantProduct.getDy(cache.liquidity, uint256(cache.price), nextPrice, true)
    //                                           : ConstantProduct.getDx(cache.liquidity, uint256(cache.price), nextPrice, false);
    //         if (cache.amountLeft <= amountMax) {
    //             uint256 newPrice;
    //             if (cache.exactIn) {
    //                 newPrice = cache.price +
    //                     OverflowMath.mulDiv(cache.amountLeft, Q96, cache.liquidity);
    //                 amountOut = ConstantProduct.getDx(cache.liquidity, cache.price, newPrice, false);
    //                 cache.input += cache.amountLeft;
    //             } else {
    //                 uint256 liquidityPadded = uint256(cache.liquidity) << 96;
    //                 newPrice = OverflowMath.mulDivRoundingUp(
    //                     liquidityPadded, 
    //                     cache.price,
    //                     liquidityPadded - uint256(cache.price) * cache.amountLeft
    //                 );
    //                 amountOut = cache.amountLeft;
    //                 cache.input += ConstantProduct.getDy(cache.liquidity, cache.price, newPrice, true);
    //             }
    //             cache.amountLeft = 0;
    //             cache.cross = false;
    //             cache.price = uint160(newPrice);
    //         } else {
    //             if (cache.exactIn) {
    //                 amountOut = ConstantProduct.getDx(cache.liquidity, cache.price, nextPrice, false);
    //                 cache.input += amountMax;
    //             } else {
    //                 amountOut = amountMax;
    //                 cache.input += ConstantProduct.getDy(cache.liquidity, cache.price, nextPrice, true);
    //             }
    //             cache.amountLeft -= amountMax;
    //             if (nextPrice == cache.crossPrice 
    //                 && nextPrice != cache.price) { cache.cross = true; }
    //             else cache.cross = false;
    //             cache.price = uint160(nextPrice);
    //         }
    //     }
    //     (pool, cache) = FeeMath.calculate(pool, cache, amountOut, zeroForOne);
    //     return (pool, cache);
    // }

    function _cross(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.SwapCache memory cache,
        bool zeroForOne
    ) internal returns (
        PoolsharkStructs.SwapCache memory
    ) {
        PoolsharkStructs.RangeTick memory crossTick = ticks[cache.crossTick].range;
        crossTick.feeGrowthOutside0       = cache.state.pool.feeGrowthGlobal0 - crossTick.feeGrowthOutside0;
        crossTick.feeGrowthOutside1       = cache.state.pool.feeGrowthGlobal1 - crossTick.feeGrowthOutside1;
        crossTick.tickSecondsAccumOutside = cache.tickSecondsAccum - crossTick.tickSecondsAccumOutside;
        crossTick.secondsPerLiquidityAccumOutside = cache.secondsPerLiquidityAccum - crossTick.secondsPerLiquidityAccumOutside;
        ticks[cache.crossTick].range = crossTick;
        tickMap;
        int128 liquidityDelta = ticks[cache.crossTick].range.liquidityDelta;
        // observe most recent oracle update
        if (zeroForOne) {
            unchecked {
                if (liquidityDelta >= 0){
                    cache.liquidity -= uint128(ticks[cache.crossTick].range.liquidityDelta);
                } else {
                    cache.liquidity += uint128(-ticks[cache.crossTick].range.liquidityDelta); 
                }
            }
            cache.state.pool.tickAtPrice = cache.crossTick;
            // cache.crossTick = TickMap.previous(tickMap, cache.crossTick, false);
        } else {
            unchecked {
                if (liquidityDelta >= 0) {
                    cache.liquidity += uint128(ticks[cache.crossTick].range.liquidityDelta);
                } else {
                    cache.liquidity -= uint128(-ticks[cache.crossTick].range.liquidityDelta);
                }
            }
            cache.state.pool.tickAtPrice = cache.crossTick;
            // cache.crossTick = TickMap.next(tickMap, cache.crossTick);
        }
        return cache;
    }

    function _pass(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.SwapCache memory cache,
        bool zeroForOne
    ) internal view returns (
        PoolsharkStructs.SwapCache memory
    ) {
        tickMap;
        int128 liquidityDelta = ticks[cache.crossTick].range.liquidityDelta;
        if (zeroForOne) {
            unchecked {
                if (liquidityDelta >= 0){
                    cache.liquidity -= uint128(ticks[cache.crossTick].range.liquidityDelta);
                } else {
                    cache.liquidity += uint128(-ticks[cache.crossTick].range.liquidityDelta); 
                }
            }
            cache.state.pool.tickAtPrice = cache.crossTick;
            // cache.crossTick = TickMap.previous(tickMap, cache.crossTick, false);
        } else {
            unchecked {
                if (liquidityDelta >= 0) {
                    cache.liquidity += uint128(ticks[cache.crossTick].range.liquidityDelta);
                } else {
                    cache.liquidity -= uint128(-ticks[cache.crossTick].range.liquidityDelta);
                }
            }
            cache.state.pool.tickAtPrice = cache.crossTick;
            // cache.crossTick = TickMap.next(tickMap, cache.crossTick);
        }
        return cache;
    }

    function insert(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        IRangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.Immutables memory constants,
        int24 lower,
        int24 upper,
        uint128 amount
    ) internal returns (PoolsharkStructs.GlobalState memory) {
        validate(lower, upper, constants.tickSpacing);
        // check for amount to overflow liquidity delta & global
        if (amount == 0) return state;
        if (amount > uint128(type(int128).max)) require(false, 'LiquidityOverflow()');
        if (type(uint128).max - state.liquidityGlobal < amount) require(false, 'LiquidityOverflow()');

        // get tick at price
        int24 tickAtPrice = state.pool.tickAtPrice;

        if(TickMap.set(tickMap, lower, constants.tickSpacing)) {
            ticks[lower].range.liquidityDelta += int128(amount);
        } else {
            if (lower <= tickAtPrice) {
                (
                    int56 tickSecondsAccum,
                    uint160 secondsPerLiquidityAccum
                ) = Samples.getSingle(
                        IPool(address(this)), 
                        IRangePoolStructs.SampleParams(
                            state.pool.samples.index,
                            state.pool.samples.length,
                            uint32(block.timestamp),
                            new uint32[](2),
                            state.pool.tickAtPrice,
                            state.pool.liquidity,
                            constants
                        ),
                        0
                );
                ticks[lower].range = PoolsharkStructs.RangeTick(
                    state.pool.feeGrowthGlobal0,
                    state.pool.feeGrowthGlobal1,
                    secondsPerLiquidityAccum,
                    int128(amount),             // liquidityDelta
                    tickSecondsAccum
                );
            } else {
                ticks[lower].range.liquidityDelta = int128(amount);
            }
        }

        if(TickMap.set(tickMap, upper, constants.tickSpacing)) {
            ticks[upper].range.liquidityDelta -= int128(amount);
        } else {
            if (upper <= tickAtPrice) {
                (
                    int56 tickSecondsAccum,
                    uint160 secondsPerLiquidityAccum
                ) = Samples.getSingle(
                        IPool(address(this)), 
                        IRangePoolStructs.SampleParams(
                            state.pool.samples.index,
                            state.pool.samples.length,
                            uint32(block.timestamp),
                            new uint32[](2),
                            state.pool.tickAtPrice,
                            state.pool.liquidity,
                            constants
                        ),
                        0
                );
                ticks[upper].range = PoolsharkStructs.RangeTick(
                    state.pool.feeGrowthGlobal0,
                    state.pool.feeGrowthGlobal1,
                    secondsPerLiquidityAccum,
                    -int128(amount),
                    tickSecondsAccum
                );
            } else {
                ticks[upper].range.liquidityDelta = -int128(amount);
            }
        }
        if (tickAtPrice >= lower && tickAtPrice < upper) {
            // write an oracle entry
            (state.pool.samples.index, state.pool.samples.length) = Samples.save(
                samples,
                state.pool,
                state.pool.tickAtPrice
            );
            // update pool liquidity
            state.pool.liquidity += amount;
        }
        // update global liquidity
        state.liquidityGlobal += amount;

        return state;
    }

    function remove(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        IRangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.Immutables memory constants, 
        int24 lower,
        int24 upper,
        uint128 amount
    ) internal returns (PoolsharkStructs.GlobalState memory) {
        validate(lower, upper, constants.tickSpacing);
        //check for amount to overflow liquidity delta & global
        if (amount == 0) return state;
        if (amount > uint128(type(int128).max)) require(false, 'LiquidityUnderflow()');
        if (amount > state.liquidityGlobal) require(false, 'LiquidityUnderflow()');

        // get tick at price
        int24 tickAtPrice = state.pool.tickAtPrice;

        PoolsharkStructs.Tick storage current = ticks[lower];
        if (lower != ConstantProduct.minTick(constants.tickSpacing) && current.range.liquidityDelta == int128(amount)) {
            TickMap.unset(tickMap, lower, constants.tickSpacing);
            delete ticks[lower];
        } else {
            unchecked {
                current.range.liquidityDelta -= int128(amount);
            }
        }
        current = ticks[upper];

        if (upper != ConstantProduct.maxTick(constants.tickSpacing) && current.range.liquidityDelta == -int128(amount)) {
            TickMap.unset(tickMap, upper, constants.tickSpacing);
            delete ticks[upper];
        } else {
            unchecked {
                current.range.liquidityDelta += int128(amount);
            }
        }
        if (tickAtPrice >= lower && tickAtPrice < upper) {
            // write an oracle entry
            (state.pool.samples.index, state.pool.samples.length) = Samples.save(
                samples,
                state.pool,
                tickAtPrice
            );
            state.pool.liquidity -= amount;  
        }
        state.liquidityGlobal -= amount;

        return state;
    }
}
