// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import '../../interfaces/ILimitPoolStructs.sol';
import '../Positions.sol';
import '../utils/Collect.sol';
import 'hardhat/console.sol';

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
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.Position)))
            storage positions
    ) external returns (ILimitPoolStructs.MintCache memory) {
        // resize position if necessary
        (params, cache.liquidityMinted) = Positions.resize(
            cache.position,
            params, 
            cache.state,
            cache.constants
        );

        // params.amount must be > 0 here
        SafeTransfers.transferIn(params.zeroForOne ? cache.constants.token0 
                                                   : cache.constants.token1,
                                 params.amount
                                );

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
            uint160 priceLower = TickMath.getPriceAtTick(params.lower, cache.constants);
            console.log('price lower check', priceLower < cache.pool.price, priceLower, cache.pool.price);
            if (priceLower < cache.pool.price) {
                cache.pool.swapEpoch += 1;
                if (cache.pool.liquidity > 0) {
                    console.log('changing liquidity');
                    Ticks.insertSingle(ticks, tickMap, cache.pool, cache.constants);
                }
                cache.pool.price = priceLower;
                cache.pool.tickAtPrice = params.lower;
                cache.pool.liquidity = uint128(cache.liquidityMinted);
                // set epoch on start tick to signify position being crossed into
                EpochMap.set(params.lower, cache.pool.swapEpoch, tickMap, cache.constants);
            } else if (priceLower == cache.pool.price) {
                cache.pool.liquidity += uint128(cache.liquidityMinted);
            }
        } else {
            uint160 priceUpper = TickMath.getPriceAtTick(params.upper, cache.constants);
            console.log('ticks -100 check:');
            console.logInt(ticks[-100].liquidityDelta);
            if (priceUpper > cache.pool.price) {
                cache.pool.swapEpoch += 1;
                if (cache.pool.liquidity > 0) {
                    console.log('changing liquidity');
                    Ticks.insertSingle(ticks, tickMap, cache.pool, cache.constants);
                } else {
                    console.log('not changing liquidity');
                }
                cache.pool.price = priceUpper;
                cache.pool.tickAtPrice = params.upper;
                cache.pool.liquidity = uint128(cache.liquidityMinted);
                // set epoch on start tick to signify position being crossed into
                EpochMap.set(params.upper, cache.pool.swapEpoch, tickMap, cache.constants);
            } else if (priceUpper == cache.pool.price) {
                cache.pool.liquidity += uint128(cache.liquidityMinted);
            }
        }
        console.log('pool0', cache.pool.liquidity, params.zeroForOne);
        positions[params.to][params.lower][params.upper] = cache.position;
        return cache;
    }
}
