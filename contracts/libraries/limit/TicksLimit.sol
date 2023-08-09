// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../../interfaces/limit/ILimitPoolStructs.sol';
import '../../interfaces/limit/ILimitPoolFactory.sol';
import '../../base/structs/LimitPoolFactoryStructs.sol';
import '../../interfaces/limit/ILimitPool.sol';
import '../math/ConstantProduct.sol';
import './PositionsLimit.sol';
import '../math/OverflowMath.sol';
import '../TickMap.sol';
import './EpochMap.sol';
import '../utils/SafeCast.sol';
import 'hardhat/console.sol';

/// @notice Tick management library for limit pools
library TicksLimit {
    error LiquidityOverflow();
    error LiquidityUnderflow();
    error InvalidLowerTick();
    error InvalidUpperTick();
    error InvalidPositionAmount();
    error InvalidPositionBounds();

    using SafeCast for uint256;

    event InitializeLimit(
        int24 minTick,
        int24 maxTick,
        uint160 startPrice,
        int24 startTick
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

    // constants for crossing ticks / limit pools
    uint8 internal constant RANGE_TICK = 2**0;
    uint8 internal constant LIMIT_TICK = 2**1;
    uint8 internal constant LIMIT_POOL = 2**2;
    uint256 internal constant Q96 = 0x1000000000000000000000000;

    function initialize(
        PoolsharkStructs.TickMap storage tickMap,
        ILimitPoolStructs.GlobalState memory state,
        PoolsharkStructs.Immutables memory constants,
        uint160 startPrice
    ) external returns (
        ILimitPoolStructs.GlobalState memory
    ) {
        // state should only be initialized once
        if (state.pool0.price > 0) require (false, 'PoolAlreadyInitialized()');

        // initialize epoch
        state.epoch = 1;

        // check price bounds
        if (startPrice < constants.bounds.min || startPrice >= constants.bounds.max) require(false, 'StartPriceInvalid()');

        // initialize ticks
        TickMap.set(tickMap, ConstantProduct.minTick(constants.tickSpacing), constants.tickSpacing);
        TickMap.set(tickMap, ConstantProduct.maxTick(constants.tickSpacing), constants.tickSpacing);

        // initialize price
        state.pool0.price = startPrice;
        state.pool1.price = startPrice;

        int24 startTick = ConstantProduct.getTickAtPrice(startPrice, constants);
        state.pool0.tickAtPrice = startTick;
        state.pool1.tickAtPrice = startTick;

        // emit event
        emit InitializeLimit(
            ConstantProduct.minTick(constants.tickSpacing),
            ConstantProduct.maxTick(constants.tickSpacing),
            state.pool0.price,
            state.pool0.tickAtPrice
        );

        return state;
    }

    function validate(
        int24 lower,
        int24 upper,
        int24 tickSpacing
    ) internal pure {
        if (lower % tickSpacing != 0) require(false, 'InvalidLowerTick()');
        if (lower <= ConstantProduct.MIN_TICK) require(false, 'InvalidLowerTick()');
        if (upper % tickSpacing != 0) require(false, 'InvalidUpperTick()');
        if (upper >= ConstantProduct.MAX_TICK) require(false, 'InvalidUpperTick()');
        if (lower >= upper) require(false, 'InvalidPositionBounds()');
    }

    function swap(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.SwapParams memory params,
        PoolsharkStructs.SwapCache memory cache
    ) external returns (
        PoolsharkStructs.SwapCache memory
    )
    {   
        // start with range price
        cache.price = cache.state.pool.price;
        cache.crossTick = cache.state.pool.tickAtPrice;

        cache = _iterate(ticks, rangeTickMap, limitTickMap, cache, params.zeroForOne);
        
        // set crossTick/crossPrice based on the best between limit and range
        // grab sample for accumulators
        cache = PoolsharkStructs.SwapCache({
            state: cache.state,
            constants: cache.constants,
            price: cache.price,
            liquidity: cache.liquidity,
            amountLeft: params.amount,
            input:  0,
            output: 0,
            crossPrice: cache.crossPrice,
            secondsPerLiquidityAccum: 0,
            tickSecondsAccum: 0,
            crossTick: cache.crossTick,
            crossStatus: cache.crossStatus,
            limitActive: cache.limitActive,
            exactIn: params.exactIn,
            cross: true
        });

        // increment swap epoch
        cache.state.epoch += 1;
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
        // pool liquidity should be updated along the way
        cache.state.pool.price = cache.price.toUint160();

        if (cache.price != cache.crossPrice) {
            cache.state.pool.tickAtPrice = ConstantProduct.getTickAtPrice(cache.price.toUint160(), cache.constants);
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
        emit Swap(
            params.to,
            params.zeroForOne,
            cache.input,
            cache.output, /// @dev - subgraph will do math to compute fee amount
            cache.price.toUint160(),
            cache.liquidity.toUint128(),
            cache.state.pool.tickAtPrice
        );
        return cache;
    }

    function quote(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.QuoteParams memory params,
        PoolsharkStructs.SwapCache memory cache
    ) internal view returns (
        uint256,
        uint256,
        uint160
    ) {
        // start with range price
        cache.price = cache.state.pool.price;
        cache.crossTick = cache.state.pool.tickAtPrice;

        cache = _iterate(ticks, rangeTickMap, limitTickMap, cache, params.zeroForOne);
        
        // set crossTick/crossPrice based on the best between limit and range
        // grab sample for accumulators
        cache = PoolsharkStructs.SwapCache({
            state: cache.state,
            constants: cache.constants,
            price: cache.price,
            liquidity: cache.liquidity,
            amountLeft: params.amount,
            input:  0,
            output: 0,
            crossPrice: cache.crossPrice,
            secondsPerLiquidityAccum: 0,
            tickSecondsAccum: 0,
            crossTick: cache.crossTick,
            crossStatus: cache.crossStatus,
            limitActive: cache.limitActive,
            exactIn: params.exactIn,
            cross: true
        });

        while (cache.cross) {
            cache = _quoteSingle(cache, params.priceLimit, params.zeroForOne);
            if (cache.cross) {
                cache = _pass(
                    ticks,
                    rangeTickMap,
                    limitTickMap,
                    cache,
                    params
                );
            }
        }
        return (
            cache.input,
            cache.output,
            cache.price.toUint160()
        );
    }

    function _quoteSingle(
        PoolsharkStructs.SwapCache memory cache,
        uint160 priceLimit,
        bool zeroForOne
    ) internal pure returns (
        PoolsharkStructs.SwapCache memory
    ) {
        if ((zeroForOne ? priceLimit >= cache.price
                        : priceLimit <= cache.price) ||
            (zeroForOne && cache.price == cache.constants.bounds.min) ||
            (!zeroForOne && cache.price == cache.constants.bounds.max) ||
            cache.amountLeft == 0)
        {
            cache.cross = false;
            return cache;
        }
        uint256 nextPrice = cache.crossPrice;
        uint256 amountOut;
        if (zeroForOne) {
            // Trading token 0 (x) for token 1 (y).
            // price  is decreasing.
            if (nextPrice < priceLimit) {
                nextPrice = priceLimit;
            }
            uint256 amountMax = cache.exactIn ? ConstantProduct.getDx(cache.liquidity, nextPrice, cache.price, true)
                                              : ConstantProduct.getDy(cache.liquidity, nextPrice, cache.price, false);
            if (cache.amountLeft < amountMax) {
                // We can swap within the current range.
                uint256 liquidityPadded = uint256(cache.liquidity) << 96;
                // calculate price after swap
                uint256 newPrice;
                if (cache.exactIn) {
                    newPrice = OverflowMath.mulDivRoundingUp(
                        liquidityPadded,
                        cache.price,
                        liquidityPadded + uint256(cache.price) * uint256(cache.amountLeft)
                    );
                    amountOut = ConstantProduct.getDy(cache.liquidity, newPrice, uint256(cache.price), false);
                    cache.input += cache.amountLeft;
                } else {
                    newPrice = cache.price - 
                        OverflowMath.divRoundingUp(cache.amountLeft << 96, cache.liquidity);
                    amountOut = cache.amountLeft;
                    cache.input += ConstantProduct.getDx(cache.liquidity, newPrice, uint256(cache.price), true);
                }
                cache.amountLeft = 0;
                cache.cross = false;
                cache.price = uint160(newPrice);
            } else {
                if (cache.exactIn) {
                    amountOut = ConstantProduct.getDy(cache.liquidity, nextPrice, cache.price, false);
                    cache.input += amountMax;
                } else {
                    amountOut = amountMax;
                    cache.input += ConstantProduct.getDx(cache.liquidity, nextPrice, cache.price, true);
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
            uint256 amountMax = cache.exactIn ? ConstantProduct.getDy(cache.liquidity, uint256(cache.price), nextPrice, true)
                                              : ConstantProduct.getDx(cache.liquidity, uint256(cache.price), nextPrice, false);
            if (cache.amountLeft < amountMax) {
                uint256 newPrice;
                if (cache.exactIn) {
                    newPrice = cache.price +
                        OverflowMath.mulDiv(cache.amountLeft, Q96, cache.liquidity);
                    amountOut = ConstantProduct.getDx(cache.liquidity, cache.price, newPrice, false);
                    cache.input += cache.amountLeft;
                } else {
                    uint256 liquidityPadded = uint256(cache.liquidity) << 96;
                    newPrice = OverflowMath.mulDivRoundingUp(
                        liquidityPadded, 
                        cache.price,
                        liquidityPadded - uint256(cache.price) * cache.amountLeft
                    );
                    amountOut = cache.amountLeft;
                    cache.input += ConstantProduct.getDy(cache.liquidity, cache.price, newPrice, true);
                }
                cache.amountLeft = 0;
                cache.cross = false;
                cache.price = uint160(newPrice);
            } else {
                if (cache.exactIn) {
                    amountOut = ConstantProduct.getDx(cache.liquidity, cache.price, nextPrice, false);
                    cache.input += amountMax;
                } else {
                    amountOut = amountMax;
                    cache.input += ConstantProduct.getDy(cache.liquidity, cache.price, nextPrice, true);
                }
                cache.amountLeft -= amountMax;
                if (nextPrice == cache.crossPrice) cache.cross = true;
                else cache.cross = false;
                cache.price = uint160(nextPrice);
            }
        }
        //TODO: calculate fee based on rangepool liquidity
        cache.output += amountOut;
        return cache;
    }

    function unlock(
        ILimitPoolStructs.MintLimitCache memory cache,
        PoolsharkStructs.LimitPoolState memory pool,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        bool zeroForOne
    ) internal returns (
        ILimitPoolStructs.MintLimitCache memory,
        PoolsharkStructs.LimitPoolState memory
    )
    {
        if (pool.liquidity > 0) return (cache, pool);

        (int24 startTick,) = TickMap.roundHalf(pool.tickAtPrice, cache.constants, pool.price);

        if (zeroForOne) {
            pool.tickAtPrice = TickMap.next(tickMap, startTick, cache.constants.tickSpacing, true);
            if (pool.tickAtPrice < ConstantProduct.maxTick(cache.constants.tickSpacing)) {
                EpochMap.set(pool.tickAtPrice, cache.state.epoch, tickMap, cache.constants);
            }
        } else {
            /// @dev - roundedUp true since liquidity could be equal to the current pool tickAtPrice
            pool.tickAtPrice = TickMap.previous(tickMap, startTick, cache.constants.tickSpacing, true);
            if (pool.tickAtPrice > ConstantProduct.minTick(cache.constants.tickSpacing)) {
                EpochMap.set(pool.tickAtPrice, cache.state.epoch, tickMap, cache.constants);
            }
        }

        // increment pool liquidity
        pool.liquidity += uint128(ticks[pool.tickAtPrice].limit.liquidityDelta);
        int24 tickToClear = pool.tickAtPrice;
        uint160 tickPriceAt = ticks[pool.tickAtPrice].limit.priceAt;

        if (tickPriceAt == 0) {
            // if full tick crossed
            pool.price = ConstantProduct.getPriceAtTick(pool.tickAtPrice, cache.constants);
        } else {
            // if half tick crossed
            pool.price = tickPriceAt;
            pool.tickAtPrice = ConstantProduct.getTickAtPrice(tickPriceAt, cache.constants);
        }

        // zero out tick
        ticks[tickToClear].limit.liquidityDelta = 0;
        TicksLimit.clear(ticks, cache.constants, tickMap, tickToClear);

        return (cache, pool);
    }

    function _cross(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.SwapCache memory cache,
        PoolsharkStructs.SwapParams memory params
    ) internal returns (
        PoolsharkStructs.SwapCache memory
    ) {
        if ((cache.crossStatus & LIMIT_TICK) > 0) {
            // cross limit tick
            EpochMap.set(cache.crossTick, cache.state.epoch, limitTickMap, cache.constants);
            int128 liquidityDelta = ticks[cache.crossTick].limit.liquidityDelta;

            if (liquidityDelta > 0) {
                cache.liquidity += uint128(liquidityDelta);
                if (params.zeroForOne) cache.state.pool1.liquidity += uint128(liquidityDelta);
                else cache.state.pool0.liquidity += uint128(liquidityDelta);
            } 
            else {
                cache.liquidity -= uint128(-liquidityDelta);
                if (params.zeroForOne) {
                    cache.state.pool1.liquidity -= uint128(-liquidityDelta);
                } else {
                    cache.state.pool0.liquidity -= uint128(-liquidityDelta);
                }
            }
            // zero out liquidityDelta and priceAt
            ticks[cache.crossTick].limit = PoolsharkStructs.LimitTick(0,0);
            clear(ticks, cache.constants, limitTickMap, cache.crossTick);
            /// @dev - price and tickAtPrice updated at end of loop
        }

        cache = _iterate(ticks, rangeTickMap, limitTickMap, cache, params.zeroForOne);

        //TODO: handle crossing range ticks as well and limit pool
        return cache;
    }

    function _pass(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.SwapCache memory cache,
        PoolsharkStructs.QuoteParams memory params
    ) internal view returns (
        PoolsharkStructs.SwapCache memory
    ) {
        if ((cache.crossStatus & LIMIT_TICK) > 0) {
            // cross limit tick
            int128 liquidityDelta = ticks[cache.crossTick].limit.liquidityDelta;

            if (liquidityDelta > 0) {
                cache.liquidity += uint128(liquidityDelta);
                if (params.zeroForOne) cache.state.pool1.liquidity += uint128(liquidityDelta);
                else cache.state.pool0.liquidity += uint128(liquidityDelta);
            } 
            else {
                cache.liquidity -= uint128(-liquidityDelta);
                if (params.zeroForOne) {
                    cache.state.pool1.liquidity -= uint128(-liquidityDelta);
                } else {
                    cache.state.pool0.liquidity -= uint128(-liquidityDelta);
                }
            }
            /// @dev - price and tickAtPrice updated at end of loop
        }
        cache = _iterate(ticks, rangeTickMap, limitTickMap, cache, params.zeroForOne);

        return cache;
    }

    function _iterate(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.SwapCache memory cache,
        bool zeroForOne
    ) internal view returns (
        PoolsharkStructs.SwapCache memory 
    )    
    {
        if (zeroForOne) {
            if (cache.price > cache.state.pool1.price) {
                // load range pool
                cache.limitActive = false;
                cache.liquidity = cache.state.pool.liquidity;
                (cache.crossTick,) = TickMap.roundHalf(cache.crossTick, cache.constants, cache.price);
                // next range tick vs. limit pool price
                cache.crossTick = TickMap.previous(rangeTickMap, cache.crossTick, cache.constants.tickSpacing, true);
                cache.crossPrice = ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants);
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
                }
                else {
                    // cross only range tick
                    cache.crossStatus = RANGE_TICK;
                }
            } else {
                // load range and limit pools
                cache.limitActive = true;
                cache.liquidity = cache.state.pool.liquidity + cache.state.pool1.liquidity;
                (cache.crossTick,) = TickMap.roundHalf(cache.crossTick, cache.constants, cache.price);
                // next range tick vs. next limit tick
                int24 rangeTickAhead = TickMap.previous(rangeTickMap, cache.crossTick, cache.constants.tickSpacing, true);
                int24 limitTickAhead = TickMap.previous(limitTickMap, cache.crossTick, cache.constants.tickSpacing, true);
                if (rangeTickAhead >= limitTickAhead) {
                    cache.crossTick = rangeTickAhead;
                    // cross range tick
                    cache.crossStatus = RANGE_TICK;
                    if (rangeTickAhead == limitTickAhead)
                        // also cross limit tick
                        cache.crossStatus |= LIMIT_TICK;
                    cache.crossPrice = ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants);
                    //TODO: if we're at cross price we should have already added the liquidity for pool1 on mint
                } else {
                    // only cross limit tick
                    cache.crossTick = limitTickAhead;
                    cache.crossStatus = LIMIT_TICK;
                    cache.crossPrice = ticks[cache.crossTick].limit.priceAt == 0 ? ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants)
                                                                                 : ticks[cache.crossTick].limit.priceAt;
                }
            }
        } else {
            if (cache.price < cache.state.pool0.price) {
                // load range pool
                cache.limitActive = false;
                cache.liquidity = cache.state.pool.liquidity;
                (cache.crossTick,) = TickMap.roundHalf(cache.crossTick, cache.constants, cache.price);
                // next range tick vs. limit pool price
                cache.crossTick = TickMap.next(rangeTickMap, cache.crossTick, cache.constants.tickSpacing, true);
                cache.crossPrice = ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants);
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
                }
                else {
                    // cross only range tick
                    cache.crossStatus = RANGE_TICK;
                }
            } else {
                // load range and limit pools
                cache.limitActive = true;
                cache.liquidity = cache.state.pool.liquidity + cache.state.pool0.liquidity;
                (cache.crossTick,) = TickMap.roundHalf(cache.crossTick, cache.constants, cache.price);
                // next range tick vs. next limit tick
                int24 rangeTickAhead = TickMap.next(rangeTickMap, cache.crossTick, cache.constants.tickSpacing, true);
                int24 limitTickAhead = TickMap.next(limitTickMap, cache.crossTick, cache.constants.tickSpacing, true);
                if (rangeTickAhead <= limitTickAhead) {
                    cache.crossTick = rangeTickAhead;
                    // cross range tick
                    cache.crossStatus |= RANGE_TICK;
                    if (rangeTickAhead == limitTickAhead)
                        // also cross limit tick
                        cache.crossStatus |= LIMIT_TICK;
                    cache.crossPrice = ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants);
                } else {
                    // only cross limit tick
                    cache.crossTick = limitTickAhead;
                    cache.crossStatus |= LIMIT_TICK;
                    cache.crossPrice = ticks[cache.crossTick].limit.priceAt == 0 ? ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants)
                                                                                 : ticks[cache.crossTick].limit.priceAt;
                }
            }
        }
        return cache;
    }
    
    function insert(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        ILimitPoolStructs.MintLimitCache memory cache,
        ILimitPoolStructs.MintLimitParams memory params
    ) internal {
        /// @auditor - validation of ticks is in Positions.validate
        if (cache.liquidityMinted > (uint128(type(int128).max) - cache.state.liquidityGlobal) )
            require (false, 'LiquidityOverflow()');

        int256 liquidityMinted = int256(cache.liquidityMinted);

        // check if adding liquidity necessary
        if (!params.zeroForOne || cache.priceLower > cache.pool.price) {
            // sets bit in map
            if(!TickMap.set(tickMap, params.lower, cache.constants.tickSpacing)){
                // inherit epoch 
                int24 tickAhead;
                if (params.zeroForOne) {
                    tickAhead  = TickMap.next(tickMap, params.lower, cache.constants.tickSpacing, false);
                } else {
                    tickAhead  = TickMap.previous(tickMap, params.lower, cache.constants.tickSpacing, false);
                }
                uint32 epochAhead = EpochMap.get(tickAhead, tickMap, cache.constants);
                EpochMap.set(params.lower, epochAhead, tickMap, cache.constants);
            }
            PoolsharkStructs.LimitTick memory tickLower = ticks[params.lower].limit;
            if (params.zeroForOne) {
                tickLower.liquidityDelta += int128(liquidityMinted);
            } else {
                tickLower.liquidityDelta -= int128(liquidityMinted);
            }
            ticks[params.lower].limit = tickLower;
        } else {
            /// @dev - i.e. if zeroForOne && cache.priceLower <= cache.pool.price
            cache.state.epoch += 1;
            // mark epoch on undercut tick
            EpochMap.set(params.lower, cache.state.epoch, tickMap, cache.constants);
        }

        if (params.zeroForOne || cache.priceUpper < cache.pool.price) {
            if(!TickMap.set(tickMap, params.upper, cache.constants.tickSpacing)) {
                int24 tickAhead;
                if (params.zeroForOne) {
                    tickAhead  = TickMap.next(tickMap, params.upper, cache.constants.tickSpacing, false);
                } else {
                    tickAhead  = TickMap.previous(tickMap, params.upper, cache.constants.tickSpacing, false);
                }
                uint32 epochAhead = EpochMap.get(tickAhead, tickMap, cache.constants);
                EpochMap.set(params.upper, epochAhead, tickMap, cache.constants);
            }
            PoolsharkStructs.LimitTick memory tickUpper = ticks[params.upper].limit;
            if (params.zeroForOne) {
                tickUpper.liquidityDelta -= int128(liquidityMinted);
            } else {
                tickUpper.liquidityDelta += int128(liquidityMinted);
            }
            ticks[params.upper].limit = tickUpper;
        } else {
            /// @dev - i.e. if !zeroForOne && cache.priceUpper >= cache.pool.price
            cache.state.epoch += 1;
            // mark epoch on undercut tick
            EpochMap.set(params.upper, cache.state.epoch, tickMap, cache.constants);
        }
    }

    function insertSingle(
        ILimitPoolStructs.MintLimitParams memory params,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        ILimitPoolStructs.MintLimitCache memory cache,
        PoolsharkStructs.LimitPoolState memory pool,
        PoolsharkStructs.Immutables memory constants
    ) internal returns (
        PoolsharkStructs.LimitPoolState memory
    ){
        /// @auditor - would be smart to protect against the case of epochs crossing
        (
            int24 tickToSave,
            uint160 roundedPrice
        ) = TickMap.roundHalf(pool.tickAtPrice, constants, pool.price);
        // update tick to save
        ILimitPoolStructs.LimitTick memory tick = ticks[tickToSave].limit;
        /// @auditor - tick.priceAt will be zero for tick % tickSpacing == 0
        if (tick.priceAt == 0) {
            if (pool.price != (params.zeroForOne ? cache.priceLower : cache.priceUpper)) {
                TickMap.set(tickMap, tickToSave, constants.tickSpacing);
            }
            EpochMap.set(tickToSave, cache.state.epoch, tickMap, constants);
        }
        // skip if we are at the nearest full tick
        if(pool.price != roundedPrice) {
            // if empty just save the pool price
            if (tick.priceAt == 0) {
                tick.priceAt = pool.price;
            }
            else {
                //TODO: set in tickMap for safety
                // we need to blend the two partial fills into a single tick
                ILimitPoolStructs.InsertSingleLocals memory locals;
                if (params.zeroForOne) {
                    // 0 -> 1 positions price moves up so nextFullTick is greater
                    locals.previousFullTick = tickToSave - constants.tickSpacing / 2;
                    locals.pricePrevious = ConstantProduct.getPriceAtTick(locals.previousFullTick, constants);
                    // calculate amountOut filled across both partial fills
                    locals.amountOutExact = ConstantProduct.getDy(pool.liquidity, locals.pricePrevious, pool.price, false);
                    locals.amountOutExact += ConstantProduct.getDy(uint128(tick.liquidityDelta), locals.pricePrevious, tick.priceAt, false);
                    uint128 combinedLiquidity = pool.liquidity + uint128(tick.liquidityDelta);
                    /// @auditor - the opposing amount calculated is off by 1/100 millionth
                    ///            (i.e. since we're using exactOut we lose precision on exactInput amount)
                    ///            the expected dy to the next tick is either exact or slightly more
                    ///            the expected dx to the next tick is 1/100 millionth less after the blend
                    // advance price past closest full tick using amountOut filled
                    tick.priceAt = ConstantProduct.getNewPrice(uint256(locals.pricePrevious), combinedLiquidity, locals.amountOutExact, false, true).toUint160();
                    // dx to the next tick is less than before the tick blend
                    EpochMap.set(tickToSave, cache.state.epoch, tickMap, constants);
                } else {
                    // 0 -> 1 positions price moves up so nextFullTick is lesser
                    locals.previousFullTick = tickToSave + constants.tickSpacing / 2;
                    locals.pricePrevious = ConstantProduct.getPriceAtTick(locals.previousFullTick, constants);
                    // calculate amountOut filled across both partial fills
                    locals.amountOutExact = ConstantProduct.getDx(pool.liquidity, pool.price, locals.pricePrevious, false);
                    locals.amountOutExact += ConstantProduct.getDx(uint128(tick.liquidityDelta), tick.priceAt, locals.pricePrevious, false);
                    // add current pool liquidity to partial tick
                    uint128 combinedLiquidity = pool.liquidity + uint128(tick.liquidityDelta);
                    // advance price past closest full tick using amountOut filled
                    tick.priceAt = ConstantProduct.getNewPrice(uint256(locals.pricePrevious), combinedLiquidity, locals.amountOutExact, true, true).toUint160();
                    // mark epoch for second partial fill positions
                    EpochMap.set(tickToSave, cache.state.epoch, tickMap, constants);
                }
            }
        }
        // invariant => if we save liquidity to tick clear pool liquidity
        if ((tickToSave != (params.zeroForOne ? params.lower : params.upper))) {
            tick.liquidityDelta += int128(pool.liquidity);
            pool.liquidity = 0;
        }
        ticks[tickToSave].limit = tick;
        return pool;
    }

    function remove(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        ILimitPoolStructs.UpdateCache memory cache,
        ILimitPoolStructs.UpdateLimitParams memory params,
        PoolsharkStructs.Immutables memory constants
    ) internal {
        // set ticks based on claim and zeroForOne
        int24 lower = params.zeroForOne ? params.claim : params.lower;
        int24 upper = params.zeroForOne ? params.upper : params.claim;
        {    
            PoolsharkStructs.LimitTick memory tickLower = ticks[lower].limit;
            
            if (cache.removeLower) {
                if (params.zeroForOne) {
                    tickLower.liquidityDelta -= int128(params.amount);
                } else {
                    tickLower.liquidityDelta += int128(params.amount);
                }
                ticks[lower].limit = tickLower;
            }
            clear(ticks, constants, tickMap, lower);
        }
        {
            PoolsharkStructs.LimitTick memory tickUpper = ticks[upper].limit;
            if (cache.removeUpper) {
                if (params.zeroForOne) {
                    tickUpper.liquidityDelta += int128(params.amount);
                } else {
                    tickUpper.liquidityDelta -= int128(params.amount);
                }
                ticks[upper].limit = tickUpper;
            }
            clear(ticks, constants, tickMap, upper);
        }
    }

    function clear(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.Immutables memory constants,
        PoolsharkStructs.TickMap storage tickMap,
        int24 tickToClear
    ) internal {
        if (_empty(ticks[tickToClear])) {
            if (tickToClear != ConstantProduct.maxTick(constants.tickSpacing) &&
                tickToClear != ConstantProduct.minTick(constants.tickSpacing)) {
                ticks[tickToClear].limit = PoolsharkStructs.LimitTick(0,0);
                TickMap.unset(tickMap, tickToClear, constants.tickSpacing);
            }
        }
    }

    function _empty(
        ILimitPoolStructs.Tick memory tick
    ) internal pure returns (
        bool
    ) {
        if (tick.limit.liquidityDelta != 0) {
            return false;
        }
        return true;
    }
}
