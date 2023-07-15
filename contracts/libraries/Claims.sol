// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;

import '../interfaces/ILimitPoolStructs.sol';
import '../interfaces/modules/curves/ICurveMath.sol';
import './EpochMap.sol';
import './TickMap.sol';
import './utils/String.sol';
import './utils/SafeCast.sol';
import 'hardhat/console.sol';

library Claims {
    /////////// DEBUG FLAGS ///////////
    bool constant debugDeltas = true;

    using SafeCast for uint256;

    function validate(
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.Position)))
            storage positions,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.UpdateParams memory params,
        ILimitPoolStructs.UpdatePositionCache memory cache,
        ILimitPoolStructs.Immutables memory constants
    ) internal view returns (
        ILimitPoolStructs.UpdateParams memory,
        ILimitPoolStructs.UpdatePositionCache memory
    ) {
        // validate position liquidity
        if (params.amount > cache.position.liquidity) require (false, 'NotEnoughPsitionLiquidity()');
        if (cache.position.liquidity == 0) {
            cache.earlyReturn = true;
            return (params, cache);
        }

        // if the position has not been crossed into at all
        else if (cache.position.claimPriceLast == 0 &&
                 (params.zeroForOne ? (params.claim == params.lower &&
                                        EpochMap.get(params.lower, tickMap, constants) <= cache.position.epochLast)
                                   : (params.claim == params.upper &&
                                        EpochMap.get(params.upper, tickMap, constants) <= cache.position.epochLast))
        ) {
            console.log('early return 1', EpochMap.get(params.lower, tickMap, constants), cache.position.epochLast, uint24(-params.upper));
            cache.earlyReturn = true;
            return (params, cache);
        }
        // early return if no update and amount burned is 0
        if (params.amount == 0 && cache.position.claimPriceLast == pool.price) {
            console.log('early return 2');
                cache.earlyReturn = true;
                return (params, cache);
        } 
        
        if (params.claim < params.lower || params.claim > params.upper) require (false, 'InvalidClaimTick()');

        uint32 claimTickEpoch = EpochMap.get(params.claim, tickMap, constants);

        if (params.zeroForOne){
            if (pool.price >= cache.priceClaim) {
                if (pool.price <= cache.priceUpper) {
                    cache.priceClaim = pool.price;
                    params.claim = TickMap.roundUp(pool.tickAtPrice, constants.tickSpacing, true);
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
            console.log('not zero for one', uint24(-params.claim), uint24(-params.claim % constants.tickSpacing));
            if (pool.price <= cache.priceClaim) {
                if (pool.price >= cache.priceLower) {
                    cache.priceClaim = pool.price;
                    params.claim = TickMap.roundUp(pool.tickAtPrice, constants.tickSpacing, true);
                    // handles tickAtPrice not being crossed yet
                    if (params.claim % constants.tickSpacing == 0 &&
                        pool.price > ConstantProduct.getPriceAtTick(pool.tickAtPrice, constants)){
                        console.log('match on condition');
                        params.claim += constants.tickSpacing;
                    }
                    console.log('price past claim', uint24(-params.claim), uint24(-pool.tickAtPrice));
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
                console.log('using price at for claim price');
                cache.priceClaim = cache.claimTick.priceAt;
            }
        }
        //TODO: if params.amount == 0 don't check the next tick

        // validate claim tick
        if (params.claim == (params.zeroForOne ? params.upper : params.lower)) {
             if (claimTickEpoch <= cache.position.epochLast)
                require (false, 'WrongTickClaimedAt()');
        } else {
            int24 claimTickNext = params.zeroForOne
                ? TickMap.next(tickMap, params.claim, constants.tickSpacing)
                : TickMap.previous(tickMap, params.claim, constants.tickSpacing);
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
            /// @dev - user cannot add liquidity if auction is active; checked for in Positions.validate()
        }
        // sanity check cPL against priceClaim
        // if (
        //     // claim tick is on a prior tick
        //     cache.position.claimPriceLast > 0 &&
        //     (params.zeroForOne
        //             ? cache.position.claimPriceLast > cache.priceClaim
        //             : cache.position.claimPriceLast < cache.priceClaim
        //     )
        // ) require (false, 'InvaliClaimTick()'); /// @dev - wrong claim tick
        return (params, cache);
    }

    function getDeltas(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.UpdatePositionCache memory cache,
        ILimitPoolStructs.UpdateParams memory params,
        ILimitPoolStructs.Immutables memory constants
    ) internal view returns (
        ILimitPoolStructs.UpdatePositionCache memory
    ) {
        // if half tick priceAt > 0 add amountOut to amountOutClaimed
        // set claimPriceLast if zero
        if (cache.position.claimPriceLast == 0) {
            cache.position.claimPriceLast = params.zeroForOne ? cache.priceLower
                                                              : cache.priceUpper;
        }
        // if tick hasn't been set back calculate amountIn
        if (params.zeroForOne ? cache.position.claimPriceLast < cache.priceClaim
                              : cache.position.claimPriceLast > cache.priceClaim) {
            uint128 amountIn = uint128(params.zeroForOne ? ConstantProduct.getDy(cache.position.liquidity, cache.position.claimPriceLast, cache.priceClaim, false)
                                                         : ConstantProduct.getDx(cache.position.liquidity, cache.priceClaim, cache.position.claimPriceLast, false));


            if (cache.pool.price == cache.priceClaim &&
                params.claim % constants.tickSpacing == 0 &&
                params.claim != (params.zeroForOne ? params.upper : params.lower)) {
                // get nearest mid tick and measure delta in between nearest full tick and claim price
                int24 nearestMidTick = params.claim + (params.zeroForOne ? constants.tickSpacing / 2 : -constants.tickSpacing / 2);
                console.log('claiming fill', params.amount, uint24(params.claim), uint24(nearestMidTick));
                if (ticks[nearestMidTick].priceAt > 0) {
                     // calculate price at the closest start tick
                    uint160 startPrice = TickMath.getPriceAtTick(params.claim, constants);
                    // use claimPriceLast if that is past startPrice
                    if (params.zeroForOne ? cache.position.claimPriceLast > startPrice
                                            : cache.position.claimPriceLast < startPrice)
                        startPrice = cache.position.claimPriceLast;
                    // calculate amount which should be ignored in amountInClaimed calculation
                    uint128 amountInClaimed = uint128(params.zeroForOne ? ConstantProduct.getDy(cache.position.liquidity - params.amount, startPrice, cache.priceClaim, false)
                                                                        : ConstantProduct.getDx(cache.position.liquidity - params.amount, cache.priceClaim, startPrice, false));
                    cache.pool.amountInClaimed += amountInClaimed;
                    console.log('pool amount in claimed', cache.pool.amountInClaimed);
                }
            }
            // if the user is burning their position
            cache.position.amountIn += amountIn;
        }
        // clear amountInClaimed on removal
        if (params.amount > 0 &&
                params.claim % constants.tickSpacing == 0 &&
                params.claim != (params.zeroForOne ? params.upper : params.lower)) {
                // calculate price at the closest start tick
                uint160 startPrice = TickMath.getPriceAtTick(params.claim, constants);
                // get nearest mid tick and measure delta in between nearest full tick and claim price
                int24 nearestMidTick = params.claim + (params.zeroForOne ? constants.tickSpacing / 2 : -constants.tickSpacing / 2);
                console.log('claiming fill', params.amount, uint24(params.claim), uint24(nearestMidTick));
                if (ticks[nearestMidTick].priceAt > 0 &&
                    (params.zeroForOne ? cache.position.claimPriceLast > startPrice
                                       : cache.position.claimPriceLast < startPrice)) {
                    uint128 amountInBurned = uint128(params.zeroForOne ? ConstantProduct.getDy(params.amount, startPrice, cache.position.claimPriceLast, false)
                                                                       : ConstantProduct.getDx(params.amount, cache.position.claimPriceLast, startPrice, false));
                    if (amountInBurned < cache.pool.amountInClaimed)
                        cache.pool.amountInClaimed -= amountInBurned;
                    else
                        cache.pool.amountInClaimed = 0;
                console.log('pool amount in claim burned', cache.pool.amountInClaimed);
                }
        }
        // use priceClaim if tick hasn't been set back
        // else use claimPriceLast to calculate amountOut
        if (params.claim != (params.zeroForOne ? params.upper : params.lower)) {
            if (params.zeroForOne ? cache.position.claimPriceLast < cache.priceClaim
                                  : cache.position.claimPriceLast > cache.priceClaim) {
                                    console.log('position amounts 1st option');
  cache.position.amountOut += uint128(params.zeroForOne ? ConstantProduct.getDx(params.amount, cache.priceClaim, cache.priceUpper, false)
                                                                      : ConstantProduct.getDy(params.amount, cache.priceLower, cache.priceClaim, false));
                                  }
              
            else
                cache.position.amountOut += uint128(params.zeroForOne ? ConstantProduct.getDx(params.amount, cache.position.claimPriceLast, cache.priceUpper, false)
                                                                      : ConstantProduct.getDy(params.amount, cache.priceLower, cache.position.claimPriceLast, false));
        }
        console.log('position amounts', cache.position.amountIn, cache.position.amountOut, ticks[params.claim].priceAt);
        return cache;
    }
}