// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../interfaces/structs/LimitPoolStructs.sol';
import './EpochMap.sol';
import '../TickMap.sol';
import '../utils/String.sol';
import '../utils/SafeCast.sol';

library Claims {

    using SafeCast for uint256;

    function validate(
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        LimitPoolStructs.BurnLimitParams memory params,
        LimitPoolStructs.BurnLimitCache memory cache
    ) internal view returns (
        LimitPoolStructs.BurnLimitParams memory,
        LimitPoolStructs.BurnLimitCache memory
    ) {
        // validate position liquidity
        if (cache.liquidityBurned > cache.position.liquidity) require (false, 'NotEnoughPositionLiquidity()');
        if (cache.position.liquidity == 0) {
            require(false, 'NoPositionLiquidityFound()');
        }
        
        if (params.claim < cache.position.lower ||
                params.claim > cache.position.upper)
            require (false, 'InvalidClaimTick()');

        uint32 claimTickEpoch = EpochMap.get(params.claim, params.zeroForOne, tickMap, cache.constants);

        if (params.zeroForOne){
            if (cache.pool.price >= cache.priceClaim) {
                if (cache.pool.price <= cache.priceUpper) {
                    cache.priceClaim = cache.pool.price;
                    params.claim = TickMap.roundBack(cache.pool.tickAtPrice, cache.constants, params.zeroForOne, cache.priceClaim);
                    claimTickEpoch = cache.state.epoch;
                } else {
                    cache.priceClaim = cache.priceUpper;
                    params.claim = cache.position.upper;
                    cache.claimTick = ticks[cache.position.upper].limit;
                }
                claimTickEpoch = cache.state.epoch;
            } else if (params.claim % cache.constants.tickSpacing != 0) {
                if (cache.claimTick.priceAt == 0) {
                    require (false, 'WrongTickClaimedAt1()');
                }
                cache.priceClaim = cache.claimTick.priceAt;
            }
        } else {
            if (cache.pool.price <= cache.priceClaim) {
                if (cache.pool.price >= cache.priceLower) {
                    cache.priceClaim = cache.pool.price;
                    params.claim = TickMap.roundBack(cache.pool.tickAtPrice, cache.constants, params.zeroForOne, cache.priceClaim);
                    claimTickEpoch = cache.state.epoch;
                } else {
                    cache.priceClaim = cache.priceLower;
                    params.claim = cache.position.lower;
                    cache.claimTick = ticks[cache.position.upper].limit;

                }
                claimTickEpoch = cache.state.epoch;
            } else if (params.claim % cache.constants.tickSpacing != 0) {
                if (cache.claimTick.priceAt == 0) {
                    require (false, 'WrongTickClaimedAt2()');
                }
                cache.priceClaim = cache.claimTick.priceAt;
            }
        }

        // validate claim tick
        if (params.claim == (params.zeroForOne ? cache.position.upper : cache.position.lower)) {
            // set params.amount to 0 for event emitted at end
            cache.liquidityBurned = 0;
             if (claimTickEpoch <= cache.position.epochLast)
                require (false, 'WrongTickClaimedAt3()');
        } else if (cache.liquidityBurned > 0) {
            /// @dev - partway claim is valid as long as liquidity is not being removed

            // if we cleared the final tick of their position, this is the wrong claim tick
            if (params.zeroForOne) {
                uint32 endTickAccumEpoch = EpochMap.get(cache.position.upper, params.zeroForOne, tickMap, cache.constants);
                if (endTickAccumEpoch > cache.position.epochLast) {
                    params.claim = cache.position.upper;
                    cache.priceClaim = cache.priceUpper;
                    cache.claimTick = ticks[cache.position.upper].limit;
                    cache.liquidityBurned = cache.position.liquidity;
                } else {
                    int24 claimTickNext = TickMap.next(tickMap, params.claim, cache.constants.tickSpacing, false);
                    uint32 claimTickNextAccumEpoch = EpochMap.get(claimTickNext, params.zeroForOne, tickMap, cache.constants);
                    ///@dev - next swapEpoch should not be greater
                    if (claimTickNextAccumEpoch > cache.position.epochLast) {
                        require (false, 'WrongTickClaimedAt5()');
                    }
                }
            } else {
                uint32 endTickAccumEpoch = EpochMap.get(cache.position.lower, params.zeroForOne, tickMap, cache.constants);
                if (endTickAccumEpoch > cache.position.epochLast) {
                    params.claim = cache.position.lower;
                    cache.priceClaim = cache.priceLower;
                    cache.claimTick = ticks[cache.position.lower].limit;
                    cache.liquidityBurned = cache.position.liquidity;
                } else {
                    int24 claimTickNext = TickMap.previous(tickMap, params.claim, cache.constants.tickSpacing, false);
                    uint32 claimTickNextAccumEpoch = EpochMap.get(claimTickNext, params.zeroForOne, tickMap, cache.constants);
                    ///@dev - next swapEpoch should not be greater
                    if (claimTickNextAccumEpoch > cache.position.epochLast) {
                        require (false, 'WrongTickClaimedAt5()');
                    }
                }
            }
        }
        /// @dev - start tick does not overwrite position and final tick clears position
        if (params.claim != cache.position.upper && params.claim != cache.position.lower) {
            // check epochLast on claim tick
            if (claimTickEpoch <= cache.position.epochLast)
                require (false, 'WrongTickClaimedAt7()');
        }

        // early return if no update and amount burned is 0
        //TODO: after we've cycled through claim ticks and there are no position updates just revert - DONE
        if (params.zeroForOne ? params.claim == cache.position.lower
                              : params.claim == cache.position.upper) {
            if (cache.liquidityBurned == 0)
                require(false, 'NoPositionUpdates()');
        }

        return (params, cache);
    }

    function getDeltas(
        LimitPoolStructs.BurnLimitParams memory params,
        LimitPoolStructs.BurnLimitCache memory cache,
        PoolsharkStructs.Immutables memory constants
    ) internal pure returns (
        LimitPoolStructs.BurnLimitCache memory
    ) {
        // if half tick priceAt > 0 add amountOut to amountOutClaimed
        // set claimPriceLast if zero
        if (!cache.position.crossedInto) {
            cache.position.crossedInto = true;
        }
        LimitPoolStructs.GetDeltasLocals memory locals;

        if (params.claim % constants.tickSpacing != 0)
        // this should pass price at the claim tick
            locals.previousFullTick = TickMap.roundBack(params.claim, constants, params.zeroForOne, ConstantProduct.getPriceAtTick(params.claim, constants));
        else
            locals.previousFullTick = params.claim;
        locals.pricePrevious = ConstantProduct.getPriceAtTick(locals.previousFullTick, constants);
        if (params.zeroForOne ? locals.previousFullTick > cache.position.lower
                              : locals.previousFullTick < cache.position.upper) {
            
            // claim amounts up to latest full tick crossed
            cache.amountIn += uint128(params.zeroForOne ? ConstantProduct.getDy(cache.position.liquidity, cache.priceLower, locals.pricePrevious, false)
                                                                 : ConstantProduct.getDx(cache.position.liquidity, locals.pricePrevious, cache.priceUpper, false));
        }
        if (cache.liquidityBurned > 0) {
           // if tick hasn't been set back calculate amountIn
            if (params.zeroForOne ? cache.priceClaim > locals.pricePrevious
                                  : cache.priceClaim < locals.pricePrevious) {
                // allow partial tick claim if removing liquidity
                cache.amountIn += uint128(params.zeroForOne ? ConstantProduct.getDy(cache.liquidityBurned, locals.pricePrevious, cache.priceClaim, false)
                                                            : ConstantProduct.getDx(cache.liquidityBurned, cache.priceClaim, locals.pricePrevious, false));
            }
            // use priceClaim if tick hasn't been set back
            // else use claimPriceLast to calculate amountOut
            if (params.claim != (params.zeroForOne ? cache.position.upper : cache.position.lower)) {
                cache.amountOut += uint128(params.zeroForOne ? ConstantProduct.getDx(cache.liquidityBurned, cache.priceClaim, cache.priceUpper, false)
                                                             : ConstantProduct.getDy(cache.liquidityBurned, cache.priceLower, cache.priceClaim, false));
            }
        }
        // take protocol fee if needed
        if (cache.pool.protocolFillFee > 0 && cache.amountIn > 0) {
            uint128 protocolFeeAmount = OverflowMath.mulDiv(cache.amountIn, cache.pool.protocolFillFee, 1e4).toUint128();
            cache.amountIn -= protocolFeeAmount;
            cache.pool.protocolFees += protocolFeeAmount;
        }
        return cache;
    }
}