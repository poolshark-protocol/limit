// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../interfaces/ILimitPoolStructs.sol';
import '../interfaces/ILimitPoolFactory.sol';
import '../base/structs/LimitPoolFactoryStructs.sol';
import '../interfaces/ILimitPool.sol';
import './math/ConstantProduct.sol';
import './Positions.sol';
import './math/OverflowMath.sol';
import './TickMap.sol';
import './EpochMap.sol';
import './utils/SafeCast.sol';

/// @notice Tick management library
library Ticks {
    error LiquidityOverflow();
    error LiquidityUnderflow();
    error InvalidLowerTick();
    error InvalidUpperTick();
    error InvalidPositionAmount();
    error InvalidPositionBounds();

    using SafeCast for uint256;

    event Initialize(
        int24 minTick,
        int24 maxTick,
        uint160 startPrice
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

    function initialize(
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.PoolState storage pool0,
        ILimitPoolStructs.PoolState storage pool1,
        ILimitPoolStructs.GlobalState memory state,
        LimitPoolFactoryStructs.LimitPoolParams memory params
    ) external returns (
        ILimitPoolStructs.GlobalState memory
    ) {
        // initialize epoch
        pool0.swapEpoch = 1;
        pool1.swapEpoch = 1;

        // check price bounds
        ILimitPoolStructs.Immutables memory constants;
        (constants.bounds.min, constants.bounds.max) = ConstantProduct.priceBounds(params.tickSpacing);
        if (params.startPrice < constants.bounds.min || params.startPrice >= constants.bounds.max) require(false, 'StartPriceInvalid()');

        // initialize ticks
        TickMap.set(tickMap, ConstantProduct.minTick(params.tickSpacing), params.tickSpacing);
        TickMap.set(tickMap, ConstantProduct.maxTick(params.tickSpacing), params.tickSpacing);

        // initialize price
        pool0.price = params.startPrice;
        pool1.price = params.startPrice;

        constants.tickSpacing = params.tickSpacing;
        int24 startTick = ConstantProduct.getTickAtPrice(params.startPrice, constants);
        pool0.tickAtPrice = startTick;
        pool1.tickAtPrice = startTick;

        // emit event
        emit Initialize(
            ConstantProduct.minTick(params.tickSpacing),
            ConstantProduct.maxTick(params.tickSpacing),
            pool0.price
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
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.SwapParams memory params,
        ILimitPoolStructs.SwapCache memory cache,
        ILimitPoolStructs.PoolState memory pool
    ) internal returns (
            ILimitPoolStructs.PoolState memory,
            ILimitPoolStructs.SwapCache memory
        )
    {
        (cache.crossTick,) = TickMap.roundHalf(pool.tickAtPrice, cache.constants, pool.price);
        cache = ILimitPoolStructs.SwapCache({
            state: cache.state,
            constants: cache.constants,
            pool: cache.pool,
            price: pool.price,
            liquidity: pool.liquidity,
            cross: true,
            crossTick: params.zeroForOne ? TickMap.previous(tickMap, cache.crossTick, cache.constants.tickSpacing, true) 
                                         : TickMap.next(tickMap, cache.crossTick, cache.constants.tickSpacing, true),
            crossPrice: 0,
            input:  0,
            output: 0,
            exactIn: params.exactIn,
            amountLeft: params.amount
        });

        // increment swap epoch
        cache.pool.swapEpoch += 1;
        // grab latest sample and store in cache for _cross
        while (cache.cross) {
            cache.crossPrice = ticks[cache.crossTick].priceAt == 0 ? 
                                    ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants)
                                  : ticks[cache.crossTick].priceAt;
            // handle price being at cross tick
            if (params.zeroForOne && pool.price == cache.crossPrice) {
                cache.crossTick = TickMap.previous(tickMap, pool.tickAtPrice, cache.constants.tickSpacing, false);
                cache.crossPrice = ticks[cache.crossTick].priceAt == 0 ? 
                                    ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants)
                                  : ticks[cache.crossTick].priceAt;

            }
            (pool, cache) = _quoteSingle(pool, cache, params.priceLimit, params.zeroForOne);
            if (cache.cross) {
                (pool, cache) = _cross(
                    ticks,
                    tickMap,
                    pool,
                    cache,
                    params.zeroForOne
                );
            }
        }
        pool.price = cache.price.toUint160();
        pool.liquidity = cache.liquidity.toUint128();

        if (cache.price != cache.crossPrice) {
            pool.tickAtPrice = ConstantProduct.getTickAtPrice(pool.price, cache.constants);
        } else {
            pool.tickAtPrice = cache.crossTick;
        }
        emit Swap(
            params.to,
            params.zeroForOne,
            cache.input,
            cache.output, /// @dev - subgraph will do math to compute fee amount
            pool.price,
            pool.liquidity,
            pool.tickAtPrice
        );
        return (pool, cache);
    }

    function quote(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.QuoteParams memory params,
        ILimitPoolStructs.SwapCache memory cache,
        ILimitPoolStructs.PoolState memory pool
    ) internal view returns (
        uint256,
        uint256,
        uint160
    ) {
        (cache.crossTick,) = TickMap.roundHalf(pool.tickAtPrice, cache.constants, pool.price);
        cache = ILimitPoolStructs.SwapCache({
            state: cache.state,
            constants: cache.constants,
            pool: cache.pool,
            price: pool.price,
            liquidity: pool.liquidity,
            cross: true,
            crossTick: params.zeroForOne ? TickMap.previous(tickMap, cache.crossTick, cache.constants.tickSpacing, true) 
                                         : TickMap.next(tickMap, cache.crossTick, cache.constants.tickSpacing, true),
            crossPrice: 0,
            input:  0,
            output: 0,
            exactIn: params.exactIn,
            amountLeft: params.amount
        });
        while (cache.cross) {
            cache.crossPrice = ticks[cache.crossTick].priceAt == 0 ? 
                                 ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants)
                               : ticks[cache.crossTick].priceAt;
            // handle price being at cross tick
            if (params.zeroForOne && pool.price == cache.crossPrice) {
                cache.crossTick = TickMap.previous(tickMap, pool.tickAtPrice, cache.constants.tickSpacing, false);
                cache.crossPrice = ticks[cache.crossTick].priceAt == 0 ? 
                                    ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants)
                                  : ticks[cache.crossTick].priceAt;
            }
            (pool, cache) = _quoteSingle(pool, cache, params.priceLimit, params.zeroForOne);
            if (cache.cross) {
                (pool, cache) = _pass(
                    ticks,
                    tickMap,
                    pool,
                    cache,
                    params.zeroForOne
                );
            }
        }
        return (
            cache.input,
            cache.output,
            uint160(cache.price)
        );
    }

    function _quoteSingle(
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.SwapCache memory cache,
        uint160 priceLimit,
        bool zeroForOne
    ) internal pure returns (
        ILimitPoolStructs.PoolState memory,
        ILimitPoolStructs.SwapCache memory
    ) {
        if ((zeroForOne ? priceLimit >= cache.price
                        : priceLimit <= cache.price) ||
            (zeroForOne && cache.price == cache.constants.bounds.min) ||
            (!zeroForOne && cache.price == cache.constants.bounds.max) ||
            cache.amountLeft == 0)
        {
            cache.cross = false;
            return (pool, cache);
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
                if (nextPrice == cache.crossPrice) { cache.cross = true; }
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
                if (nextPrice == cache.crossPrice) { cache.cross = true; }
                else cache.cross = false;
                cache.price = uint160(nextPrice);
            }
        }
        cache.output += amountOut;
        return (pool, cache);
    }

    function unlock(
        ILimitPoolStructs.MintCache memory cache,
        ILimitPoolStructs.PoolState memory pool,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        bool zeroForOne
    ) internal returns (
        ILimitPoolStructs.MintCache memory,
        ILimitPoolStructs.PoolState memory
    )
    {
        if (pool.liquidity > 0) return (cache, pool);

        (int24 startTick,) = TickMap.roundHalf(pool.tickAtPrice, cache.constants, pool.price);

        if (zeroForOne) {
            pool.tickAtPrice = TickMap.next(tickMap, startTick, cache.constants.tickSpacing, true);
            if (pool.tickAtPrice < ConstantProduct.maxTick(cache.constants.tickSpacing)) {
                EpochMap.set(pool.tickAtPrice, pool.swapEpoch, tickMap, cache.constants);
            }
        } else {
            /// @dev - roundedUp true since liquidity could be equal to the current pool tickAtPrice
            pool.tickAtPrice = TickMap.previous(tickMap, startTick, cache.constants.tickSpacing, true);
            if (pool.tickAtPrice > ConstantProduct.minTick(cache.constants.tickSpacing)) {
                EpochMap.set(pool.tickAtPrice, pool.swapEpoch, tickMap, cache.constants);
            }
        }

        // increment pool liquidity
        pool.liquidity += uint128(ticks[pool.tickAtPrice].liquidityDelta);
        int24 tickToClear = pool.tickAtPrice;
        uint160 tickPriceAt = ticks[pool.tickAtPrice].priceAt;

        if (tickPriceAt == 0) {
            // if full tick crossed
            pool.price = ConstantProduct.getPriceAtTick(pool.tickAtPrice, cache.constants);
        } else {
            // if half tick crossed
            pool.price = tickPriceAt;
            pool.tickAtPrice = ConstantProduct.getTickAtPrice(tickPriceAt, cache.constants);
        }

        // zero out tick
        ticks[tickToClear].liquidityDelta = 0;
        Ticks.clear(ticks, cache.constants, tickMap, tickToClear);

        return (cache, pool);
    }

    function _cross(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.SwapCache memory cache,
        bool zeroForOne
    ) internal returns (
        ILimitPoolStructs.PoolState memory,
        ILimitPoolStructs.SwapCache memory
    ) {
        EpochMap.set(cache.crossTick, cache.pool.swapEpoch, tickMap, cache.constants);
        int128 liquidityDelta = ticks[cache.crossTick].liquidityDelta;

        if (liquidityDelta > 0) cache.liquidity += uint128(liquidityDelta);
        else cache.liquidity -= uint128(-liquidityDelta);
        pool.tickAtPrice = cache.crossTick;

        // zero out liquidityDelta and priceAt
        ticks[cache.crossTick] = ILimitPoolStructs.Tick(0,0);
        clear(ticks, cache.constants, tickMap, cache.crossTick);
        if (zeroForOne) {
            cache.crossTick = TickMap.previous(tickMap, cache.crossTick, cache.constants.tickSpacing, false);
        } else {
            cache.crossTick = TickMap.next(tickMap, cache.crossTick, cache.constants.tickSpacing, false);
        }
        return (pool, cache);
    }

    function _pass(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.SwapCache memory cache,
        bool zeroForOne
    ) internal view returns (
        ILimitPoolStructs.PoolState memory,
        ILimitPoolStructs.SwapCache memory
    ) {
        int128 liquidityDelta = ticks[cache.crossTick].liquidityDelta;
        if (liquidityDelta > 0) cache.liquidity += uint128(liquidityDelta);
        else cache.liquidity -= uint128(-liquidityDelta);
        if (zeroForOne) {
            cache.crossTick = TickMap.previous(tickMap, cache.crossTick, cache.constants.tickSpacing, false);
        } else {
            cache.crossTick = TickMap.next(tickMap, cache.crossTick, cache.constants.tickSpacing, false);
        }
        return (pool, cache);
    }
    
    function insert(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.MintCache memory cache,
        ILimitPoolStructs.MintParams memory params
    ) internal {
        /// @auditor - validation of ticks is in Positions.validate
        if (cache.liquidityMinted > (uint128(type(int128).max) - cache.pool.liquidityGlobal) )
            require (false, 'LiquidityOverflow()');

        int256 liquidityMinted = int256(cache.liquidityMinted);

        // check if adding liquidity necessary
        if (!params.zeroForOne || cache.priceLower > cache.pool.price) {
            // sets bit in map
            TickMap.set(tickMap, params.lower, cache.constants.tickSpacing);
            ILimitPoolStructs.Tick memory tickLower = ticks[params.lower];
            if (params.zeroForOne) {
                tickLower.liquidityDelta += int128(liquidityMinted);
            } else {
                tickLower.liquidityDelta -= int128(liquidityMinted);
            }
            ticks[params.lower] = tickLower;
        }

        if (params.zeroForOne || cache.priceUpper < cache.pool.price) {
            TickMap.set(tickMap, params.upper, cache.constants.tickSpacing);
            ILimitPoolStructs.Tick memory tickUpper = ticks[params.upper];
            if (params.zeroForOne) {
                tickUpper.liquidityDelta -= int128(liquidityMinted);
            } else {
                tickUpper.liquidityDelta += int128(liquidityMinted);
            }
            ticks[params.upper] = tickUpper;
        }
    }

    function insertSingle(
        ILimitPoolStructs.MintParams memory params,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.MintCache memory cache,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.Immutables memory constants
    ) internal returns (
        ILimitPoolStructs.PoolState memory
    ){
        /// @auditor - would be smart to protect against the case of epochs crossing
        (
            int24 tickToSave,
            uint160 roundedPrice
        ) = TickMap.roundHalf(pool.tickAtPrice, constants, pool.price);

        // update tick to save
        ILimitPoolStructs.Tick memory tick = ticks[tickToSave];
        /// @auditor - tick.priceAt will be zero for tick % tickSpacing == 0
        if (tick.priceAt == 0) {
            if (pool.price != (params.zeroForOne ? cache.priceLower : cache.priceUpper)) {
                TickMap.set(tickMap, tickToSave, constants.tickSpacing);
            }
            EpochMap.set(tickToSave, pool.swapEpoch, tickMap, constants);
        }
        // skip if we are at the nearest full tick
        if(pool.price != roundedPrice) {
            // if empty just save the pool price
            if (tick.priceAt == 0) {
                tick.priceAt = pool.price;
            }
            else {
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
                    EpochMap.set(tickToSave, pool.swapEpoch, tickMap, constants);
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
                    EpochMap.set(tickToSave, pool.swapEpoch, tickMap, constants);
                }
            }
        }
        // invariant => if we save liquidity to tick clear pool liquidity
        if ((tickToSave != (params.zeroForOne ? params.lower : params.upper))) {
            tick.liquidityDelta += int128(pool.liquidity);
            pool.liquidity = 0;
        }
        ticks[tickToSave] = tick;
        return pool;
    }

    function remove(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.UpdateCache memory cache,
        ILimitPoolStructs.UpdateParams memory params,
        ILimitPoolStructs.Immutables memory constants
    ) internal {
        // set ticks based on claim and zeroForOne
        int24 lower = params.zeroForOne ? params.claim : params.lower;
        int24 upper = params.zeroForOne ? params.upper : params.claim;
        {    
            ILimitPoolStructs.Tick memory tickLower = ticks[lower];
            
            if (cache.removeLower) {
                if (params.zeroForOne) {
                    tickLower.liquidityDelta -= int128(params.amount);
                } else {
                    tickLower.liquidityDelta += int128(params.amount);
                }
                ticks[lower] = tickLower;
            }
            clear(ticks, constants, tickMap, lower);
        }
        {
            ILimitPoolStructs.Tick memory tickUpper = ticks[upper];
            if (cache.removeUpper) {
                if (params.zeroForOne) {
                    tickUpper.liquidityDelta += int128(params.amount);
                } else {
                    tickUpper.liquidityDelta -= int128(params.amount);
                }
                ticks[upper] = tickUpper;
            }
            clear(ticks, constants, tickMap, upper);
        }
    }

    function clear(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.Immutables memory constants,
        ILimitPoolStructs.TickMap storage tickMap,
        int24 tickToClear
    ) internal {
        if (_empty(ticks[tickToClear])) {
            if (tickToClear != ConstantProduct.maxTick(constants.tickSpacing) &&
                tickToClear != ConstantProduct.minTick(constants.tickSpacing)) {
                ticks[tickToClear] = ILimitPoolStructs.Tick(0,0);
                TickMap.unset(tickMap, tickToClear, constants.tickSpacing);
            }
        }
    }

    function _empty(
        ILimitPoolStructs.Tick memory tick
    ) internal pure returns (
        bool
    ) {
        if (tick.liquidityDelta != 0) {
            return false;
        }
        return true;
    }
}
