// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import '../../../interfaces/range/IRangePoolStructs.sol';
import '../../utils/SafeTransfers.sol';
import '../../utils/Collect.sol';
import '../RangeTokens.sol';
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
        mapping(uint256 => IRangePoolStructs.RangePosition)
            storage positions,
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        IRangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.GlobalState storage globalState,
        IRangePoolStructs.MintCache memory cache,
        IRangePoolStructs.MintParams memory params
    ) external returns (IRangePoolStructs.MintCache memory) {
        // id of 0 can be passed to create new position
        if (params.positionId > 0) {
            // existing position
            if (RangeTokens.balanceOf(cache.constants, msg.sender, params.positionId) == 0)
                // check for balance held
                require(false, 'PositionNotFound()');
            // set bounds as defined by position
            params.lower = cache.position.lower;
            params.upper = cache.position.upper;
            // update existing position
            cache.position = RangePositions.update(
                    ticks,
                    cache.position,
                    cache.state,
                    cache.constants,
                    IRangePoolStructs.UpdateParams(
                        params.lower,
                        params.upper,
                        params.positionId,
                        0
                    )
            );
        } else {
            // create a new position
            params.positionId = cache.state.positionIdNext;
            // increment for next position
            cache.state.positionIdNext += 1;
            // set tick bounds on position
            cache.position.lower = params.lower;
            cache.position.upper = params.upper;
        }
        console.log('position amounts', cache.position.amount0, cache.position.amount1);
        (params, cache) = RangePositions.validate(params, cache);
        console.log('position amounts', cache.position.amount0, cache.position.amount1);
        if (params.amount0 > 0) SafeTransfers.transferIn(cache.constants.token0, params.amount0);
        if (params.amount1 > 0) SafeTransfers.transferIn(cache.constants.token1, params.amount1);
        // compound and transfer remaining back to user
        if (cache.position.amount0 > 0 || cache.position.amount1 > 0) {
            (cache.position, cache.state) = RangePositions.compound(
                ticks,
                tickMap,
                samples,
                cache.state,
                cache.constants,
                cache.position,
                IRangePoolStructs.CompoundParams( 
                    cache.priceLower,
                    cache.priceUpper
                )
            );
        }
        console.log('position amounts', cache.position.amount0, cache.position.amount1);
        // update position with latest fees accrued
        cache = RangePositions.add(
            ticks,
            samples,
            tickMap,
            cache,
            params
        );
        cache.position = Collect.range(
           cache.position,
           cache.constants,
           params.to 
        );
        // save changes to storage
        save(positions, globalState, cache, params.positionId);
        return cache;
    }

    function save(
        mapping(uint256 => IRangePoolStructs.RangePosition)
            storage positions,
        PoolsharkStructs.GlobalState storage globalState,
        IRangePoolStructs.MintCache memory cache,
        uint32 positionId
    ) internal {
        positions[positionId] = cache.position;
        globalState.pool = cache.state.pool;
        globalState.liquidityGlobal = cache.state.liquidityGlobal;
        globalState.positionIdNext = cache.state.positionIdNext;
    }
}
