// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import '../../interfaces/structs/LimitPoolStructs.sol';
import './EpochMap.sol';
import '../TickMap.sol';
import '../utils/String.sol';
import '../utils/SafeCast.sol';

library Claims {
    using SafeCast for uint256;

    // if claim tick searched, look max 512 spacings ahead
    uint256 public constant maxWordsSearched = 4;

    function validate(
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.BurnLimitParams memory params,
        LimitPoolStructs.BurnLimitCache memory cache
    )
        internal
        view
        returns (
            PoolsharkStructs.BurnLimitParams memory,
            LimitPoolStructs.BurnLimitCache memory
        )
    {
        checkClaimTick(params, cache);

        uint32 claimTickEpoch = EpochMap.get(
            params.claim,
            params.zeroForOne,
            tickMap,
            cache.constants
        );

        if (params.zeroForOne) {
            // pool price is past claim tick
            if (cache.pool.price >= cache.priceClaim) {
                // pool price is between lower and upper
                if (cache.pool.price <= cache.priceUpper) {
                    cache.priceClaim = cache.pool.price;
                    params.claim = TickMap.roundBack(
                        cache.pool.tickAtPrice,
                        cache.constants,
                        params.zeroForOne,
                        cache.priceClaim
                    );
                    if (params.claim < cache.position.lower)
                        params.claim = cache.position.lower;
                } else {
                    cache.priceClaim = cache.priceUpper;
                    params.claim = cache.position.upper;
                    cache.claimTick = ticks[cache.position.upper].limit;
                }
                claimTickEpoch = cache.state.epoch;
            } else if (params.claim % cache.constants.tickSpacing != 0) {
                if (cache.claimTick.priceAt == 0) {
                    // if tick untouched since position creation revert
                    if (claimTickEpoch <= cache.position.epochLast)
                        require(false, 'ClaimTick::HalfTickClaimInvalid()');
                        // search ahead for the correct claim tick
                    else cache.search = true;
                }
                cache.priceClaim = cache.claimTick.priceAt;
            }
        } else {
            if (cache.pool.price <= cache.priceClaim) {
                if (cache.pool.price >= cache.priceLower) {
                    cache.priceClaim = cache.pool.price;
                    params.claim = TickMap.roundBack(
                        cache.pool.tickAtPrice,
                        cache.constants,
                        params.zeroForOne,
                        cache.priceClaim
                    );
                    if (params.claim > cache.position.upper)
                        params.claim = cache.position.upper;
                } else {
                    cache.priceClaim = cache.priceLower;
                    params.claim = cache.position.lower;
                    cache.claimTick = ticks[cache.position.upper].limit;
                }
                claimTickEpoch = cache.state.epoch;
            } else if (params.claim % cache.constants.tickSpacing != 0) {
                if (cache.claimTick.priceAt == 0) {
                    if (claimTickEpoch <= cache.position.epochLast)
                        require(false, 'ClaimTick::HalfTickClaimInvalid()');
                        // search ahead for the correct claim tick
                    else cache.search = true;
                }
                cache.priceClaim = cache.claimTick.priceAt;
            }
        }

        if (
            params.claim ==
            (params.zeroForOne ? cache.position.upper : cache.position.lower)
        ) {
            // check if final tick crossed
            cache.liquidityBurned = 0;
            if (claimTickEpoch <= cache.position.epochLast)
                // nothing to search
                require(false, 'ClaimTick::FinalTickNotCrossedYet()');
        } else if (cache.liquidityBurned > 0) {
            /// @dev - partway claim is valid as long as liquidity is not being removed
            if (params.zeroForOne) {
                // check final tick first
                uint32 endTickEpoch = EpochMap.get(
                    cache.position.upper,
                    params.zeroForOne,
                    tickMap,
                    cache.constants
                );
                if (endTickEpoch > cache.position.epochLast) {
                    // final tick crossed
                    params.claim = cache.position.upper;
                    cache.priceClaim = cache.priceUpper;
                    cache.claimTick = ticks[cache.position.upper].limit;
                    cache.liquidityBurned = 0;
                } else {
                    // check claim tick passed is valid
                    int24 claimTickNext = TickMap.next(
                        tickMap,
                        params.claim,
                        cache.constants.tickSpacing,
                        false
                    );
                    uint32 claimTickNextEpoch = EpochMap.get(
                        claimTickNext,
                        params.zeroForOne,
                        tickMap,
                        cache.constants
                    );
                    if (claimTickNextEpoch > cache.position.epochLast) {
                        ///@dev - next tick in range should not have been crossed
                        cache.search = true;
                    }
                }
            } else {
                // check final tick first
                uint32 endTickEpoch = EpochMap.get(
                    cache.position.lower,
                    params.zeroForOne,
                    tickMap,
                    cache.constants
                );
                if (endTickEpoch > cache.position.epochLast) {
                    // final tick crossed
                    params.claim = cache.position.lower;
                    cache.priceClaim = cache.priceLower;
                    cache.claimTick = ticks[cache.position.lower].limit;
                    cache.liquidityBurned = 0;
                } else {
                    // check claim tick passed is valid
                    int24 claimTickNext = TickMap.previous(
                        tickMap,
                        params.claim,
                        cache.constants.tickSpacing,
                        false
                    );
                    uint32 claimTickNextEpoch = EpochMap.get(
                        claimTickNext,
                        params.zeroForOne,
                        tickMap,
                        cache.constants
                    );
                    if (claimTickNextEpoch > cache.position.epochLast) {
                        ///@dev - next tick in range should not have been crossed
                        // require (false, 'ClaimTick::NextTickAlreadyCrossed()');
                        cache.search = true;
                    }
                }
            }
        }
        if (cache.search) {
            (params, cache, claimTickEpoch) = search(
                ticks,
                tickMap,
                params,
                cache
            );
        }

        /// @dev - start tick does not overwrite position and final tick clears position
        if (
            params.claim != cache.position.upper &&
            params.claim != cache.position.lower
        ) {
            if (claimTickEpoch <= cache.position.epochLast)
                require(false, 'ClaimTick::TickNotCrossed()');
        }

        checkClaimTick(params, cache);

        return (params, cache);
    }

    function getDeltas(
        PoolsharkStructs.BurnLimitParams memory params,
        LimitPoolStructs.BurnLimitCache memory cache,
        PoolsharkStructs.LimitImmutables memory constants
    ) internal pure returns (LimitPoolStructs.BurnLimitCache memory) {
        // if half tick priceAt > 0 add amountOut to amountOutClaimed
        // set claimPriceLast if zero
        if (!cache.position.crossedInto) {
            cache.position.crossedInto = true;
        }
        LimitPoolStructs.GetDeltasLocals memory locals;

        if (params.claim % constants.tickSpacing != 0)
            // this should pass price at the claim tick
            locals.previousFullTick = TickMap.roundBack(
                params.claim,
                constants,
                params.zeroForOne,
                ConstantProduct.getPriceAtTick(params.claim, constants)
            );
        else locals.previousFullTick = params.claim;
        locals.pricePrevious = ConstantProduct.getPriceAtTick(
            locals.previousFullTick,
            constants
        );
        if (
            params.zeroForOne
                ? locals.previousFullTick > cache.position.lower
                : locals.previousFullTick < cache.position.upper
        ) {
            // claim amounts up to latest full tick crossed
            cache.amountIn += uint128(
                params.zeroForOne
                    ? ConstantProduct.getDy(
                        cache.position.liquidity,
                        cache.priceLower,
                        locals.pricePrevious,
                        false
                    )
                    : ConstantProduct.getDx(
                        cache.position.liquidity,
                        locals.pricePrevious,
                        cache.priceUpper,
                        false
                    )
            );
        }
        if (cache.liquidityBurned > 0) {
            // if tick hasn't been set back calculate amountIn
            if (
                params.zeroForOne
                    ? cache.priceClaim > locals.pricePrevious
                    : cache.priceClaim < locals.pricePrevious
            ) {
                // allow partial tick claim if removing liquidity
                cache.amountIn += uint128(
                    params.zeroForOne
                        ? ConstantProduct.getDy(
                            cache.liquidityBurned,
                            locals.pricePrevious,
                            cache.priceClaim,
                            false
                        )
                        : ConstantProduct.getDx(
                            cache.liquidityBurned,
                            cache.priceClaim,
                            locals.pricePrevious,
                            false
                        )
                );
            }
            // use priceClaim if tick hasn't been set back
            // else use claimPriceLast to calculate amountOut
            if (
                params.claim !=
                (
                    params.zeroForOne
                        ? cache.position.upper
                        : cache.position.lower
                )
            ) {
                cache.amountOut += uint128(
                    params.zeroForOne
                        ? ConstantProduct.getDx(
                            cache.liquidityBurned,
                            cache.priceClaim,
                            cache.priceUpper,
                            false
                        )
                        : ConstantProduct.getDy(
                            cache.liquidityBurned,
                            cache.priceLower,
                            cache.priceClaim,
                            false
                        )
                );
            }
        }
        // take protocol fee if needed
        if (cache.pool.protocolFillFee > 0 && cache.amountIn > 0) {
            uint128 protocolFeeAmount = OverflowMath
                .mulDiv(cache.amountIn, cache.pool.protocolFillFee, 1e4)
                .toUint128();
            cache.amountIn -= protocolFeeAmount;
            cache.pool.protocolFees += protocolFeeAmount;
        }
        return cache;
    }

    function search(
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.BurnLimitParams memory params,
        LimitPoolStructs.BurnLimitCache memory cache
    )
        internal
        view
        returns (
            PoolsharkStructs.BurnLimitParams memory,
            LimitPoolStructs.BurnLimitCache memory,
            uint32 claimTickEpoch
        )
    {
        LimitPoolStructs.SearchLocals memory locals;

        locals.ticksFound = new int24[](256);
        locals.searchTick = params.claim;
        if (params.zeroForOne) {
            for (uint256 i = 0; i < maxWordsSearched; ) {
                (
                    locals.ticksFound,
                    locals.ticksIncluded,
                    locals.searchTick
                ) = TickMap.nextTicksWithinWord(
                    tickMap,
                    locals.searchTick,
                    cache.constants.tickSpacing,
                    cache.position.upper,
                    locals.ticksFound,
                    locals.ticksIncluded
                );
                // add start of next word if tick exists and is within range
                if (
                    locals.searchTick < cache.position.upper &&
                    TickMap.get(
                        tickMap,
                        locals.searchTick,
                        cache.constants.tickSpacing
                    )
                ) {
                    locals.ticksFound[locals.ticksIncluded] = locals.searchTick;
                    unchecked {
                        ++locals.ticksIncluded;
                    }
                }
                // if we reached the final tick break the loop
                if (
                    locals.ticksIncluded > 0 &&
                    locals.searchTick >= cache.position.upper
                ) {
                    break;
                }
                unchecked {
                    ++i;
                }
            }
        } else {
            for (int256 i = 0; i < 2; ) {
                (
                    locals.ticksFound,
                    locals.ticksIncluded,
                    locals.searchTick
                ) = TickMap.previousTicksWithinWord(
                    tickMap,
                    locals.searchTick,
                    cache.constants.tickSpacing,
                    cache.position.lower,
                    locals.ticksFound,
                    locals.ticksIncluded
                );
                // add start of next word if tick exists and is within range
                if (
                    locals.searchTick > cache.position.lower &&
                    TickMap.get(
                        tickMap,
                        locals.searchTick,
                        cache.constants.tickSpacing
                    )
                ) {
                    locals.ticksFound[locals.ticksIncluded] = locals.searchTick;
                    unchecked {
                        ++locals.ticksIncluded;
                    }
                }
                // if we reached the final tick break the loop
                if (
                    locals.ticksIncluded > 0 &&
                    locals.searchTick <= cache.position.lower
                ) {
                    break;
                }
                unchecked {
                    ++i;
                }
            }
        }

        // set initial endIdx
        if (locals.ticksIncluded > 0) {
            locals.endIdx = locals.ticksIncluded - 1;
        } else {
            require(false, 'ClaimTick::NoTicksFoundViaSearch()');
        }

        while (locals.startIdx <= locals.endIdx) {
            // set idx at middle of start & end
            locals.searchIdx =
                (locals.endIdx - locals.startIdx) /
                2 +
                locals.startIdx;

            // set ticks
            locals.searchTick = locals.ticksFound[locals.searchIdx];
            if (locals.searchIdx + 1 < locals.ticksIncluded) {
                // tick ahead in array
                locals.searchTickAhead = locals.ticksFound[
                    locals.searchIdx + 1
                ];
            } else {
                // tick ahead in storage
                locals.searchTickAhead = params.zeroForOne
                    ? TickMap.next(
                        tickMap,
                        locals.searchTick,
                        cache.constants.tickSpacing,
                        false
                    )
                    : TickMap.previous(
                        tickMap,
                        locals.searchTick,
                        cache.constants.tickSpacing,
                        false
                    );
            }

            // set epochs
            locals.claimTickEpoch = EpochMap.get(
                locals.searchTick,
                params.zeroForOne,
                tickMap,
                cache.constants
            );
            locals.claimTickAheadEpoch = EpochMap.get(
                locals.searchTickAhead,
                params.zeroForOne,
                tickMap,
                cache.constants
            );

            // check epochs
            if (locals.claimTickEpoch > cache.position.epochLast) {
                if (locals.claimTickAheadEpoch <= cache.position.epochLast) {
                    // correct claim tick
                    break;
                } else {
                    // search higher
                    locals.startIdx = locals.searchIdx + 1;
                }
            } else if (locals.searchIdx > 0) {
                // search lower
                locals.endIdx = locals.searchIdx - 1;
            } else {
                // 0 index hit; end of search
                break;
            }
        }

        // final check on valid claim tick
        if (
            locals.claimTickEpoch <= cache.position.epochLast ||
            locals.claimTickAheadEpoch > cache.position.epochLast
        ) {
            require(false, 'ClaimTick::NotFoundViaSearch()');
        }

        cache.claimTick = ticks[locals.searchTick].limit;
        if ((locals.searchTick % cache.constants.tickSpacing) == 0)
            cache.priceClaim = ConstantProduct.getPriceAtTick(
                locals.searchTick,
                cache.constants
            );
        else {
            cache.priceClaim = cache.claimTick.priceAt;
        }
        if (cache.liquidityBurned == 0)
            params.claim = TickMap.roundBack(
                locals.searchTick,
                cache.constants,
                params.zeroForOne,
                cache.priceClaim
            );
        else params.claim = locals.searchTick;

        return (params, cache, locals.claimTickEpoch);
    }

    function checkClaimTick(
        PoolsharkStructs.BurnLimitParams memory params,
        LimitPoolStructs.BurnLimitCache memory cache
    ) internal pure {
        // revert if final claim is outside bounds
        if (params.claim % (cache.constants.tickSpacing / 2) != 0)
            require(false, 'ClaimTick::NotHalfTickOrFullTick()');

        // revert if final claim is outside bounds
        if (
            params.claim < cache.position.lower ||
            params.claim > cache.position.upper
        ) require(false, 'ClaimTick::OutsidePositionBounds()');
    }
}
