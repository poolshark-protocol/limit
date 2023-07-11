// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import '../../interfaces/ILimitPoolStructs.sol';
import '../Positions.sol';
import '../utils/Collect.sol';

library MintCall {
    event Mint(
        address indexed to,
        int24 lower,
        int24 upper,
        bool zeroForOne,
        uint32 epochLast,
        uint128 amountIn,
        uint128 liquidityMinted,
        uint128 amountInDeltaMaxMinted,
        uint128 amountOutDeltaMaxMinted
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
        // resize position if necessary
        (params, cache) = Positions.resize(
            params,
            cache,
            tickMap,
            swapTicks
        );
        save(cache.swapPool, swapPool);
        SafeTransfers.transferIn(
                                 params.zeroForOne ? cache.constants.token0 
                                                   : cache.constants.token1,
                                 params.amount + cache.swapCache.input
                                );
        if (cache.swapCache.output > 0)
            SafeTransfers.transferOut(
                params.to,
                params.zeroForOne ? cache.constants.token1 
                                  : cache.constants.token0,
                cache.swapCache.output
            );
        console.log('swap output', cache.swapCache.output, cache.swapCache.input);
        // bump to the next tick if there is no liquidity
        if (cache.pool.liquidity == 0) {
            cache = Ticks._unlock(cache, ticks, tickMap, params.zeroForOne);
        }
        if (params.amount > 0) {
            (cache.pool, cache.position) = Positions.add(
                cache.position,
                ticks,
                tickMap,
                cache.pool,
                ILimitPoolStructs.AddParams(
                    params.to,
                    uint128(cache.liquidityMinted),
                    params.amount,
                    params.lower,
                    params.upper,
                    params.zeroForOne
                ),
                cache.constants
            );
            if (params.zeroForOne) {
                console.log('epoch check');
                uint160 priceLower = TickMath.getPriceAtTick(params.lower, cache.constants);
                if (priceLower < cache.pool.price) {
                    if (cache.pool.liquidity > 0) {
                        Ticks.insertSingle(ticks, tickMap, cache.pool, cache.constants);
                    }
                    cache.pool.price = priceLower;
                    cache.pool.tickAtPrice = params.lower;
                    cache.pool.liquidity = uint128(cache.liquidityMinted);
                    // set epoch on start tick to signify position being crossed into
                    cache.pool.swapEpoch += 1;
                    console.log('epoch set for start tick', uint24(params.lower), uint24(params.upper));
                    EpochMap.set(params.lower, cache.pool.swapEpoch, tickMap, cache.constants);
                } else if (priceLower == cache.pool.price) {
                    cache.pool.liquidity += uint128(cache.liquidityMinted);
                }
            } else {
                uint160 priceUpper = TickMath.getPriceAtTick(params.upper, cache.constants);
                console.log('price check', priceUpper, cache.pool.price, cache.pool.liquidity);
                if (priceUpper > cache.pool.price) {
                    if (cache.pool.liquidity > 0) {
                        Ticks.insertSingle(ticks, tickMap, cache.pool, cache.constants);
                    }
                    cache.pool.price = priceUpper;
                    cache.pool.tickAtPrice = params.upper;
                    cache.pool.liquidity = uint128(cache.liquidityMinted);
                    // set epoch on start tick to signify position being crossed into
                    cache.pool.swapEpoch += 1;
                    EpochMap.set(params.upper, cache.pool.swapEpoch, tickMap, cache.constants);
                } else if (priceUpper == cache.pool.price) {
                    cache.pool.liquidity += uint128(cache.liquidityMinted);
                }
            }
            save(cache.pool, pool);
            positions[params.to][params.lower][params.upper] = cache.position;
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
