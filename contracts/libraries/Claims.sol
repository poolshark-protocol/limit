// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;

import '../interfaces/ILimitPoolStructs.sol';
import '../interfaces/modules/curves/ICurveMath.sol';
import './EpochMap.sol';
import './TickMap.sol';
import './utils/String.sol';
import './utils/SafeCast.sol';

library Claims {

    using SafeCast for uint256;

    function validate(
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.Position)))
            storage positions,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.UpdateParams memory params,
        ILimitPoolStructs.UpdateCache memory cache,
        ILimitPoolStructs.Immutables memory constants
    ) internal view returns (
        ILimitPoolStructs.UpdateParams memory,
        ILimitPoolStructs.UpdateCache memory
    ) {
        // validate position liquidity
        if (params.amount > cache.position.liquidity) require (false, 'NotEnoughPositionLiquidity()');
        if (cache.position.liquidity == 0) {
            require(false, 'NoPositionLiquidityFound()');
        }

        // if the position has not been crossed into at all
        else if (cache.position.claimPriceLast == 0 &&
                 (params.zeroForOne ? (params.claim == params.lower &&
                                        EpochMap.get(params.lower, tickMap, constants) <= cache.position.epochLast)
                                    : (params.claim == params.upper &&
                                        EpochMap.get(params.upper, tickMap, constants) <= cache.position.epochLast))
        ) {
            cache.earlyReturn = true;
            return (params, cache);
        }
        
        if (params.claim < params.lower || params.claim > params.upper) require (false, 'InvalidClaimTick()');

        uint32 claimTickEpoch = EpochMap.get(params.claim, tickMap, constants);

        if (params.zeroForOne){
            if (pool.price >= cache.priceClaim) {
                if (pool.price <= cache.priceUpper) {
                    cache.priceClaim = pool.price;
                    params.claim = TickMap.roundBackWithPrice(pool.tickAtPrice, constants, params.zeroForOne, cache.priceClaim);
                    claimTickEpoch = pool.swapEpoch;
                } else {
                    cache.priceClaim = cache.priceUpper;
                    params.claim = params.upper;
                    cache.claimTick = ticks[params.upper];
                }
                claimTickEpoch = pool.swapEpoch;
            } else if (params.claim % constants.tickSpacing != 0) {
                if (cache.claimTick.priceAt == 0) {
                    require (false, 'WrongTickClaimedAt()');
                }
                cache.priceClaim = cache.claimTick.priceAt;
            }
        } else {
            if (pool.price <= cache.priceClaim) {
                if (pool.price >= cache.priceLower) {
                    cache.priceClaim = pool.price;
                    params.claim = TickMap.roundBackWithPrice(pool.tickAtPrice, constants, params.zeroForOne, cache.priceClaim);
                    // handles tickAtPrice not being crossed yet
                    if (pool.tickAtPrice % constants.tickSpacing == 0 &&
                        pool.price > ConstantProduct.getPriceAtTick(pool.tickAtPrice, constants)){
                        params.claim += constants.tickSpacing;
                    }
                    claimTickEpoch = pool.swapEpoch;
                } else {
                    cache.priceClaim = cache.priceLower;
                    params.claim = params.lower;
                    cache.claimTick = ticks[params.upper];
                }
                claimTickEpoch = pool.swapEpoch;
            } else if (params.claim % constants.tickSpacing != 0) {
                if (cache.claimTick.priceAt == 0) {
                    require (false, 'WrongTickClaimedAt()');
                }
                cache.priceClaim = cache.claimTick.priceAt;
            }
        }

        // validate claim tick
        if (params.claim == (params.zeroForOne ? params.upper : params.lower)) {
             if (claimTickEpoch <= cache.position.epochLast)
                require (false, 'WrongTickClaimedAt()');
        } else if (params.amount > 0) {
            /// @dev - partway claim is valid as long as liquidity is not being removed
            int24 claimTickNext = params.zeroForOne
                ? TickMap.next(tickMap, params.claim, constants.tickSpacing)
                : TickMap.previous(tickMap, params.claim, constants.tickSpacing, false);
            // if we cleared the final tick of their position, this is the wrong claim tick
            if (params.zeroForOne ? claimTickNext > params.upper
                                  : claimTickNext < params.lower) {
                require (false, 'WrongTickClaimedAt()');
            }
            // zero fill or partial fill
            /// @dev - if the next tick was crossed after position creation, the claim tick is incorrect
            /// @dev - we can cycle to find the right claim tick for the user
            uint32 claimTickNextAccumEpoch = EpochMap.get(claimTickNext, tickMap, constants);
            ///@dev - next swapEpoch should not be greater
            if (claimTickNextAccumEpoch > cache.position.epochLast) {
                require (false, 'WrongTickClaimedAt()');
            }
        }
        if (params.claim != params.upper && params.claim != params.lower) {
            // check epochLast on claim tick
            if (claimTickEpoch <= cache.position.epochLast)
                require (false, 'WrongTickClaimedAt()');
            // prevent position overwriting at claim tick
            if (params.zeroForOne) {
                if (positions[params.owner][params.lower][params.claim].liquidity > 0) {
                    require (false, string.concat('UpdatePositionFirstAt(', String.from(params.lower), ', ', String.from(params.claim), ')'));
                }
            } else {
                if (positions[params.owner][params.claim][params.upper].liquidity > 0) {
                    require (false, string.concat('UpdatePositionFirstAt(', String.from(params.lower), ', ', String.from(params.claim), ')'));
                }
            }
        }

        // early return if no update and amount burned is 0
        //TODO: after we've cycled through claim ticks and there are no position updates just revert - DONE
        //TODO: add test case for this
        if (params.amount == 0 && cache.position.claimPriceLast == cache.priceClaim) {
            require(false, 'NoPositionUpdates()');
        }

        return (params, cache);
    }

    function getDeltas(
        ILimitPoolStructs.UpdateCache memory cache,
        ILimitPoolStructs.UpdateParams memory params,
        ILimitPoolStructs.Immutables memory constants
    ) internal view returns (
        ILimitPoolStructs.UpdateCache memory
    ) {
        // if half tick priceAt > 0 add amountOut to amountOutClaimed
        // set claimPriceLast if zero
        if (cache.position.claimPriceLast == 0) {
            cache.position.claimPriceLast = params.zeroForOne ? cache.priceLower
                                                              : cache.priceUpper;
        }
        ILimitPoolStructs.GetDeltasLocals memory locals;
        if (cache.priceClaim != cache.pool.price)
            locals.previousFullTick = TickMap.roundBackWithPrice(params.claim, constants, params.zeroForOne, cache.priceClaim);
        else
            locals.previousFullTick = params.claim;
        locals.pricePrevious = ConstantProduct.getPriceAtTick(locals.previousFullTick, constants);
        if (params.zeroForOne ? locals.previousFullTick > params.lower
                              : locals.previousFullTick < params.upper) {
            
            // claim amounts up to latest full tick crossed
            cache.position.amountIn += uint128(params.zeroForOne ? ConstantProduct.getDy(cache.position.liquidity, cache.priceLower, locals.pricePrevious, false)
                                                                 : ConstantProduct.getDx(cache.position.liquidity, locals.pricePrevious, cache.priceUpper, false));
            cache.position.claimPriceLast = locals.pricePrevious.toUint160();
        }
        if (params.amount > 0) {
           // if tick hasn't been set back calculate amountIn
            if (params.zeroForOne ? cache.priceClaim > locals.pricePrevious
                                  : cache.priceClaim < locals.pricePrevious) {
                // allow partial tick claim if removing liquidity
                cache.position.amountIn += uint128(params.zeroForOne ? ConstantProduct.getDy(params.amount, locals.pricePrevious, cache.priceClaim, false)
                                                                     : ConstantProduct.getDx(params.amount, cache.priceClaim, locals.pricePrevious, false));
            }
            // use priceClaim if tick hasn't been set back
            // else use claimPriceLast to calculate amountOut
            if (params.claim != (params.zeroForOne ? params.upper : params.lower)) {
                cache.position.amountOut += uint128(params.zeroForOne ? ConstantProduct.getDx(params.amount, cache.priceClaim, cache.priceUpper, false)
                                                                      : ConstantProduct.getDy(params.amount, cache.priceLower, cache.priceClaim, false));
            }
        }
        return cache;
    }
}