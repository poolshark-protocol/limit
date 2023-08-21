// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../../interfaces/structs/LimitPoolStructs.sol';
import '../LimitPositions.sol';
import '../../utils/Collect.sol';

library BurnLimitCall {
    event BurnLimit(
        address indexed to,
        int24 lower,
        int24 upper,
        int24 claim,
        bool zeroForOne,
        uint128 liquidityBurned,
        uint128 tokenInClaimed,
        uint128 tokenOutBurned
    );

    function perform(
        mapping(address => mapping(int24 => mapping(int24 => LimitPoolStructs.LimitPosition)))
            storage positions,
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.GlobalState storage globalState,
        LimitPoolStructs.BurnLimitParams memory params,
        LimitPoolStructs.BurnLimitCache memory cache
    ) external {
        // if (params.to == address(0)) require(false, 'CollectToZeroAddress()');
        cache.state = globalState;
        cache.position = positions[msg.sender][params.lower][params.upper];
        if (params.lower >= params.upper) require (false, 'InvalidPositionBounds()');
        if (cache.position.epochLast == 0) require(false, 'PositionNotFound()');
        if (cache.position.crossedInto
            || params.claim != (params.zeroForOne ? params.lower : params.upper)
            || cache.position.epochLast < (params.zeroForOne ? EpochMap.get(params.lower, params.zeroForOne, tickMap, cache.constants)
                                                             : EpochMap.get(params.upper, params.zeroForOne, tickMap, cache.constants)))
        {
            // position has been crossed into
            (
                params,
                cache
            ) = LimitPositions.update(
                positions,
                ticks,
                tickMap,
                cache,
                params
            );
        } else {
            // position has not been crossed into
            (params, cache) = LimitPositions.remove(
                ticks,
                tickMap,
                params,
                cache
            );
        }
        // save position before transfer
        if ((params.zeroForOne ? params.claim != params.upper
                               : params.claim != params.lower))
            params.zeroForOne
                ? positions[msg.sender][params.claim][params.upper] = cache.position
                : positions[msg.sender][params.lower][params.claim] = cache.position;

        // save state before transfer call
        save(cache, globalState, params.zeroForOne);
        
        cache = Collect.burnLimit(
            cache,
            params
        );
    }

    function save(
        LimitPoolStructs.BurnLimitCache memory cache,
        PoolsharkStructs.GlobalState storage globalState,
        bool zeroForOne
    ) internal {
        globalState.epoch = cache.state.epoch;
        globalState.liquidityGlobal = cache.state.liquidityGlobal;
        if (zeroForOne) {
            globalState.pool = cache.state.pool;
            globalState.pool0 = cache.state.pool0;
        } else {
            globalState.pool = cache.state.pool;
            globalState.pool1 = cache.state.pool1;
        }
    }
}
