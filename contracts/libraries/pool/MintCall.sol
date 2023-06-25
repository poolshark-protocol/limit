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
        if (params.zeroForOne) {
            uint160 priceLower = TickMath.getPriceAtTick(params.lower, cache.constants);
            if (priceLower < cache.pool.price) {
                cache.pool.price = priceLower;
                cache.pool.tickAtPrice = params.lower;
                cache.pool.liquidity = uint128(cache.liquidityMinted);
            }
        } else {
            uint160 priceUpper = TickMath.getPriceAtTick(params.upper, cache.constants);
            if (priceUpper > cache.pool.price) {
                cache.pool.price = priceUpper;
                cache.pool.tickAtPrice = params.upper;
                cache.pool.liquidity = uint128(cache.liquidityMinted);
            }
        }

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
        console.log('pool0', cache.pool.liquidity, params.zeroForOne);
        positions[params.to][params.lower][params.upper] = cache.position;
        return cache;
    }
}
