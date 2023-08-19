// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../../interfaces/range/IRangePoolStructs.sol';
import '../../utils/Collect.sol';
import '../RangeTokens.sol';
import '../RangePositions.sol';

library BurnRangeCall {
    event Burn(
        address indexed recipient,
        int24 lower,
        int24 upper,
        uint256 indexed tokenId,
        uint128 liquidityBurned,
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
        IRangePoolStructs.BurnCache memory cache,
        IRangePoolStructs.BurnParams memory params
    ) external {
        if (RangeTokens.balanceOf(cache.constants, msg.sender, params.positionId) == 0)
            require(false, 'PositionNotFound()');
        if (params.burnPercent > 1e38) params.burnPercent = 1e38;
        cache.position = RangePositions.update(
                ticks,
                cache.position,
                cache.state,
                cache.constants,
                IRangePoolStructs.UpdateParams(
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
        cache.position = Collect.range(cache.position, cache.constants, params.to);
        // save changes to storage
        save(positions, globalState, cache, params.positionId);
    }

    function save(
        mapping(uint256 => IRangePoolStructs.RangePosition)
            storage positions,
        PoolsharkStructs.GlobalState storage globalState,
        IRangePoolStructs.BurnCache memory cache,
        uint32 positionId
    ) internal {
        positions[positionId] = cache.position;
        globalState.pool = cache.state.pool;
        globalState.liquidityGlobal = cache.state.liquidityGlobal;
    }
}
