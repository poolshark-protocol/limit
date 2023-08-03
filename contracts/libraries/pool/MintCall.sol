// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../interfaces/ILimitPoolStructs.sol';
import '../Positions.sol';
import '../utils/Collect.sol';

library MintCall {
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
        ILimitPoolStructs.MintParams memory params,
        ILimitPoolStructs.MintCache memory cache,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.PoolState storage pool,
        ILimitPoolStructs.PoolState storage swapPool,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        mapping(int24 => ILimitPoolStructs.Tick) storage swapTicks,
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.Position)))
            storage positions
    ) external returns (ILimitPoolStructs.MintCache memory) {
        // bump swapPool in case user is trying to undercut
        // this avoids trimming positions unnecessarily
        if (cache.swapPool.liquidity == 0) {
            (cache, cache.swapPool) = Ticks.unlock(cache, cache.swapPool, swapTicks, tickMap, !params.zeroForOne);
        }

        // resize position if necessary
        (params, cache) = Positions.resize(
            params,
            cache,
            tickMap,
            swapTicks
        );
        // save state for safe reentrancy
        save(cache.swapPool, swapPool);
        // load position given params
        cache.position = positions[params.to][params.lower][params.upper];
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
        // bump to the next tick if there is no liquidity
        if (cache.pool.liquidity == 0) {
            /// @dev - this makes sure to have liquidity unlocked if undercutting
            (cache, cache.pool) = Ticks.unlock(cache, cache.pool, ticks, tickMap, params.zeroForOne);
        }
        // mint position if amount is left
        if (params.amount > 0 && params.lower < params.upper) {
            /// @auditor not sure if the lower >= upper case is possible
            (cache.pool, cache.position) = Positions.add(
                cache,
                ticks,
                tickMap,
                params
            );
            if (params.zeroForOne) {
                uint160 priceLower = ConstantProduct.getPriceAtTick(params.lower, cache.constants);
                if (priceLower <= cache.pool.price) {
                    // save liquidity if active
                    if (cache.pool.liquidity > 0) {
                        cache.pool = Ticks.insertSingle(params, ticks, tickMap, cache, cache.pool, cache.constants);
                    }
                    cache.pool.price = priceLower;
                    cache.pool.tickAtPrice = params.lower;
                    /// @auditor - double check liquidity is set correctly for this in insertSingle
                    cache.pool.liquidity += uint128(cache.liquidityMinted);
                    cache.pool.swapEpoch += 1;
                    cache.position.claimPriceLast = ConstantProduct.getPriceAtTick(params.lower, cache.constants);
                    // set epoch on start tick to signify position being crossed into
                    /// @auditor - this is safe assuming we have swapped at least this far on the other side
                    EpochMap.set(params.lower, cache.pool.swapEpoch, tickMap, cache.constants);
                    emit Sync(cache.pool.price, cache.pool.liquidity);
                }
            } else {
                uint160 priceUpper = ConstantProduct.getPriceAtTick(params.upper, cache.constants);
                if (priceUpper >= cache.pool.price) {
                    if (cache.pool.liquidity > 0) {
                        cache.pool = Ticks.insertSingle(params, ticks, tickMap, cache, cache.pool, cache.constants);
                    }
                    cache.pool.price = priceUpper;
                    cache.pool.tickAtPrice = params.upper;
                    cache.pool.liquidity += uint128(cache.liquidityMinted);
                    cache.pool.swapEpoch += 1;
                    cache.position.claimPriceLast = ConstantProduct.getPriceAtTick(params.upper, cache.constants);
                    // set epoch on start tick to signify position being crossed into
                    /// @auditor - this is safe assuming we have swapped at least this far on the other side
                    EpochMap.set(params.upper, cache.pool.swapEpoch, tickMap, cache.constants);
                    emit Sync(cache.pool.price, cache.pool.liquidity);
                }
            }
            // save lp side for safe reentrancy
            save(cache.pool, pool);

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
        return cache;
    }

    function save(
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.PoolState storage poolState
    ) internal {
        poolState.price = pool.price;
        poolState.liquidity = pool.liquidity;
        poolState.liquidityGlobal = pool.liquidityGlobal;
        poolState.swapEpoch = pool.swapEpoch;
        poolState.tickAtPrice = pool.tickAtPrice;
    }
}
