// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../../interfaces/limit/ILimitPoolStructs.sol';
import '../PositionsLimit.sol';
import '../../utils/Collect.sol';

library MintLimitCall {
    event MintLimit(
        address indexed to,
        int24 lower,
        int24 upper,
        bool zeroForOne,
        uint32 epochLast,
        uint128 amountIn,
        uint128 amountFilled,
        uint128 liquidityMinted
    );

    event Sync(
        uint160 price,
        uint128 liquidity
    );

    function perform(
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.LimitPosition)))
            storage positions,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.GlobalState storage globalState,
        ILimitPoolStructs.MintLimitParams memory params,
        ILimitPoolStructs.MintLimitCache memory cache
    ) external returns (ILimitPoolStructs.MintLimitCache memory) {
        // bump swapPool in case user is trying to undercut
        // this avoids trimming positions unnecessarily
        if (cache.swapPool.liquidity == 0) {
            (cache, cache.swapPool) = TicksLimit.unlock(cache, cache.swapPool, ticks, limitTickMap, !params.zeroForOne);
        }

        // resize position if necessary
        (params, cache) = PositionsLimit.resize(
            ticks,
            rangeTickMap,
            limitTickMap,
            params,
            cache
        );

        // save state for safe reentrancy
        save(cache, globalState, !params.zeroForOne);

        // transfer in token amount
        SafeTransfers.transferIn(
                                 params.zeroForOne ? cache.constants.token0 
                                                   : cache.constants.token1,
                                 params.amount + cache.swapCache.input
                                );
        // if swap output
        if (cache.swapCache.output > 0)
            SafeTransfers.transferOut(
                params.to,
                params.zeroForOne ? cache.constants.token1 
                                  : cache.constants.token0,
                cache.swapCache.output
            );

        // mint position if amount is left
        if (params.amount > 0 && params.lower < params.upper) {
            // load position given params
            cache.position = positions[params.to][params.lower][params.upper];
            
            // bump to the next tick if there is no liquidity
            if (cache.pool.liquidity == 0) {
                /// @dev - this makes sure to have liquidity unlocked if undercutting
                (cache, cache.pool) = TicksLimit.unlock(cache, cache.pool, ticks, limitTickMap, params.zeroForOne);
            }

            if (params.zeroForOne) {
                uint160 priceLower = ConstantProduct.getPriceAtTick(params.lower, cache.constants);
                if (priceLower <= cache.pool.price) {
                    // save liquidity if active
                    if (cache.pool.liquidity > 0) {
                        cache.pool = TicksLimit.insertSingle(params, ticks, limitTickMap, cache, cache.pool, cache.constants);
                    }
                    cache.pool.price = priceLower;
                    cache.pool.tickAtPrice = params.lower;
                    /// @auditor - double check liquidity is set correctly for this in insertSingle
                    cache.pool.liquidity += uint128(cache.liquidityMinted);
                    cache.position.crossedInto = true;
                    // set epoch on start tick to signify position being crossed into
                    /// @auditor - this is safe assuming we have swapped at least this far on the other side
                    emit Sync(cache.pool.price, cache.pool.liquidity);
                }
            } else {
                uint160 priceUpper = ConstantProduct.getPriceAtTick(params.upper, cache.constants);
                if (priceUpper >= cache.pool.price) {
                    if (cache.pool.liquidity > 0) {
                        cache.pool = TicksLimit.insertSingle(params, ticks, limitTickMap, cache, cache.pool, cache.constants);
                    }
                    cache.pool.price = priceUpper;
                    cache.pool.tickAtPrice = params.upper;
                    cache.pool.liquidity += uint128(cache.liquidityMinted);
                    cache.position.crossedInto = true;
                    // set epoch on start tick to signify position being crossed into
                    /// @auditor - this is safe assuming we have swapped at least this far on the other side
                    emit Sync(cache.pool.price, cache.pool.liquidity);
                }
            }
            (cache.pool, cache.position) = PositionsLimit.add(
                cache,
                ticks,
                limitTickMap,
                params
            );

            // save position to storage
            positions[params.to][params.lower][params.upper] = cache.position;

            emit MintLimit(
                params.to,
                params.lower,
                params.upper,
                params.zeroForOne,
                cache.position.epochLast,
                uint128(params.amount + cache.swapCache.input),
                uint128(cache.swapCache.output),
                uint128(cache.liquidityMinted)
            );
        }

        // save lp side for safe reentrancy
        save(cache, globalState, params.zeroForOne);

        return cache;
    }

    function save(
        ILimitPoolStructs.MintLimitCache memory cache,
        PoolsharkStructs.GlobalState storage globalState,
        bool zeroForOne
    ) internal {
        globalState.epoch = cache.state.epoch;
        if (zeroForOne) {
            globalState.pool = cache.state.pool;
            globalState.pool0 = cache.swapPool;
        } else {
            globalState.pool = cache.state.pool;
            globalState.pool1 = cache.swapPool;
        }
    }
}
