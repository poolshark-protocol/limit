// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;

import '../interfaces/modules/curves/ICurveMath.sol';
import '../interfaces/modules/sources/ITwapSource.sol';
import '../interfaces/ILimitPoolStructs.sol';
import './Deltas.sol';
import './TickMap.sol';
import './EpochMap.sol';

library Epochs {
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    event Sync(
        uint160 pool0Price,
        uint160 pool1Price,
        uint128 pool0Liquidity,
        uint128 pool1Liquidity,
        uint32 auctionStart,
        uint32 swapEpoch,
        int24 oldLatestTick,
        int24 newLatestTick
    );

    event FinalDeltasAccumulated(
        uint128 amountInDelta,
        uint128 amountOutDelta,
        uint32 swapEpoch,
        int24 accumTick,
        bool isPool0
    );

    event StashDeltasCleared(
        int24 stashTick,
        bool isPool0
    );

    event StashDeltasAccumulated(
        uint128 amountInDelta,
        uint128 amountOutDelta,
        uint128 amountInDeltaMaxStashed,
        uint128 amountOutDeltaMaxStashed,
        uint32 swapEpoch,
        int24 stashTick,
        bool isPool0
    );

    event SyncFeesCollected(
        address collector,
        uint128 token0Amount,
        uint128 token1Amount
    );

    function simulateSync(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks0,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks1,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.PoolState memory pool0,
        ILimitPoolStructs.PoolState memory pool1,
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.Immutables memory constants
    ) external view returns (
        ILimitPoolStructs.GlobalState memory,
        ILimitPoolStructs.SyncFees memory,
        ILimitPoolStructs.PoolState memory,
        ILimitPoolStructs.PoolState memory
    ) {
        ILimitPoolStructs.AccumulateCache memory cache;
        {
            bool earlyReturn;
            (cache.newLatestTick, earlyReturn) = _syncTick(state, constants);
            if (earlyReturn) {
                return (state, ILimitPoolStructs.SyncFees(0, 0), pool0, pool1);
            }
            // else we have a TWAP update
        }

        // setup cache
        cache = ILimitPoolStructs.AccumulateCache({
            deltas0: ILimitPoolStructs.Deltas(0, 0, 0, 0), // deltas for pool0
            deltas1: ILimitPoolStructs.Deltas(0, 0, 0, 0),  // deltas for pool1
            syncFees: ILimitPoolStructs.SyncFees(0, 0),
            newLatestTick: cache.newLatestTick,
            nextTickToCross0: state.latestTick, // above
            nextTickToCross1: state.latestTick, // below
            nextTickToAccum0: TickMap.previous(state.latestTick, tickMap, constants), // below
            nextTickToAccum1: TickMap.next(state.latestTick, tickMap, constants),     // above
            stopTick0: (cache.newLatestTick > state.latestTick) // where we do stop for pool0 sync
                ? state.latestTick - constants.tickSpread
                : cache.newLatestTick, 
            stopTick1: (cache.newLatestTick > state.latestTick) // where we do stop for pool1 sync
                ? cache.newLatestTick
                : state.latestTick + constants.tickSpread
        });

        while (true) {
            // rollover and calculate sync fees
            (cache, pool0) = _rollover(state, cache, pool0, constants, true);
            // keep looping until accumulation reaches stopTick0 
            if (cache.nextTickToAccum0 >= cache.stopTick0) {
                (pool0.liquidity, cache.nextTickToCross0, cache.nextTickToAccum0) = _cross(
                    ticks0[cache.nextTickToAccum0].liquidityDelta,
                    tickMap,
                    constants,
                    cache.nextTickToCross0,
                    cache.nextTickToAccum0,
                    pool0.liquidity,
                    true
                );
            } else break;
        }

        while (true) {
            (cache, pool1) = _rollover(state, cache, pool1, constants, false);
            // keep looping until accumulation reaches stopTick1 
            if (cache.nextTickToAccum1 <= cache.stopTick1) {
                (pool1.liquidity, cache.nextTickToCross1, cache.nextTickToAccum1) = _cross(
                    ticks1[cache.nextTickToAccum1].liquidityDelta,
                    tickMap,
                    constants,
                    cache.nextTickToCross1,
                    cache.nextTickToAccum1,
                    pool1.liquidity,
                    false
                );
            } else break;
        }

        // update ending pool price for fully filled auction
        state.latestPrice = ConstantProduct.getPriceAtTick(cache.newLatestTick, constants);
        
        // set pool price and liquidity
        if (cache.newLatestTick > state.latestTick) {
            pool0.liquidity = 0;
            pool0.price = state.latestPrice;
            pool1.price = ConstantProduct.getPriceAtTick(cache.newLatestTick + constants.tickSpread, constants);
        } else {
            pool1.liquidity = 0;
            pool0.price = ConstantProduct.getPriceAtTick(cache.newLatestTick - constants.tickSpread, constants);
            pool1.price = state.latestPrice;
        }
        
        // set auction start as an offset of the pool genesis block
        state.auctionStart = uint32(block.timestamp) - constants.genesisTime;
        state.latestTick = cache.newLatestTick;
    
        return (state, cache.syncFees, pool0, pool1);
    }

    function syncLatest(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks0,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks1,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.PoolState memory pool0,
        ILimitPoolStructs.PoolState memory pool1,
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.Immutables memory constants
    ) external returns (
        ILimitPoolStructs.GlobalState memory,
        ILimitPoolStructs.SyncFees memory,
        ILimitPoolStructs.PoolState memory,
        ILimitPoolStructs.PoolState memory
    )
    {
        ILimitPoolStructs.AccumulateCache memory cache;
        {
            bool earlyReturn;
            (cache.newLatestTick, earlyReturn) = _syncTick(state, constants);
            if (earlyReturn) {
                return (state, ILimitPoolStructs.SyncFees(0,0), pool0, pool1);
            }
            // else we have a TWAP update
        }

        // increase epoch counter
        state.swapEpoch += 1;

        // setup cache
        cache = ILimitPoolStructs.AccumulateCache({
            deltas0: ILimitPoolStructs.Deltas(0, 0, 0, 0), // deltas for pool0
            deltas1: ILimitPoolStructs.Deltas(0, 0, 0, 0),  // deltas for pool1
            syncFees: ILimitPoolStructs.SyncFees(0,0),
                newLatestTick: cache.newLatestTick,
            nextTickToCross0: state.latestTick, // above
            nextTickToCross1: state.latestTick, // below
            nextTickToAccum0: TickMap.previous(state.latestTick, tickMap, constants), // below
            nextTickToAccum1: TickMap.next(state.latestTick, tickMap, constants),     // above
            stopTick0: (cache.newLatestTick > state.latestTick) // where we do stop for pool0 sync
                ? state.latestTick - constants.tickSpread
                : cache.newLatestTick, 
            stopTick1: (cache.newLatestTick > state.latestTick) // where we do stop for pool1 sync
                ? cache.newLatestTick
                : state.latestTick + constants.tickSpread
        });

        while (true) {
            // get values from current auction
            (cache, pool0) = _rollover(state, cache, pool0, constants, true);
            if (cache.nextTickToAccum0 > cache.stopTick0 
                 && ticks0[cache.nextTickToAccum0].amountInDeltaMaxMinus > 0) {
                EpochMap.set(cache.nextTickToAccum0, state.swapEpoch, tickMap, constants);
            }
            // accumulate to next tick
            ILimitPoolStructs.AccumulateParams memory params = ILimitPoolStructs.AccumulateParams({
                deltas: cache.deltas0,
                crossTick: ticks0[cache.nextTickToCross0],
                accumTick: ticks0[cache.nextTickToAccum0],
                updateAccumDeltas: cache.newLatestTick > state.latestTick
                                            ? cache.nextTickToAccum0 == cache.stopTick0
                                            : cache.nextTickToAccum0 >= cache.stopTick0,
                isPool0: true
            });
            params = _accumulate(
                cache,
                params,
                state
            );
            /// @dev - deltas in cache updated after _accumulate
            cache.deltas0 = params.deltas;
            ticks0[cache.nextTickToCross0] = params.crossTick;
            ticks0[cache.nextTickToAccum0] = params.accumTick;
            
            // keep looping until accumulation reaches stopTick0 
            if (cache.nextTickToAccum0 >= cache.stopTick0) {
                (pool0.liquidity, cache.nextTickToCross0, cache.nextTickToAccum0) = _cross(
                    ticks0[cache.nextTickToAccum0].liquidityDelta,
                    tickMap,
                    constants,
                    cache.nextTickToCross0,
                    cache.nextTickToAccum0,
                    pool0.liquidity,
                    true
                );
            } else break;
        }
        // pool0 checkpoint
        {
            // create stopTick0 if necessary
            if (cache.nextTickToAccum0 != cache.stopTick0) {
                TickMap.set(cache.stopTick0, tickMap, constants);
            }
            ILimitPoolStructs.Tick memory stopTick0 = ticks0[cache.stopTick0];
            // checkpoint at stopTick0
            (stopTick0) = _stash(
                stopTick0,
                cache,
                state,
                pool0.liquidity,
                true
            );
            EpochMap.set(cache.stopTick0, state.swapEpoch, tickMap, constants);
            ticks0[cache.stopTick0] = stopTick0;
        }

        while (true) {
            // rollover deltas pool1
            (cache, pool1) = _rollover(state, cache, pool1, constants, false);
            // accumulate deltas pool1
            if (cache.nextTickToAccum1 < cache.stopTick1 
                 && ticks1[cache.nextTickToAccum1].amountInDeltaMaxMinus > 0) {
                EpochMap.set(cache.nextTickToAccum1, state.swapEpoch, tickMap, constants);
            }
            {
                ILimitPoolStructs.AccumulateParams memory params = ILimitPoolStructs.AccumulateParams({
                    deltas: cache.deltas1,
                    crossTick: ticks1[cache.nextTickToCross1],
                    accumTick: ticks1[cache.nextTickToAccum1],
                    updateAccumDeltas: cache.newLatestTick > state.latestTick
                                                ? cache.nextTickToAccum1 <= cache.stopTick1
                                                : cache.nextTickToAccum1 == cache.stopTick1,
                    isPool0: false
                });
                params = _accumulate(
                    cache,
                    params,
                    state
                );
                /// @dev - deltas in cache updated after _accumulate
                cache.deltas1 = params.deltas;
                ticks1[cache.nextTickToCross1] = params.crossTick;
                ticks1[cache.nextTickToAccum1] = params.accumTick;
            }
            // keep looping until accumulation reaches stopTick1 
            if (cache.nextTickToAccum1 <= cache.stopTick1) {
                (pool1.liquidity, cache.nextTickToCross1, cache.nextTickToAccum1) = _cross(
                    ticks1[cache.nextTickToAccum1].liquidityDelta,
                    tickMap,
                    constants,
                    cache.nextTickToCross1,
                    cache.nextTickToAccum1,
                    pool1.liquidity,
                    false
                );
            } else break;
        }
        // pool1 checkpoint
        {
            // create stopTick1 if necessary
            if (cache.nextTickToAccum1 != cache.stopTick1) {
                TickMap.set(cache.stopTick1, tickMap, constants);
            }
            ILimitPoolStructs.Tick memory stopTick1 = ticks1[cache.stopTick1];
            // update deltas on stopTick
            (stopTick1) = _stash(
                stopTick1,
                cache,
                state,
                pool1.liquidity,
                false
            );
            ticks1[cache.stopTick1] = stopTick1;
            EpochMap.set(cache.stopTick1, state.swapEpoch, tickMap, constants);
        }
        // update ending pool price for fully filled auction
        state.latestPrice = ConstantProduct.getPriceAtTick(cache.newLatestTick, constants);
        
        // set pool price and liquidity
        if (cache.newLatestTick > state.latestTick) {
            pool0.liquidity = 0;
            pool0.price = state.latestPrice;
            pool1.price = ConstantProduct.getPriceAtTick(cache.newLatestTick + constants.tickSpread, constants);
        } else {
            pool1.liquidity = 0;
            pool0.price = ConstantProduct.getPriceAtTick(cache.newLatestTick - constants.tickSpread, constants);
            pool1.price = state.latestPrice;
        }
        
        // set auction start as an offset of the pool genesis block
        state.auctionStart = uint32(block.timestamp) - constants.genesisTime;

        // emit sync event
        emit Sync(pool0.price, pool1.price, pool0.liquidity, pool1.liquidity, state.auctionStart, state.swapEpoch, state.latestTick, cache.newLatestTick);
        
        // update latestTick
        state.latestTick = cache.newLatestTick;

        if (cache.syncFees.token0 > 0 || cache.syncFees.token1 > 0) {
            emit SyncFeesCollected(msg.sender, cache.syncFees.token0, cache.syncFees.token1);
        }
    
        return (state, cache.syncFees, pool0, pool1);
    }

    function _syncTick(
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.Immutables memory constants
    ) internal view returns(
        int24 newLatestTick,
        bool
    ) {
        // update last block checked
        if(state.lastTime == uint32(block.timestamp) - constants.genesisTime) {
            return (state.latestTick, true);
        }
        state.lastTime = uint32(block.timestamp) - constants.genesisTime;
        // check auctions elapsed
        uint32 timeElapsed = state.lastTime - state.auctionStart;
        int32 auctionsElapsed = int32(timeElapsed / constants.twapLength) - 1; /// @dev - subtract 1 for 3/4 twapLength check
        // if 3/4 of twapLength has passed allow for latestTick move
        if (timeElapsed > 3 * constants.twapLength / 4) auctionsElapsed += 1;

        if (auctionsElapsed < 1) {
            return (state.latestTick, true);
        }
        newLatestTick = constants.source.calculateAverageTick(constants);
        /// @dev - shift up/down one quartile to put pool ahead of TWAP
        if (newLatestTick > state.latestTick)
             newLatestTick += constants.tickSpread / 4;
        else if (newLatestTick <= state.latestTick - 3 * constants.tickSpread / 4)
             newLatestTick -= constants.tickSpread / 4;
        newLatestTick = newLatestTick / constants.tickSpread * constants.tickSpread; // even multiple of tickSpread
        if (newLatestTick == state.latestTick) {
            return (state.latestTick, true);
        }

        // rate-limiting tick move
        int24 maxLatestTickMove = int24(constants.tickSpread * auctionsElapsed);

        /// @dev - latestTick can only move based on auctionsElapsed 
        if (newLatestTick > state.latestTick) {
            if (newLatestTick - state.latestTick > maxLatestTickMove)
                newLatestTick = state.latestTick + maxLatestTickMove;
        } else {
            if (state.latestTick - newLatestTick > maxLatestTickMove)
                newLatestTick = state.latestTick - maxLatestTickMove;
        }

        return (newLatestTick, false);
    }

    function _rollover(
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.AccumulateCache memory cache,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.Immutables memory constants,
        bool isPool0
    ) internal pure returns (
        ILimitPoolStructs.AccumulateCache memory,
        ILimitPoolStructs.PoolState memory
    ) {
        //TODO: add syncing fee
        if (pool.liquidity == 0) {
            return (cache, pool);
        }
        uint160 crossPrice; uint160 accumPrice; uint160 currentPrice;
        if (isPool0) {
            crossPrice = ConstantProduct.getPriceAtTick(cache.nextTickToCross0, constants);
            int24 nextTickToAccum = (cache.nextTickToAccum0 < cache.stopTick0)
                                        ? cache.stopTick0
                                        : cache.nextTickToAccum0;
            accumPrice = ConstantProduct.getPriceAtTick(nextTickToAccum, constants);
            // check for multiple auction skips
            if (cache.nextTickToCross0 == state.latestTick && cache.nextTickToCross0 - nextTickToAccum > constants.tickSpread) {
                uint160 spreadPrice = ConstantProduct.getPriceAtTick(cache.nextTickToCross0 - constants.tickSpread, constants);
                /// @dev - amountOutDeltaMax accounted for down below
                cache.deltas0.amountOutDelta += uint128(ConstantProduct.getDx(pool.liquidity, accumPrice, spreadPrice, false));
            }
            currentPrice = pool.price;
            // if pool.price the bounds set currentPrice to start of auction
            if (!(pool.price > accumPrice && pool.price < crossPrice)) currentPrice = accumPrice;
            // if auction is current and fully filled => set currentPrice to crossPrice
            if (state.latestTick == cache.nextTickToCross0 && crossPrice == pool.price) currentPrice = crossPrice;
        } else {
            crossPrice = ConstantProduct.getPriceAtTick(cache.nextTickToCross1, constants);
            int24 nextTickToAccum = (cache.nextTickToAccum1 > cache.stopTick1)
                                        ? cache.stopTick1
                                        : cache.nextTickToAccum1;
            accumPrice = ConstantProduct.getPriceAtTick(nextTickToAccum, constants);
            // check for multiple auction skips
            if (cache.nextTickToCross1 == state.latestTick && nextTickToAccum - cache.nextTickToCross1 > constants.tickSpread) {
                uint160 spreadPrice = ConstantProduct.getPriceAtTick(cache.nextTickToCross1 + constants.tickSpread, constants);
                /// @dev - DeltaMax values accounted for down below
                cache.deltas1.amountOutDelta += uint128(ConstantProduct.getDy(pool.liquidity, spreadPrice, accumPrice, false));
            }
            currentPrice = pool.price;
            if (!(pool.price < accumPrice && pool.price > crossPrice)) currentPrice = accumPrice;
            if (state.latestTick == cache.nextTickToCross1 && crossPrice == pool.price) currentPrice = crossPrice;
        }

        //handle liquidity rollover
        if (isPool0) {
            {
                // amountIn pool did not receive
                uint128 amountInDelta;
                uint128 amountInDeltaMax  = uint128(ConstantProduct.getDy(pool.liquidity, accumPrice, crossPrice, false));
                amountInDelta       = pool.amountInDelta;
                amountInDeltaMax   -= (amountInDeltaMax < pool.amountInDeltaMaxClaimed) ? amountInDeltaMax 
                                                                                        : pool.amountInDeltaMaxClaimed;
                pool.amountInDelta  = 0;
                pool.amountInDeltaMaxClaimed = 0;

                // update cache in deltas
                cache.deltas0.amountInDelta     += amountInDelta;
                cache.deltas0.amountInDeltaMax  += amountInDeltaMax;
            }
            {
                // amountOut pool has leftover
                uint128 amountOutDelta    = uint128(ConstantProduct.getDx(pool.liquidity, currentPrice, crossPrice, false));
                uint128 amountOutDeltaMax = uint128(ConstantProduct.getDx(pool.liquidity, accumPrice, crossPrice, false));
                amountOutDeltaMax -= (amountOutDeltaMax < pool.amountOutDeltaMaxClaimed) ? amountOutDeltaMax
                                                                                        : pool.amountOutDeltaMaxClaimed;
                pool.amountOutDeltaMaxClaimed = 0;

                // calculate sync fee
                uint128 syncFeeAmount = state.syncFee * amountOutDelta / 1e6;
                cache.syncFees.token0 += syncFeeAmount;
                amountOutDelta -= syncFeeAmount;

                // update cache out deltas
                cache.deltas0.amountOutDelta    += amountOutDelta;
                cache.deltas0.amountOutDeltaMax += amountOutDeltaMax;
            }
        } else {
            {
                // amountIn pool did not receive
                uint128 amountInDelta;
                uint128 amountInDeltaMax = uint128(ConstantProduct.getDx(pool.liquidity, crossPrice, accumPrice, false));
                amountInDelta       = pool.amountInDelta;
                amountInDeltaMax   -= (amountInDeltaMax < pool.amountInDeltaMaxClaimed) ? amountInDeltaMax 
                                                                                        : pool.amountInDeltaMaxClaimed;
                pool.amountInDelta  = 0;
                pool.amountInDeltaMaxClaimed = 0;

                // update cache in deltas
                cache.deltas1.amountInDelta     += amountInDelta;
                cache.deltas1.amountInDeltaMax  += amountInDeltaMax;
            }
            {
                // amountOut pool has leftover
                uint128 amountOutDelta    = uint128(ConstantProduct.getDy(pool.liquidity, crossPrice, currentPrice, false));
                uint128 amountOutDeltaMax = uint128(ConstantProduct.getDy(pool.liquidity, crossPrice, accumPrice, false));
                amountOutDeltaMax -= (amountOutDeltaMax < pool.amountOutDeltaMaxClaimed) ? amountOutDeltaMax
                                                                                        : pool.amountOutDeltaMaxClaimed;
                pool.amountOutDeltaMaxClaimed = 0;

                // calculate sync fee
                uint128 syncFeeAmount = state.syncFee * amountOutDelta / 1e6;
                cache.syncFees.token1 += syncFeeAmount;
                amountOutDelta -= syncFeeAmount;    

                // update cache out deltas
                cache.deltas1.amountOutDelta    += amountOutDelta;
                cache.deltas1.amountOutDeltaMax += amountOutDeltaMax;
            }
        }
        return (cache, pool);
    }

    function _accumulate(
        ILimitPoolStructs.AccumulateCache memory cache,
        ILimitPoolStructs.AccumulateParams memory params,
        ILimitPoolStructs.GlobalState memory state
    ) internal returns (
        ILimitPoolStructs.AccumulateParams memory
    ) {
        if (params.crossTick.amountInDeltaMaxStashed > 0) {
            /// @dev - else we migrate carry deltas onto cache
            // add carry amounts to cache
            (params.crossTick, params.deltas) = Deltas.unstash(params.crossTick, params.deltas);
            // clear out stash
            params.crossTick.amountInDeltaMaxStashed  = 0;
            params.crossTick.amountOutDeltaMaxStashed = 0;
            emit StashDeltasCleared(
                params.isPool0 ? cache.nextTickToCross0 : cache.nextTickToCross1,
                params.isPool0
            );
        }
        if (params.updateAccumDeltas) {
            // migrate carry deltas from cache to accum tick
            ILimitPoolStructs.Deltas memory accumDeltas;
            if (params.accumTick.amountInDeltaMaxMinus > 0) {
                // calculate percent of deltas left on tick
                uint256 percentInOnTick  = uint256(params.accumTick.amountInDeltaMaxMinus)  * 1e38 / (params.deltas.amountInDeltaMax);
                uint256 percentOutOnTick = uint256(params.accumTick.amountOutDeltaMaxMinus) * 1e38 / (params.deltas.amountOutDeltaMax);
                // transfer deltas to the accum tick
                (params.deltas, accumDeltas) = Deltas.transfer(params.deltas, accumDeltas, percentInOnTick, percentOutOnTick);
                
                // burn tick deltas maxes from cache
                params.deltas = Deltas.burnMaxCache(params.deltas, params.accumTick);
                
                // empty delta max minuses into delta max
                accumDeltas.amountInDeltaMax  += params.accumTick.amountInDeltaMaxMinus;
                accumDeltas.amountOutDeltaMax += params.accumTick.amountOutDeltaMaxMinus;

                // clear out delta max minus and save on tick
                params.accumTick.amountInDeltaMaxMinus  = 0;
                params.accumTick.amountOutDeltaMaxMinus = 0;
                params.accumTick.deltas = accumDeltas;

                emit FinalDeltasAccumulated(
                    accumDeltas.amountInDelta,
                    accumDeltas.amountOutDelta,
                    state.swapEpoch,
                    params.isPool0 ? cache.nextTickToAccum0 : cache.nextTickToAccum1,
                    params.isPool0
                );
            }
        }
        // remove all liquidity
        params.crossTick.liquidityDelta = 0;

        return params;
    }

    //maybe call ticks on msg.sender to get tick
    function _cross(
        int128 liquidityDelta,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.Immutables memory constants,
        int24 nextTickToCross,
        int24 nextTickToAccum,
        uint128 currentLiquidity,
        bool zeroForOne
    ) internal view returns (
        uint128,
        int24,
        int24
    )
    {
        nextTickToCross = nextTickToAccum;

        if (liquidityDelta > 0) {
            currentLiquidity += uint128(liquidityDelta);
        } else {
            currentLiquidity -= uint128(-liquidityDelta);
        }
        if (zeroForOne) {
            nextTickToAccum = TickMap.previous(nextTickToAccum, tickMap, constants);
        } else {
            nextTickToAccum = TickMap.next(nextTickToAccum, tickMap, constants);
        }
        return (currentLiquidity, nextTickToCross, nextTickToAccum);
    }

    function _stash(
        ILimitPoolStructs.Tick memory stashTick,
        ILimitPoolStructs.AccumulateCache memory cache,
        ILimitPoolStructs.GlobalState memory state,
        uint128 currentLiquidity,
        bool isPool0
    ) internal returns (ILimitPoolStructs.Tick memory) {
        // return since there is nothing to update
        if (currentLiquidity == 0) return (stashTick);
        // handle deltas
        ILimitPoolStructs.Deltas memory deltas = isPool0 ? cache.deltas0 : cache.deltas1;
        emit StashDeltasAccumulated(
            deltas.amountInDelta,
            deltas.amountOutDelta,
            deltas.amountInDeltaMax,
            deltas.amountOutDeltaMax,
            state.swapEpoch,
            isPool0 ? cache.stopTick0 : cache.stopTick1,
            isPool0
        );
        if (deltas.amountInDeltaMax > 0) {
            (deltas, stashTick) = Deltas.stash(deltas, stashTick);
        }
        stashTick.liquidityDelta += int128(currentLiquidity);
        return (stashTick);
    }
}
