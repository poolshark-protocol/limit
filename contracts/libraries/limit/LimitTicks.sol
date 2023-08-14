// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../../interfaces/limit/ILimitPoolStructs.sol';
import '../../interfaces/limit/ILimitPoolFactory.sol';
import '../../base/structs/LimitPoolFactoryStructs.sol';
import '../../interfaces/limit/ILimitPool.sol';
import '../math/ConstantProduct.sol';
import './LimitPositions.sol';
import '../math/OverflowMath.sol';
import '../TickMap.sol';
import './EpochMap.sol';
import '../range/Samples.sol';
import '../utils/SafeCast.sol';

/// @notice Tick management library for limit pools
library LimitTicks {
    error LiquidityOverflow();
    error LiquidityUnderflow();
    error InvalidLowerTick();
    error InvalidUpperTick();
    error InvalidPositionAmount();
    error InvalidPositionBounds();

    using SafeCast for uint256;

    uint256 internal constant Q96 = 0x1000000000000000000000000;

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
                uint32 epochAhead = EpochMap.get(tickAhead, params.zeroForOne, tickMap, cache.constants);
                EpochMap.set(params.lower, params.zeroForOne, epochAhead, tickMap, cache.constants);
            }
            PoolsharkStructs.LimitTick memory tickLower = ticks[params.lower].limit;
            if (params.zeroForOne) {
                tickLower.liquidityDelta += int128(liquidityMinted);
            } else {
                tickLower.liquidityDelta -= int128(liquidityMinted);
            }
            tickLower.liquidityAbsolute += cache.liquidityMinted.toUint128();
            ticks[params.lower].limit = tickLower;
        } else {
            /// @dev - i.e. if zeroForOne && cache.priceLower <= cache.pool.price
            cache.state.epoch += 1;
            // mark epoch on undercut tick
            EpochMap.set(params.lower, params.zeroForOne, cache.state.epoch, tickMap, cache.constants);
        }

        if (params.zeroForOne || cache.priceUpper < cache.pool.price) {
            if(!TickMap.set(tickMap, params.upper, cache.constants.tickSpacing)) {
                int24 tickAhead;
                if (params.zeroForOne) {
                    tickAhead  = TickMap.next(tickMap, params.upper, cache.constants.tickSpacing, false);
                } else {
                    tickAhead  = TickMap.previous(tickMap, params.upper, cache.constants.tickSpacing, false);
                }
                uint32 epochAhead = EpochMap.get(tickAhead, params.zeroForOne, tickMap, cache.constants);
                EpochMap.set(params.upper, params.zeroForOne, epochAhead, tickMap, cache.constants);
            }
            PoolsharkStructs.LimitTick memory tickUpper = ticks[params.upper].limit;
            if (params.zeroForOne) {
                tickUpper.liquidityDelta -= int128(liquidityMinted);
            } else {
                tickUpper.liquidityDelta += int128(liquidityMinted);
            }
            tickUpper.liquidityAbsolute += cache.liquidityMinted.toUint128();
            ticks[params.upper].limit = tickUpper;
        } else {
            /// @dev - i.e. if !zeroForOne && cache.priceUpper >= cache.pool.price
            cache.state.epoch += 1;
            // mark epoch on undercut tick
            EpochMap.set(params.upper, params.zeroForOne, cache.state.epoch, tickMap, cache.constants);
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
            EpochMap.set(tickToSave, params.zeroForOne, cache.state.epoch, tickMap, constants);
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
                    EpochMap.set(tickToSave, params.zeroForOne, cache.state.epoch, tickMap, constants);
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
                    EpochMap.set(tickToSave, params.zeroForOne, cache.state.epoch, tickMap, constants);
                }
            }
        }
        // invariant => if we save liquidity to tick clear pool liquidity
        if ((tickToSave != (params.zeroForOne ? params.lower : params.upper))) {
            tick.liquidityDelta += int128(pool.liquidity);
            tick.liquidityAbsolute += pool.liquidity;
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
                tickLower.liquidityAbsolute -= params.amount;
                ticks[lower].limit = tickLower;
                clear(ticks, constants, tickMap, lower);
            }
        }
        {
            PoolsharkStructs.LimitTick memory tickUpper = ticks[upper].limit;
            if (cache.removeUpper) {
                if (params.zeroForOne) {
                    tickUpper.liquidityDelta += int128(params.amount);
                } else {
                    tickUpper.liquidityDelta -= int128(params.amount);
                }
                tickUpper.liquidityAbsolute -= params.amount;
                ticks[upper].limit = tickUpper;
                clear(ticks, constants, tickMap, upper);
            }
        }
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
                EpochMap.set(pool.tickAtPrice, zeroForOne, cache.state.epoch, tickMap, cache.constants);
            }
        } else {
            /// @dev - roundedUp true since liquidity could be equal to the current pool tickAtPrice
            pool.tickAtPrice = TickMap.previous(tickMap, startTick, cache.constants.tickSpacing, true);
            if (pool.tickAtPrice > ConstantProduct.minTick(cache.constants.tickSpacing)) {
                EpochMap.set(pool.tickAtPrice, zeroForOne, cache.state.epoch, tickMap, cache.constants);
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
        ticks[tickToClear].limit = PoolsharkStructs.LimitTick(0,0,0);
        clear(ticks, cache.constants, tickMap, tickToClear);

        return (cache, pool);
    }

    function clear(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.Immutables memory constants,
        PoolsharkStructs.TickMap storage tickMap,
        int24 tickToClear
    ) internal {
        if (_empty(ticks[tickToClear])) {
            if (tickToClear != ConstantProduct.maxTick(constants.tickSpacing) &&
                tickToClear != ConstantProduct.minTick(constants.tickSpacing)) {
                ticks[tickToClear].limit = PoolsharkStructs.LimitTick(0,0,0);
                TickMap.unset(tickMap, tickToClear, constants.tickSpacing);
            }
        }
    }

    function _empty(
        ILimitPoolStructs.Tick memory tick
    ) internal pure returns (
        bool
    ) {
        if (tick.limit.liquidityAbsolute != 0) {
            return false;
        }
        return true;
    }
}
