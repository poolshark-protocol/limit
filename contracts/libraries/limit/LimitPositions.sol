// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import './LimitTicks.sol';
import '../../interfaces/range/IRangePoolStructs.sol';
import '../../interfaces/limit/ILimitPoolStructs.sol';
import '../math/OverflowMath.sol';
import './Claims.sol';
import './EpochMap.sol';
import '../utils/SafeCast.sol';
import '../Ticks.sol';

/// @notice Position management library for ranged liquidity.
/// @notice Position management library for ranged liquidity.
library LimitPositions {
    using SafeCast for uint256;

    event BurnLimit(
        address indexed to,
        int24 lower,
        int24 upper,
        int24 claim,
        bool zeroForOne,
        uint128 liquidityBurned,
        uint128 tokenInClaimed,
        uint128 tokenOutBurned
    );

    function resize(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        IRangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        ILimitPoolStructs.MintLimitParams memory params,
        ILimitPoolStructs.MintLimitCache memory cache
    ) internal returns (
        ILimitPoolStructs.MintLimitParams memory,
        ILimitPoolStructs.MintLimitCache memory
    )
    {
        ConstantProduct.checkTicks(params.lower, params.upper, cache.constants.tickSpacing);

        cache.priceLower = ConstantProduct.getPriceAtTick(params.lower, cache.constants);
        cache.priceUpper = ConstantProduct.getPriceAtTick(params.upper, cache.constants);

        // cannot mint empty position
        if (params.amount == 0) require (false, 'PositionAmountZero()');

        cache.mintSize = uint256(params.mintPercent) * uint256(params.amount) / 1e28;
        // calculate L constant
        cache.liquidityMinted = ConstantProduct.getLiquidityForAmounts(
            cache.priceLower,
            cache.priceUpper,
            params.zeroForOne ? cache.priceLower : cache.priceUpper,
            params.zeroForOne ? 0 : uint256(params.amount),
            params.zeroForOne ? uint256(params.amount) : 0
        );

        if (cache.liquidityMinted == 0) require (false, 'PositionLiquidityZero()');
        // calculate price limit by using half of input
        {
            cache.priceLimit = params.zeroForOne ? ConstantProduct.getNewPrice(cache.priceUpper, cache.liquidityMinted, params.amount / 2, true, true)
                                                 : ConstantProduct.getNewPrice(cache.priceLower, cache.liquidityMinted, params.amount / 2, false, true);
            if (cache.priceLimit == 0) require (false, 'PriceLimitZero()');
            // get tick at price
            cache.tickLimit = ConstantProduct.getTickAtPrice(cache.priceLimit.toUint160(), cache.constants);
            // round to nearest tick spacing
            cache.priceLimit = ConstantProduct.getPriceAtTick(cache.tickLimit, cache.constants);
        }

        PoolsharkStructs.SwapCache memory swapCache;
        swapCache.state = cache.state;
        swapCache.constants = cache.constants;
        swapCache.price = cache.state.pool.price;

        // swap zero if no liquidity near market price
        if (cache.state.pool.liquidity == 0 && 
            (params.zeroForOne ? swapCache.price > cache.priceLower
                               : swapCache.price < cache.priceUpper)) {
            swapCache = Ticks.swap(
                ticks,
                samples,
                rangeTickMap,
                limitTickMap,
                PoolsharkStructs.SwapParams({
                    to: params.to,
                    priceLimit: (params.zeroForOne ? cache.priceLower 
                                                   : cache.priceUpper).toUint160(),
                    amount: 0,
                    //TODO: handle exactOut
                    exactIn: true,
                    zeroForOne: params.zeroForOne,
                    callbackData: abi.encodePacked(bytes1(0x0))
                }),
                swapCache
            );
        }

        // only swap if priceLimit is beyond current pool price
        if (params.zeroForOne ? cache.priceLimit < swapCache.price
                              : cache.priceLimit > swapCache.price) {
            // swap and save the pool state
            swapCache = Ticks.swap(
                ticks,
                samples,
                rangeTickMap,
                limitTickMap,
                PoolsharkStructs.SwapParams({
                    to: params.to,
                    priceLimit: cache.priceLimit.toUint160(),
                    amount: params.amount,
                    //TODO: handle exactOut
                    exactIn: true,
                    zeroForOne: params.zeroForOne,
                    callbackData: abi.encodePacked(bytes1(0x0))
                }),
                swapCache
            );
            // subtract from remaining input amount
            params.amount -= uint128(swapCache.input);

        }
        // save to cache
        cache.swapCache = swapCache;
        cache.state = swapCache.state;

        if (params.amount < cache.mintSize) params.amount = 0;
        // move start tick based on amount filled in swap
        if ((params.amount > 0 && swapCache.input > 0) ||
            (params.zeroForOne ? cache.priceLower < swapCache.price
                               : cache.priceUpper > swapCache.price)
        ) {
            // move the tick limit based on pool.tickAtPrice
            if (params.zeroForOne ? cache.priceLower < swapCache.price
                                  : cache.priceUpper > swapCache.price) {
                cache.tickLimit = swapCache.state.pool.tickAtPrice;
            }
            // round ahead tickLimit to avoid crossing epochs
            cache.tickLimit = TickMap.roundAhead(cache.tickLimit, cache.constants, params.zeroForOne, swapCache.price);
            if (params.zeroForOne) {
                if (cache.priceLower < swapCache.price) {
                    // if rounding goes past limit trim position
                    /// @dev - if swap didn't go to limit user would be 100% filled
                    params.lower = cache.tickLimit;
                    cache.priceLower = ConstantProduct.getPriceAtTick(params.lower, cache.constants);
                }
                if (params.lower >= params.upper && 
                    params.lower < ConstantProduct.maxTick(cache.constants.tickSpacing) - cache.constants.tickSpacing
                ) {
                    params.upper = params.lower + cache.constants.tickSpacing;
                }
                cache.priceUpper = ConstantProduct.getPriceAtTick(params.upper, cache.constants);
            } else {
                if (cache.priceUpper > swapCache.price) {
                    // if rounding goes past limit trim position
                    params.upper = cache.tickLimit;
                    cache.priceUpper = ConstantProduct.getPriceAtTick(params.upper, cache.constants);
                }
                if (params.upper <= params.lower && 
                    params.lower > ConstantProduct.minTick(cache.constants.tickSpacing) + cache.constants.tickSpacing
                ) {
                    params.lower = params.upper - cache.constants.tickSpacing;
                }
                cache.priceLower = ConstantProduct.getPriceAtTick(params.lower, cache.constants);
            }
            if (params.amount > 0 && params.lower < params.upper)
                cache.liquidityMinted = ConstantProduct.getLiquidityForAmounts(
                    cache.priceLower,
                    cache.priceUpper,
                    params.zeroForOne ? cache.priceLower : cache.priceUpper,
                    params.zeroForOne ? 0 : uint256(params.amount),
                    params.zeroForOne ? uint256(params.amount) : 0
                );
            else
                /// @auditor unnecessary since params.amount is 0
                cache.liquidityMinted = 0;
            cache.state.epoch += 1;
        }

        if (params.lower >= params.upper) {
            params.amount = 0;
        }

        return (
            params,
            cache
        );
    }

    function add(
        ILimitPoolStructs.MintLimitCache memory cache,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        ILimitPoolStructs.MintLimitParams memory params
    ) internal returns (
        PoolsharkStructs.LimitPoolState memory,
        ILimitPoolStructs.LimitPosition memory
    ) {
        if (cache.liquidityMinted == 0) return (cache.pool, cache.position);

        if (cache.position.liquidity == 0) {
            cache.position.epochLast = cache.state.epoch;
        } else {
            // safety check in case we somehow get here
            if (
                params.zeroForOne
                    ? EpochMap.get(params.lower, params.zeroForOne, tickMap, cache.constants)
                            > cache.position.epochLast
                    : EpochMap.get(params.upper, params.zeroForOne, tickMap, cache.constants)
                            > cache.position.epochLast
            ) {
                require (false, string.concat('UpdatePositionFirstAt(', String.from(params.lower), ', ', String.from(params.upper), ')'));
            }
            /// @auditor maybe this shouldn't be a revert but rather just not mint the position?
        }
        
        // add liquidity to ticks
        LimitTicks.insert(
            ticks,
            tickMap,
            cache,
            params
        );

        // update liquidity global
        cache.state.liquidityGlobal += uint128(cache.liquidityMinted);

        cache.position.liquidity += uint128(cache.liquidityMinted);

        return (cache.pool, cache.position);
    }

    //Limitxxx would be easier

    function remove(
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.LimitPosition)))
            storage positions,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.GlobalState memory state,
        ILimitPoolStructs.UpdateLimitParams memory params,
        PoolsharkStructs.Immutables memory constants
    ) internal returns (
        PoolsharkStructs.GlobalState memory,
        ILimitPoolStructs.LimitPosition memory
    ) {
        // initialize cache
        ILimitPoolStructs.UpdateCache memory cache;
        cache.position = positions[msg.sender][params.lower][params.upper];
        cache.priceLower = ConstantProduct.getPriceAtTick(params.lower, constants);
        cache.priceUpper = ConstantProduct.getPriceAtTick(params.upper, constants);
        cache.removeLower = true; cache.removeUpper = true;
        cache.pool = params.zeroForOne ? cache.state.pool0 : cache.state.pool1;

        // convert percentage to liquidity amount
        params.amount = _convert(cache.position.liquidity, params.amount);

        // early return if no liquidity to remove
        if (params.amount == 0) return (state, cache.position);
        if (params.amount > cache.position.liquidity) {
            require (false, 'NotEnoughPositionLiquidity()');
        }
        /// @dev - validate position has not been crossed into
        if (params.zeroForOne) {
            if (EpochMap.get(params.lower, params.zeroForOne, tickMap, constants)
                        > cache.position.epochLast) {
                int24 nextTick = TickMap.next(tickMap, params.lower, constants.tickSpacing, false);
                if (cache.pool.price > cache.priceLower ||
                    EpochMap.get(nextTick, params.zeroForOne, tickMap, constants)
                        > cache.position.epochLast) {
                    require (false, 'WrongTickClaimedAt7()');            
                }
                if (cache.pool.price == cache.priceLower) {
                    cache.pool.liquidity -= params.amount;
                }
            }
            // if pool price is further along
            // OR next tick has a greater epoch
        } else {
            if (EpochMap.get(params.upper, params.zeroForOne, tickMap, constants)
                        > cache.position.epochLast) {
                int24 previousTick = TickMap.previous(tickMap, params.upper, constants.tickSpacing, false);
                if (cache.pool.price < cache.priceUpper ||
                    EpochMap.get(previousTick, params.zeroForOne, tickMap, constants)
                        > cache.position.epochLast) {
                    require (false, 'WrongTickClaimedAt8()');            
                }
                if (cache.pool.price == cache.priceUpper) {
                    cache.pool.liquidity -= params.amount;
                }
            }
        }

        LimitTicks.remove(
            ticks,
            tickMap,
            cache,
            params,
            constants
        );

        // update liquidity global
        state.liquidityGlobal -= params.amount;

        cache.position.amountOut += uint128(
            params.zeroForOne
                ? ConstantProduct.getDx(params.amount, cache.priceLower, cache.priceUpper, false)
                : ConstantProduct.getDy(params.amount, cache.priceLower, cache.priceUpper, false)
        );

        cache.position.liquidity -= uint128(params.amount);
        positions[msg.sender][params.lower][params.upper] = cache.position;

        if (params.amount > 0) {
            emit BurnLimit(
                    params.to,
                    params.lower,
                    params.upper,
                    params.zeroForOne ? params.lower : params.upper,
                    params.zeroForOne,
                    params.amount,
                    0,
                    cache.position.amountOut
            );
        }
        // save pool state to memory
        if (params.zeroForOne) cache.state.pool0 = cache.pool;
        else cache.state.pool1 = cache.pool;

        return (state, cache.position);
    }

    function update(
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.LimitPosition)))
            storage positions,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.UpdateLimitParams memory params,
        PoolsharkStructs.Immutables memory constants
    ) internal returns (
        ILimitPoolStructs.GlobalState memory,
        ILimitPoolStructs.LimitPosition memory,
        int24
    )
    {
        ILimitPoolStructs.UpdateCache memory cache;
        (
            params,
            cache,
            state
        ) = _deltas(
            positions,
            ticks,
            tickMap,
            state,
            params,
            constants
        );

        if (cache.earlyReturn)
            return (state, cache.position, params.claim);

        // update pool liquidity
        if (cache.priceClaim == cache.pool.price && params.amount > 0) {
            // handle pool.price at edge of range
            if (params.zeroForOne ? cache.priceClaim < cache.priceUpper
                                  : cache.priceClaim > cache.priceLower)
                cache.pool.liquidity -= params.amount;
        }


        if (params.amount > 0) {
            if (params.claim == (params.zeroForOne ? params.upper : params.lower)) {
                // only remove once if final tick of position
                cache.removeLower = false;
                cache.removeUpper = false;
            } else {
                params.zeroForOne ? cache.removeUpper = true 
                                  : cache.removeLower = true;
            }
            if (params.zeroForOne) {
                if (params.claim == params.lower && 
                    cache.pool.price < cache.priceLower
                ) {
                    cache.removeLower = true;
                } else if (params.claim % constants.tickSpacing != 0 && 
                    cache.pool.price < cache.priceClaim)
                    cache.removeLower = true;
            } else {
                if (params.claim == params.upper &&
                    cache.pool.price > cache.priceUpper
                )
                    cache.removeUpper = true;
                else if (params.claim % constants.tickSpacing != 0 &&
                            cache.pool.price > cache.priceClaim)
                    cache.removeUpper = true;
            }
            LimitTicks.remove(
                ticks,
                tickMap,
                cache,
                params,
                constants
            );
            // update position liquidity
            cache.position.liquidity -= uint128(params.amount);
            // update global liquidity
            state.liquidityGlobal -= params.amount;
        }
        if (params.zeroForOne ? params.claim == params.upper
                              : params.claim == params.lower) {
            state.liquidityGlobal -= cache.position.liquidity;
            cache.position.liquidity = 0;
        }
        // clear out old position
        if (params.zeroForOne ? params.claim != params.lower 
                              : params.claim != params.upper) {
            /// @dev - this also clears out position end claims
            if (params.zeroForOne ? params.claim == params.lower 
                                  : params.claim == params.upper) {
                // subtract remaining position liquidity out from global
                state.liquidityGlobal -= cache.position.liquidity;
            }
            delete positions[msg.sender][params.lower][params.upper];
        }
        // clear position if empty
        if (cache.position.liquidity == 0) {
            cache.position.epochLast = 0;
            cache.position.crossedInto = false;
        }

        // round back claim tick for storage
        if (params.claim % constants.tickSpacing != 0)
            params.claim = TickMap.roundBack(params.claim, constants, params.zeroForOne, cache.priceClaim);
        
        emit BurnLimit(
            params.to,
            params.lower,
            params.upper,
            params.claim,
            params.zeroForOne,
            params.amount,
            cache.position.amountIn,
            cache.position.amountOut
        );
        // save pool to globalState
        if (params.zeroForOne) state.pool0 = cache.pool;
        else state.pool1 = cache.pool;

        // return cached position in memory and transfer out
        return (state, cache.position, params.claim);
    }

    function snapshot(
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.LimitPosition)))
            storage positions,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.UpdateLimitParams memory params,
        PoolsharkStructs.Immutables memory constants
    ) external view returns (
        ILimitPoolStructs.LimitPosition memory
    ) {
        ILimitPoolStructs.UpdateCache memory cache;
        (
            params,
            cache,
            state
        ) = _deltas(
            positions,
            ticks,
            tickMap,
            state,
            params,
            constants
        );

        if (cache.earlyReturn)
            return (cache.position);

        if (params.amount > 0) {
            cache.position.liquidity -= uint128(params.amount);
        }
        
        // clear position values if empty
        if (cache.position.liquidity == 0) {
            cache.position.epochLast = 0;
            cache.position.crossedInto = false;
        }    
        return cache.position;
    }

    function _convert(
        uint128 liquidity,
        uint128 percent
    ) internal pure returns (
        uint128
    ) {
        // convert percentage to liquidity amount
        if (percent > 1e38) percent = 1e38;
        if (liquidity == 0 && percent > 0) require (false, 'PositionNotFound()');
        return uint128(uint256(liquidity) * uint256(percent) / 1e38);
    }

    function _deltas(
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.LimitPosition)))
            storage positions,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.UpdateLimitParams memory params,
        PoolsharkStructs.Immutables memory constants
    ) internal view returns (
        ILimitPoolStructs.UpdateLimitParams memory,
        ILimitPoolStructs.UpdateCache memory,
        ILimitPoolStructs.GlobalState memory
    ) {
        ILimitPoolStructs.UpdateCache memory cache = ILimitPoolStructs.UpdateCache({
            state: state,
            position: positions[params.owner][params.lower][params.upper],
            pool: params.zeroForOne ? state.pool0 : state.pool1,
            priceLower: ConstantProduct.getPriceAtTick(params.lower, constants),
            priceClaim: ticks[params.claim].limit.priceAt == 0 ? ConstantProduct.getPriceAtTick(params.claim, constants)
                                                               : ticks[params.claim].limit.priceAt,
            priceUpper: ConstantProduct.getPriceAtTick(params.upper, constants),
            claimTick: ticks[params.claim].limit,
            earlyReturn: false,
            removeLower: false,
            removeUpper: false
        });

        params.amount = _convert(cache.position.liquidity, params.amount);

        // check claim is valid
        (params, cache) = Claims.validate(
            positions,
            ticks,
            tickMap,
            cache.pool,
            params,
            cache,
            constants
        );
        if (cache.earlyReturn) {
            return (params, cache, state);
        }
        // calculate position deltas
        cache = Claims.getDeltas(cache, params, constants);



        return (params, cache, state);
    }
}