// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.18;

import '../interfaces/structs/PoolsharkStructs.sol';
import '../base/events/LimitPoolEvents.sol';
import './range/math/FeeMath.sol';
import './math/OverflowMath.sol';
import './math/ConstantProduct.sol';
import './TickMap.sol';
import './utils/SafeCast.sol';
import './range/math/FeeMath.sol';
import './Samples.sol';
import './limit/EpochMap.sol';
import './limit/LimitTicks.sol';

library Ticks {
    using SafeCast for uint256;

    // cross flags
    uint8 internal constant RANGE_TICK = 2**0;
    uint8 internal constant LIMIT_TICK = 2**1;
    uint8 internal constant LIMIT_POOL = 2**2;

    // for Q64.96 numbers
    uint256 internal constant Q96 = 0x1000000000000000000000000;

    event Initialize(uint160 price, int24 tick);
    event InitializeLimit(
        int24 minTick,
        int24 maxTick,
        uint160 startPrice,
        int24 startTick
    );

    event Swap(
        address indexed sender,
        address indexed recipient,
        int256 amount0,
        int256 amount1,
        uint160 price,
        uint128 liquidity,
        int24 tickAtPrice
    );
    event SwapLimit(
        address indexed recipient,
        uint256 amountIn,
        uint256 amountOut,
        uint200 feeGrowthGlobal0,
        uint200 feeGrowthGlobal1,
        uint160 price,
        uint128 liquidity,
        uint128 feeAmount,
        int24 tickAtPrice,
        bool indexed zeroForOne,
        bool indexed exactIn
    );

    event SyncRangeTick(
        uint200 feeGrowthOutside0,
        uint200 feeGrowthOutside1,
        int24 tick
    );

    function initialize(
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.LimitImmutables memory constants,
        uint160 startPrice
    ) external returns (PoolsharkStructs.GlobalState memory) {
        // state should only be initialized once
        if (state.pool0.price > 0) require(false, 'PoolAlreadyInitialized()');

        // initialize state
        state.epoch = 1;
        state.positionIdNext = 1;

        // check price bounds
        if (
            startPrice < constants.bounds.min ||
            startPrice >= constants.bounds.max
        ) require(false, 'StartPriceInvalid()');

        // initialize range ticks
        TickMap.set(
            rangeTickMap,
            ConstantProduct.minTick(constants.tickSpacing),
            constants.tickSpacing
        );
        TickMap.set(
            rangeTickMap,
            ConstantProduct.maxTick(constants.tickSpacing),
            constants.tickSpacing
        );

        // initialize limit ticks
        TickMap.set(
            limitTickMap,
            ConstantProduct.minTick(constants.tickSpacing),
            constants.tickSpacing
        );
        TickMap.set(
            limitTickMap,
            ConstantProduct.maxTick(constants.tickSpacing),
            constants.tickSpacing
        );

        // initialize price
        state.pool.price = startPrice;
        state.pool0.price = startPrice;
        state.pool1.price = startPrice;

        int24 startTick = ConstantProduct.getTickAtPrice(startPrice, constants);
        state.pool.tickAtPrice = startTick;
        state.pool0.tickAtPrice = startTick;
        state.pool1.tickAtPrice = startTick;

        // intialize samples
        state.pool = Samples.initialize(samples, state.pool);

        // emit standard event
        emit Initialize(
            startPrice,
            startTick
        );

        // emit custom event
        emit InitializeLimit(
            ConstantProduct.minTick(constants.tickSpacing),
            ConstantProduct.maxTick(constants.tickSpacing),
            startPrice,
            startTick
        );

        return state;
    }

    function swap(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.SwapParams memory params,
        PoolsharkStructs.SwapCache memory cache
    ) external returns (PoolsharkStructs.SwapCache memory) {
        cache.price = cache.state.pool.price;
        cache.crossTick = cache.state.pool.tickAtPrice;

        // set initial cross state
        cache = _iterate(
            ticks,
            rangeTickMap,
            limitTickMap,
            cache,
            params.zeroForOne,
            true
        );

        uint128 startLiquidity = cache.state.pool.liquidity;

        // grab sample for accumulators
        cache = PoolsharkStructs.SwapCache({
            state: cache.state,
            constants: cache.constants,
            price: cache.price,
            liquidity: cache.liquidity,
            amountLeft: params.amount,
            input: 0,
            output: 0,
            crossPrice: cache.crossPrice,
            secondsPerLiquidityAccum: 0,
            feeAmount: 0,
            tickSecondsAccum: 0,
            tickSecondsAccumBase: 0,
            crossTick: cache.crossTick,
            crossStatus: cache.crossStatus,
            limitActive: cache.limitActive,
            exactIn: params.exactIn,
            cross: true,
            averagePrice: 0
        });
        // grab latest price and sample
        (
            cache.averagePrice,
            cache.secondsPerLiquidityAccum,
            cache.tickSecondsAccum
        ) = Samples.getLatest(
            cache.state,
            cache.constants,
            cache.state.pool.liquidity
        );

        // grab latest sample and store in cache for _cross
        while (cache.cross) {
            // handle price being at cross tick
            cache = _quoteSingle(cache, params.priceLimit, params.zeroForOne);
            if (cache.cross) {
                cache = _cross(
                    ticks,
                    rangeTickMap,
                    limitTickMap,
                    cache,
                    params
                );
            }
        }
    
        /// @dev - write oracle entry after start of block
        (
            cache.state.pool.samples.index,
            cache.state.pool.samples.count
        ) = Samples.save(
            samples,
            cache.state.pool.samples,
            startLiquidity,
            cache.state.pool.tickAtPrice
        );

        // pool liquidity should be updated along the way
        cache.state.pool.price = cache.price.toUint160();

        if (cache.price != cache.crossPrice) {
            cache.state.pool.tickAtPrice = ConstantProduct.getTickAtPrice(
                cache.price.toUint160(),
                cache.constants
            );
        } else {
            cache.state.pool.tickAtPrice = cache.crossTick;
        }
        if (cache.limitActive) {
            if (params.zeroForOne) {
                cache.state.pool1.price = cache.state.pool.price;
                cache.state.pool1.tickAtPrice = cache.state.pool.tickAtPrice;
            } else {
                cache.state.pool0.price = cache.state.pool.price;
                cache.state.pool0.tickAtPrice = cache.state.pool.tickAtPrice;
            }
        }

        // emit standard event
        emit Swap(
            msg.sender,
            params.to,
            params.zeroForOne ? int256(cache.input) : -int256(cache.output),
            params.zeroForOne ? -int256(cache.output) : int256(cache.input),
            cache.state.pool.price,
            cache.liquidity.toUint128(),
            cache.state.pool.tickAtPrice
        );

        // emit custom event
        emit SwapLimit(
            params.to,
            cache.input,
            cache.output,
            cache.state.pool.feeGrowthGlobal0,
            cache.state.pool.feeGrowthGlobal1,
            cache.price.toUint160(),
            cache.liquidity.toUint128(),
            cache.feeAmount,
            cache.state.pool.tickAtPrice,
            params.zeroForOne,
            params.exactIn
        );

        return cache;
    }

    function quote(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.QuoteParams memory params,
        PoolsharkStructs.SwapCache memory cache
    )
        internal
        view
        returns (
            uint256,
            uint256,
            uint160
        )
    {
        // start with range price
        cache.price = cache.state.pool.price;
        cache.crossTick = cache.state.pool.tickAtPrice;

        cache = _iterate(
            ticks,
            rangeTickMap,
            limitTickMap,
            cache,
            params.zeroForOne,
            true
        );

        // set crossTick/crossPrice based on the best between limit and range
        // grab sample for accumulators
        cache = PoolsharkStructs.SwapCache({
            state: cache.state,
            constants: cache.constants,
            price: cache.price,
            liquidity: cache.liquidity,
            amountLeft: params.amount,
            input: 0,
            output: 0,
            crossPrice: cache.crossPrice,
            secondsPerLiquidityAccum: 0,
            feeAmount: 0,
            tickSecondsAccum: 0,
            tickSecondsAccumBase: 0,
            crossTick: cache.crossTick,
            crossStatus: cache.crossStatus,
            limitActive: cache.limitActive,
            exactIn: params.exactIn,
            cross: true,
            averagePrice: 0
        });
        
        // grab latest price and sample
        (
            cache.averagePrice,
            cache.secondsPerLiquidityAccum,
            cache.tickSecondsAccum
        ) = Samples.getLatest(
            cache.state,
            cache.constants,
            cache.state.pool.liquidity
        );

        while (cache.cross) {
            cache = _quoteSingle(cache, params.priceLimit, params.zeroForOne);
            if (cache.cross) {
                cache = _pass(ticks, rangeTickMap, limitTickMap, cache, params);
            }
        }

        return (cache.input, cache.output, cache.price.toUint160());
    }

    function _quoteSingle(
        PoolsharkStructs.SwapCache memory cache,
        uint160 priceLimit,
        bool zeroForOne
    ) internal view returns (PoolsharkStructs.SwapCache memory) {
        if (
            (
                zeroForOne
                    ? priceLimit >= cache.price
                    : priceLimit <= cache.price
            ) ||
            (zeroForOne && cache.price == cache.constants.bounds.min) ||
            (!zeroForOne && cache.price == cache.constants.bounds.max) ||
            (cache.amountLeft == 0 && cache.liquidity > 0)
        ) {
            cache.cross = false;
            return cache;
        }
        uint256 nextPrice = cache.crossPrice;
        uint256 amountIn;
        uint256 amountOut;
        if (zeroForOne) {
            // Trading token 0 (x) for token 1 (y).
            // price  is decreasing.
            if (nextPrice < priceLimit) {
                nextPrice = priceLimit;
            }
            uint256 amountMax = cache.exactIn
                ? ConstantProduct.getDx(
                    cache.liquidity,
                    nextPrice,
                    cache.price,
                    true
                )
                : ConstantProduct.getDy(
                    cache.liquidity,
                    nextPrice,
                    cache.price,
                    false
                );
            if (cache.amountLeft < amountMax) {
                // calculate price after swap
                uint256 newPrice = ConstantProduct.getNewPrice(
                    cache.price,
                    cache.liquidity,
                    cache.amountLeft,
                    zeroForOne,
                    cache.exactIn
                );
                if (newPrice < nextPrice)
                    require(false, 'NextPriceExceeded()');
                if (cache.exactIn) {
                    amountIn = cache.amountLeft;
                    amountOut = ConstantProduct.getDy(
                        cache.liquidity,
                        newPrice,
                        cache.price,
                        false
                    );
                } else {
                    amountIn = ConstantProduct.getDx(
                        cache.liquidity,
                        newPrice,
                        cache.price,
                        true
                    );
                    amountOut = cache.amountLeft;
                }
                cache.amountLeft = 0;
                cache.cross = false;
                cache.price = uint160(newPrice);
            } else {
                if (cache.exactIn) {
                    amountIn = amountMax;
                    amountOut = ConstantProduct.getDy(
                        cache.liquidity,
                        nextPrice,
                        cache.price,
                        false
                    );
                } else {
                    amountIn = ConstantProduct.getDx(
                        cache.liquidity,
                        nextPrice,
                        cache.price,
                        true
                    );
                    amountOut = amountMax;
                }
                cache.amountLeft -= amountMax;
                if (nextPrice == cache.crossPrice) cache.cross = true;
                else cache.cross = false;
                cache.price = uint160(nextPrice);
            }
        } else {
            // Price is increasing.
            if (nextPrice > priceLimit) {
                nextPrice = priceLimit;
            }
            uint256 amountMax = cache.exactIn
                ? ConstantProduct.getDy(
                    cache.liquidity,
                    cache.price,
                    nextPrice,
                    true
                )
                : ConstantProduct.getDx(
                    cache.liquidity,
                    cache.price,
                    nextPrice,
                    false
                );
            if (cache.amountLeft < amountMax) {
                uint256 newPrice = ConstantProduct.getNewPrice(
                    cache.price,
                    cache.liquidity,
                    cache.amountLeft,
                    zeroForOne,
                    cache.exactIn
                );
                if (newPrice > nextPrice)
                    require(false, 'NextPriceExceeded()');
                if (cache.exactIn) {
                    amountIn = cache.amountLeft;
                    amountOut = ConstantProduct.getDx(
                        cache.liquidity,
                        cache.price,
                        newPrice,
                        false
                    );
                } else {
                    amountIn = ConstantProduct.getDy(
                        cache.liquidity,
                        cache.price,
                        newPrice,
                        true
                    );
                    amountOut = cache.amountLeft;
                }
                cache.amountLeft = 0;
                cache.cross = false;
                cache.price = uint160(newPrice);
            } else {
                if (cache.exactIn) {
                    amountIn = amountMax;
                    amountOut = ConstantProduct.getDx(
                        cache.liquidity,
                        cache.price,
                        nextPrice,
                        false
                    );
                } else {
                    amountIn = ConstantProduct.getDy(
                        cache.liquidity,
                        cache.price,
                        nextPrice,
                        true
                    );
                    amountOut = amountMax;
                }
                cache.amountLeft -= amountMax;
                if (nextPrice == cache.crossPrice) cache.cross = true;
                else cache.cross = false;
                cache.price = uint160(nextPrice);
            }
        }
        cache = FeeMath.calculate(cache, amountIn, amountOut, zeroForOne);
        return cache;
    }

    function _cross(
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.SwapCache memory cache,
        PoolsharkStructs.SwapParams memory params
    ) internal returns (PoolsharkStructs.SwapCache memory) {
        // crossing range ticks
        if ((cache.crossStatus & RANGE_TICK) > 0) {
            // skip if crossing down and stopping at crossPrice
            if (
                !params.zeroForOne ||
                (cache.amountLeft > 0 && params.priceLimit < cache.crossPrice)
            ) {
                PoolsharkStructs.RangeTick memory crossTick = ticks[
                    cache.crossTick
                ].range;
                crossTick.feeGrowthOutside0 =
                    cache.state.pool.feeGrowthGlobal0 -
                    crossTick.feeGrowthOutside0;
                crossTick.feeGrowthOutside1 =
                    cache.state.pool.feeGrowthGlobal1 -
                    crossTick.feeGrowthOutside1;
                crossTick.tickSecondsAccumOutside =
                    cache.tickSecondsAccum -
                    crossTick.tickSecondsAccumOutside;
                crossTick.secondsPerLiquidityAccumOutside =
                    cache.secondsPerLiquidityAccum -
                    crossTick.secondsPerLiquidityAccumOutside;
                ticks[cache.crossTick].range = crossTick;
                int128 liquidityDelta = crossTick.liquidityDelta;
                // emit custom event
                emit SyncRangeTick(
                    crossTick.feeGrowthOutside0,
                    crossTick.feeGrowthOutside1,
                    cache.crossTick
                );
                if (params.zeroForOne) {
                    unchecked {
                        if (liquidityDelta >= 0) {
                            cache.liquidity -= uint128(liquidityDelta);
                            cache.state.pool.liquidity -= uint128(
                                liquidityDelta
                            );
                        } else {
                            cache.liquidity += uint128(-liquidityDelta);
                            cache.state.pool.liquidity += uint128(
                                -liquidityDelta
                            );
                        }
                    }
                } else {
                    unchecked {
                        if (liquidityDelta >= 0) {
                            cache.liquidity += uint128(liquidityDelta);
                            cache.state.pool.liquidity += uint128(
                                liquidityDelta
                            );
                        } else {
                            cache.liquidity -= uint128(-liquidityDelta);
                            cache.state.pool.liquidity -= uint128(
                                -liquidityDelta
                            );
                        }
                    }
                }
            } else {
                // skip crossing the tick
                cache.cross = false;
            }
        }
        // crossing limit tick
        if ((cache.crossStatus & LIMIT_TICK) > 0) {
            // cross limit tick
            EpochMap.set(
                cache.crossTick,
                !params.zeroForOne,
                cache.state.epoch,
                limitTickMap,
                cache.constants
            );
            int128 liquidityDelta = ticks[cache.crossTick].limit.liquidityDelta;

            if (liquidityDelta >= 0) {
                cache.liquidity += uint128(liquidityDelta);
                if (params.zeroForOne)
                    cache.state.pool1.liquidity += uint128(liquidityDelta);
                else cache.state.pool0.liquidity += uint128(liquidityDelta);
            } else {
                cache.liquidity -= uint128(-liquidityDelta);
                if (params.zeroForOne)
                    cache.state.pool1.liquidity -= uint128(-liquidityDelta);
                else cache.state.pool0.liquidity -= uint128(-liquidityDelta);
            }
            // zero out liquidityDelta and priceAt
            ticks[cache.crossTick].limit = PoolsharkStructs.LimitTick(0, 0, 0);
            LimitTicks.clear(
                ticks,
                cache.constants,
                limitTickMap,
                cache.crossTick
            );
            /// @dev - price and tickAtPrice updated at end of loop
        }
        if ((cache.crossStatus & LIMIT_POOL) > 0) {
            // add one-way liquidity
            uint128 liquidityDelta = params.zeroForOne
                ? cache.state.pool1.liquidity
                : cache.state.pool0.liquidity;
            if (liquidityDelta > 0) cache.liquidity += liquidityDelta;
        }
        if (cache.cross)
            cache = _iterate(
                ticks,
                rangeTickMap,
                limitTickMap,
                cache,
                params.zeroForOne,
                false
            );

        return cache;
    }

    function _pass(
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.SwapCache memory cache,
        PoolsharkStructs.QuoteParams memory params
    ) internal view returns (PoolsharkStructs.SwapCache memory) {
        if ((cache.crossStatus & RANGE_TICK) > 0) {
            if (
                !params.zeroForOne ||
                (cache.amountLeft > 0 && params.priceLimit < cache.crossPrice)
            ) {
                int128 liquidityDelta = ticks[cache.crossTick]
                    .range
                    .liquidityDelta;
                if (params.zeroForOne) {
                    unchecked {
                        if (liquidityDelta >= 0) {
                            cache.state.pool.liquidity -= uint128(
                                liquidityDelta
                            );
                        } else {
                            cache.state.pool.liquidity += uint128(
                                -liquidityDelta
                            );
                        }
                    }
                } else {
                    unchecked {
                        if (liquidityDelta >= 0) {
                            cache.state.pool.liquidity += uint128(
                                liquidityDelta
                            );
                        } else {
                            cache.state.pool.liquidity -= uint128(
                                -liquidityDelta
                            );
                        }
                    }
                }
            } else {
                cache.cross = false;
            }
        }
        if ((cache.crossStatus & LIMIT_TICK) > 0) {
            // cross limit tick
            int128 liquidityDelta = ticks[cache.crossTick].limit.liquidityDelta;

            if (liquidityDelta > 0) {
                cache.liquidity += uint128(liquidityDelta);
                if (params.zeroForOne)
                    cache.state.pool1.liquidity += uint128(liquidityDelta);
                else cache.state.pool0.liquidity += uint128(liquidityDelta);
            } else {
                cache.liquidity -= uint128(-liquidityDelta);
                if (params.zeroForOne) {
                    cache.state.pool1.liquidity -= uint128(-liquidityDelta);
                } else {
                    cache.state.pool0.liquidity -= uint128(-liquidityDelta);
                }
            }
        }
        if ((cache.crossStatus & LIMIT_POOL) > 0) {
            // add limit pool
            uint128 liquidityDelta = params.zeroForOne
                ? cache.state.pool1.liquidity
                : cache.state.pool0.liquidity;

            if (liquidityDelta > 0) {
                cache.liquidity += liquidityDelta;
            }
        }

        if (cache.cross)
            cache = _iterate(
                ticks,
                rangeTickMap,
                limitTickMap,
                cache,
                params.zeroForOne,
                false
            );

        return cache;
    }

    function _iterate(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.SwapCache memory cache,
        bool zeroForOne,
        bool inclusive
    ) internal view returns (PoolsharkStructs.SwapCache memory) {
        if (zeroForOne) {
            if (cache.price > cache.state.pool1.price) {
                // load range pool
                cache.limitActive = false;
                cache.liquidity = cache.state.pool.liquidity;
                (cache.crossTick, ) = TickMap.roundHalf(
                    cache.crossTick,
                    cache.constants,
                    cache.price
                );
                // next range tick vs. limit pool price
                cache.crossTick = TickMap.previous(
                    rangeTickMap,
                    cache.crossTick,
                    cache.constants.tickSpacing,
                    inclusive
                );
                cache.crossPrice = ConstantProduct.getPriceAtTick(
                    cache.crossTick,
                    cache.constants
                );
                if (cache.state.pool1.price >= cache.crossPrice) {
                    // cross into limit pool
                    cache.crossStatus = LIMIT_POOL;
                    if (cache.state.pool1.price == cache.crossPrice)
                        // also cross range tick
                        cache.crossStatus |= RANGE_TICK;
                    else {
                        cache.crossTick = cache.state.pool1.tickAtPrice;
                        cache.crossPrice = cache.state.pool1.price;
                    }
                } else {
                    // cross only range tick
                    cache.crossStatus = RANGE_TICK;
                }
            } else {
                // load range and limit pools
                cache.limitActive = true;
                cache.liquidity =
                    cache.state.pool.liquidity +
                    cache.state.pool1.liquidity;
                (cache.crossTick, ) = TickMap.roundHalf(
                    cache.crossTick,
                    cache.constants,
                    cache.price
                );
                int24 rangeTickAhead;
                int24 limitTickAhead;
                if (
                    cache.crossStatus == LIMIT_POOL &&
                    cache.crossTick % cache.constants.tickSpacing != 0 &&
                    TickMap.get(
                        limitTickMap,
                        cache.crossTick,
                        cache.constants.tickSpacing
                    )
                ) {
                    limitTickAhead = cache.crossTick;
                    rangeTickAhead =
                        cache.crossTick -
                        cache.constants.tickSpacing /
                        2;
                } else {
                    rangeTickAhead = TickMap.previous(
                        rangeTickMap,
                        cache.crossTick,
                        cache.constants.tickSpacing,
                        inclusive
                    );
                    limitTickAhead = TickMap.previous(
                        limitTickMap,
                        cache.crossTick,
                        cache.constants.tickSpacing,
                        inclusive
                    );
                }
                // next range tick vs. next limit tick

                if (rangeTickAhead >= limitTickAhead) {
                    cache.crossTick = rangeTickAhead;
                    // cross range tick
                    cache.crossStatus = RANGE_TICK;
                    if (rangeTickAhead == limitTickAhead)
                        // also cross limit tick
                        cache.crossStatus |= LIMIT_TICK;
                    cache.crossPrice = ConstantProduct.getPriceAtTick(
                        cache.crossTick,
                        cache.constants
                    );
                } else {
                    // only cross limit tick
                    cache.crossTick = limitTickAhead;
                    cache.crossStatus = LIMIT_TICK;
                    cache.crossPrice = ticks[cache.crossTick].limit.priceAt == 0
                        ? ConstantProduct.getPriceAtTick(
                            cache.crossTick,
                            cache.constants
                        )
                        : ticks[cache.crossTick].limit.priceAt;
                }
            }
        } else {
            if (cache.price < cache.state.pool0.price) {
                // load range pool
                cache.limitActive = false;
                cache.liquidity = cache.state.pool.liquidity;
                (cache.crossTick, ) = TickMap.roundHalf(
                    cache.crossTick,
                    cache.constants,
                    cache.price
                );
                // next range tick vs. limit pool price
                cache.crossTick = TickMap.next(
                    rangeTickMap,
                    cache.crossTick,
                    cache.constants.tickSpacing,
                    inclusive
                );
                cache.crossPrice = ConstantProduct.getPriceAtTick(
                    cache.crossTick,
                    cache.constants
                );
                if (cache.state.pool0.price <= cache.crossPrice) {
                    // cross into limit pool
                    cache.crossStatus = LIMIT_POOL;
                    if (cache.state.pool0.price == cache.crossPrice)
                        // also cross range tick
                        cache.crossStatus |= RANGE_TICK;
                    else {
                        cache.crossTick = cache.state.pool0.tickAtPrice;
                        cache.crossPrice = cache.state.pool0.price;
                    }
                } else {
                    // cross only range tick
                    cache.crossStatus = RANGE_TICK;
                }
            } else {
                // load range and limit pools
                cache.limitActive = true;
                cache.liquidity =
                    cache.state.pool.liquidity +
                    cache.state.pool0.liquidity;
                (cache.crossTick, ) = TickMap.roundHalf(
                    cache.crossTick,
                    cache.constants,
                    cache.price
                );
                // next range tick vs. next limit tick
                int24 rangeTickAhead;
                int24 limitTickAhead;
                if (
                    cache.crossStatus == LIMIT_POOL &&
                    cache.crossTick % cache.constants.tickSpacing != 0 &&
                    TickMap.get(
                        limitTickMap,
                        cache.crossTick,
                        cache.constants.tickSpacing
                    )
                ) {
                    limitTickAhead = cache.crossTick;
                    rangeTickAhead =
                        cache.crossTick +
                        cache.constants.tickSpacing /
                        2;
                } else {
                    rangeTickAhead = TickMap.next(
                        rangeTickMap,
                        cache.crossTick,
                        cache.constants.tickSpacing,
                        inclusive
                    );
                    limitTickAhead = TickMap.next(
                        limitTickMap,
                        cache.crossTick,
                        cache.constants.tickSpacing,
                        inclusive
                    );
                }
                if (rangeTickAhead <= limitTickAhead) {
                    cache.crossTick = rangeTickAhead;
                    // cross range tick
                    cache.crossStatus |= RANGE_TICK;
                    if (rangeTickAhead == limitTickAhead)
                        // also cross limit tick
                        cache.crossStatus |= LIMIT_TICK;
                    cache.crossPrice = ConstantProduct.getPriceAtTick(
                        cache.crossTick,
                        cache.constants
                    );
                } else {
                    // only cross limit tick
                    cache.crossTick = limitTickAhead;
                    cache.crossStatus |= LIMIT_TICK;
                    cache.crossPrice = ticks[cache.crossTick].limit.priceAt == 0
                        ? ConstantProduct.getPriceAtTick(
                            cache.crossTick,
                            cache.constants
                        )
                        : ticks[cache.crossTick].limit.priceAt;
                }
            }
        }
        return cache;
    }
}
