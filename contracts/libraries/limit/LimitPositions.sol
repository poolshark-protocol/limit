// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import './LimitTicks.sol';
import '../../interfaces/IPositionERC1155.sol';
import '../../interfaces/structs/RangePoolStructs.sol';
import '../../interfaces/structs/LimitPoolStructs.sol';
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
        uint32 positionId,
        int24 lower,
        int24 upper,
        int24 oldClaim,
        int24 newClaim,
        bool zeroForOne,
        uint128 liquidityBurned,
        uint128 tokenInClaimed,
        uint128 tokenOutBurned
    );

    function resize(
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.MintLimitParams memory params,
        LimitPoolStructs.MintLimitCache memory cache
    ) external returns (
        PoolsharkStructs.MintLimitParams memory,
        LimitPoolStructs.MintLimitCache memory
    )
    {
        ConstantProduct.checkTicks(params.lower, params.upper, cache.constants.tickSpacing);

        cache.priceLower = ConstantProduct.getPriceAtTick(params.lower, cache.constants);
        cache.priceUpper = ConstantProduct.getPriceAtTick(params.upper, cache.constants);
        cache.mintSize = uint256(params.mintPercent) * uint256(params.amount) / 1e28;

        // calculate L constant
        cache.liquidityMinted = ConstantProduct.getLiquidityForAmounts(
            cache.priceLower,
            cache.priceUpper,
            params.zeroForOne ? cache.priceLower : cache.priceUpper,
            params.zeroForOne ? 0 : uint256(params.amount),
            params.zeroForOne ? uint256(params.amount) : 0
        );

        if (cache.liquidityMinted == 0) require (false, 'NoLiquidityBeingAdded()');
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

        /// @dev - for safety
        if (params.lower >= params.upper) {
            // zero out amount transferred in
            params.amount = 0;
        }

        return (
            params,
            cache
        );
    }

    function add(
        LimitPoolStructs.MintLimitCache memory cache,
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.MintLimitParams memory params
    ) internal returns (
        PoolsharkStructs.LimitPoolState memory,
        LimitPoolStructs.LimitPosition memory
    ) {
        if (cache.liquidityMinted == 0) return (cache.pool, cache.position);

        if (cache.position.liquidity == 0) {
            cache.position.epochLast = cache.state.epoch;
            cache.state.epoch += 1; // increment for future swaps
            IPositionERC1155(cache.constants.poolToken).mint(
                params.to,
                params.positionId,
                1,
                cache.constants
            );
        } else {
            // safety check in case we somehow get here
            if (
                params.zeroForOne
                    ? EpochMap.get(params.lower, params.zeroForOne, tickMap, cache.constants)
                            > cache.position.epochLast
                    : EpochMap.get(params.upper, params.zeroForOne, tickMap, cache.constants)
                            > cache.position.epochLast
            ) {
                require (false, 'PositionAlreadyEntered()');
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

    function update(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        LimitPoolStructs.BurnLimitCache memory cache,
        PoolsharkStructs.BurnLimitParams memory params
    ) internal returns (
        PoolsharkStructs.BurnLimitParams memory,
        LimitPoolStructs.BurnLimitCache memory
    )
    {
        (
            params,
            cache
        ) = _deltas(
            ticks,
            tickMap,
            params,
            cache
        );

        // update pool liquidity
        if (cache.priceClaim == cache.pool.price && cache.liquidityBurned > 0) {
            // handle pool.price at edge of range
            if (params.zeroForOne ? cache.priceClaim < cache.priceUpper
                                  : cache.priceClaim > cache.priceLower)
                cache.pool.liquidity -= cache.liquidityBurned;
        }

        if (cache.liquidityBurned > 0) {
            if (params.claim == (params.zeroForOne ? cache.position.upper : cache.position.lower)) {
                // if claim is final tick no liquidity to remove
                cache.removeLower = false;
                cache.removeUpper = false;
            } else {
                // else remove liquidity from final tick
                params.zeroForOne ? cache.removeUpper = true 
                                  : cache.removeLower = true;
                if (params.zeroForOne) {

                    if (params.claim == cache.position.lower && 
                        cache.pool.price < cache.priceLower
                    ) {
                        // full tick price was touched
                        cache.removeLower = true;
                    } else if (params.claim % cache.constants.tickSpacing != 0 && 
                                    cache.pool.price < cache.priceClaim)
                        // half tick was created
                        cache.removeLower = true;
                } else {
                    if (params.claim == cache.position.upper &&
                        cache.pool.price > cache.priceUpper
                    )
                        // full tick price was touched
                        cache.removeUpper = true;
                    else if (params.claim % cache.constants.tickSpacing != 0 &&
                                    cache.pool.price > cache.priceClaim)
                        // half tick was created
                        cache.removeUpper = true;
                }
            }
            LimitTicks.remove(
                ticks,
                tickMap,
                params,
                cache,
                cache.constants
            );
            // update position liquidity
            cache.position.liquidity -= uint128(cache.liquidityBurned);
            // update global liquidity
            cache.state.liquidityGlobal -= cache.liquidityBurned;
        }
        if (params.zeroForOne ? params.claim == cache.position.upper
                              : params.claim == cache.position.lower) {
            cache.state.liquidityGlobal -= cache.position.liquidity;
            cache.position.liquidity = 0;
        }
        // clear out old position
        if (params.zeroForOne ? params.claim != cache.position.lower 
                              : params.claim != cache.position.upper) {
            /// @dev - this also clears out position end claims
            if (params.zeroForOne ? params.claim == cache.position.lower 
                                  : params.claim == cache.position.upper) {
                // subtract remaining position liquidity out from global
                cache.state.liquidityGlobal -= cache.position.liquidity;
            }
        }
        // clear position if empty
        if (cache.position.liquidity == 0) {
            cache.position.epochLast = 0;
            cache.position.crossedInto = false;
        }

        // round back claim tick for storage
        if (params.claim % cache.constants.tickSpacing != 0) {
            cache.claim = params.claim;
            params.claim = TickMap.roundBack(params.claim, cache.constants, params.zeroForOne, cache.priceClaim);
        }
        
        emit BurnLimit(
            params.to,
            params.positionId,
            cache.position.lower,
            cache.position.upper,
            cache.claim,
            params.claim,
            params.zeroForOne,
            cache.liquidityBurned,
            cache.amountIn,
            cache.amountOut
        );

        // save pool to state in memory
        if (params.zeroForOne) cache.state.pool0 = cache.pool;
        else cache.state.pool1 = cache.pool;

        return (params, cache);
    }

    function snapshot(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        LimitPoolStructs.BurnLimitCache memory cache,
        PoolsharkStructs.BurnLimitParams memory params
    ) internal view returns (
        uint128 amountIn,
        uint128 amountOut
    ) {
        (
            params,
            cache
        ) = _deltas(
            ticks,
            tickMap,
            params,
            cache
        );

        return (cache.amountIn, cache.amountOut);
    }

    function _deltas(
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.BurnLimitParams memory params,
        LimitPoolStructs.BurnLimitCache memory cache
    ) internal view returns (
        PoolsharkStructs.BurnLimitParams memory,
        LimitPoolStructs.BurnLimitCache memory
    ) {
        cache = LimitPoolStructs.BurnLimitCache({
            state: cache.state,
            pool: params.zeroForOne ? cache.state.pool0 : cache.state.pool1,
            claimTick: ticks[params.claim].limit,
            position: cache.position,
            constants: cache.constants,
            priceLower: ConstantProduct.getPriceAtTick(cache.position.lower, cache.constants),
            priceClaim: ticks[params.claim].limit.priceAt == 0 ? ConstantProduct.getPriceAtTick(params.claim, cache.constants)
                                                               : ticks[params.claim].limit.priceAt,
            priceUpper: ConstantProduct.getPriceAtTick(cache.position.upper, cache.constants),
            liquidityBurned: _convert(cache.position.liquidity, params.burnPercent),
            amountIn: 0,
            amountOut: 0,
            claim: params.claim,
            removeLower: false,
            removeUpper: false
        });

        // check claim is valid
        (params, cache) = Claims.validate(
            ticks,
            tickMap,
            params,
            cache
        );

        // calculate position deltas
        cache = Claims.getDeltas(params, cache, cache.constants);

        return (params, cache);
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
}