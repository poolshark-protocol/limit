// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import '../../../interfaces/range/IRangePoolStructs.sol';
import '../../utils/SafeTransfers.sol';
import '../RangePositions.sol';

library MintRangeCall {
    event Mint(
        address indexed recipient,
        int24 lower,
        int24 upper,
        uint256 indexed tokenId,
        uint128 tokenMinted,
        uint128 liquidityMinted,
        uint128 amount0,
        uint128 amount1
    );

    function perform(
        IRangePoolStructs.MintParams memory params,
        IRangePoolStructs.MintCache memory cache,
        PoolsharkStructs.TickMap storage tickMap,
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        IRangePoolStructs.Sample[65535] storage samples
    ) external returns (IRangePoolStructs.MintCache memory) {
        (
            cache.position,
            ,,
        ) = RangePositions.update(
                ticks,
                cache.position,
                cache.state,
                cache.constants,
                IRangePoolStructs.UpdateParams(
                    params.lower,
                    params.upper,
                    0
                )
        );
        (params, cache.liquidityMinted) = RangePositions.validate(params, cache.state, cache.constants);
        if (params.amount0 > 0) SafeTransfers.transferIn(cache.constants.token0, params.amount0);
        if (params.amount1 > 0) SafeTransfers.transferIn(cache.constants.token1, params.amount1);
        if (cache.position.amount0 > 0 || cache.position.amount1 > 0) {
            (cache.position, cache.state) = RangePositions.compound(
                cache.position,
                ticks,
                samples,
                tickMap,
                cache.state,
                IRangePoolStructs.CompoundParams( 
                    params.lower,
                    params.upper
                ),
                cache.constants
            );
        }
        // update position with latest fees accrued
        (cache.state, cache.position, cache.liquidityMinted) = RangePositions.add(
            cache.position,
            ticks,
            samples,
            tickMap,
            IRangePoolStructs.AddParams(
                cache.state, 
                params,
                uint128(cache.liquidityMinted),
                uint128(cache.liquidityMinted)
            ),
            cache.constants
        );
        return cache;
    }
}
