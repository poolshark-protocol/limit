// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../../interfaces/limit/ILimitPoolStructs.sol';
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
        ILimitPoolStructs.BurnLimitParams memory params,
        ILimitPoolStructs.BurnLimitCache memory cache,
        PoolsharkStructs.TickMap storage tickMap,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.LimitPosition)))
            storage positions
    ) external returns (ILimitPoolStructs.BurnLimitCache memory) {
        if (params.lower >= params.upper) require (false, 'InvalidPositionBounds()');
        if (cache.position.epochLast == 0) require(false, 'PositionNotFound()');
        if (cache.position.crossedInto
            || params.claim != (params.zeroForOne ? params.lower : params.upper)
            || cache.position.epochLast < (params.zeroForOne ? EpochMap.get(params.lower, params.zeroForOne, tickMap, cache.constants)
                                                             : EpochMap.get(params.upper, params.zeroForOne, tickMap, cache.constants)))
        {
            // position has been crossed into
            (
                cache.state,
                cache.position,
                params.claim
            ) = LimitPositions.update(
                positions,
                ticks,
                tickMap,
                cache.state,
                ILimitPoolStructs.UpdateLimitParams(
                    msg.sender,
                    params.to,
                    params.burnPercent,
                    params.lower,
                    params.upper,
                    params.claim,
                    params.zeroForOne
                ),
                cache.constants
            );
        } else {
            // position has not been crossed into
            (cache.state, cache.position) = LimitPositions.remove(
                positions,
                ticks,
                tickMap,
                cache.state,
                ILimitPoolStructs.UpdateLimitParams(
                    msg.sender,
                    params.to,
                    params.burnPercent,
                    params.lower,
                    params.upper,
                    params.zeroForOne ? params.lower : params.upper,
                    params.zeroForOne
                ),
                cache.constants
            );
        }
        cache = Collect.burnLimit(
            cache,
            params
        );
        if ((params.zeroForOne ? params.claim != params.upper
                               : params.claim != params.lower))
            params.zeroForOne
                ? positions[msg.sender][params.claim][params.upper] = cache.position
                : positions[msg.sender][params.lower][params.claim] = cache.position;
        return cache;
    }
}
