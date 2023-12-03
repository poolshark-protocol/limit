// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../../interfaces/structs/RangePoolStructs.sol';
import '../../utils/Collect.sol';
import '../../utils/PositionTokens.sol';
import '../RangePositions.sol';

library BurnRangeCall {
    using SafeCast for int128;

    event BurnRange(
        address indexed recipient,
        int24 lower,
        int24 upper,
        uint256 indexed tokenId,
        uint128 liquidityBurned,
        uint128 amount0,
        uint128 amount1
    );

    function perform(
        mapping(uint256 => RangePoolStructs.RangePosition)
            storage positions,
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.GlobalState storage globalState,
        RangePoolStructs.BurnRangeCache memory cache,
        RangePoolStructs.BurnRangeParams memory params
    ) external {
        // check for invalid receiver
        if (params.to == address(0))
            require(false, "CollectToZeroAddress()");
        
        // initialize cache
        cache.state = globalState;
        cache.position = positions[params.positionId];

        if (cache.position.liquidity == 0)
            require(false, 'PositionNotFound()');
        if (PositionTokens.balanceOf(cache.constants, msg.sender, params.positionId) == 0)
            require(false, 'PositionOwnerMismatch()');

        ( 
            cache.position,
            cache.amount0,
            cache.amount1
        ) = RangePositions.update(
                ticks,
                cache.position,
                cache.state,
                cache.constants,
                RangePoolStructs.UpdateParams(
                    cache.position.lower,
                    cache.position.upper,
                    params.positionId,
                    params.burnPercent
                )
        );
        cache = RangePositions.remove(
            ticks,
            samples,
            tickMap,
            params,
            cache
        );
        // only compound if burnPercent is zero
        if (params.burnPercent == 0)
            if (cache.amount0 > 0 || cache.amount1 > 0) {
                (
                    cache.position,
                    cache.state,
                    cache.amount0,
                    cache.amount1
                ) = RangePositions.compound(
                    ticks,
                    tickMap,
                    samples,
                    cache.state,
                    cache.constants,
                    cache.position,
                    RangePoolStructs.CompoundRangeParams(
                        cache.priceLower,
                        cache.priceUpper,
                        cache.amount0.toUint128(),
                        cache.amount1.toUint128(),
                        params.positionId
                    )
                );
            }
        // save changes to storage
        save(positions, globalState, cache, params.positionId);

        // transfer amounts to user
        if (cache.amount0 > 0 || cache.amount1 > 0)
            Collect.range(
                cache.constants,
                params.to,
                cache.amount0,
                cache.amount1
            );
    }

    function save(
        mapping(uint256 => RangePoolStructs.RangePosition)
            storage positions,
        PoolsharkStructs.GlobalState storage globalState,
        RangePoolStructs.BurnRangeCache memory cache,
        uint32 positionId
    ) internal {
        positions[positionId] = cache.position;
        globalState.pool = cache.state.pool;
        globalState.liquidityGlobal = cache.state.liquidityGlobal;
    }
}
