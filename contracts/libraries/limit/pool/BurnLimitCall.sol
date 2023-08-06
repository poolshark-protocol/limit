// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../../interfaces/limit/ILimitPoolStructs.sol';
import '../PositionsLimit.sol';
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
        ILimitPoolStructs.BurnParams memory params,
        ILimitPoolStructs.BurnCache memory cache,
        PoolsharkStructs.TickMap storage tickMap,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.Position)))
            storage positions
    ) external returns (ILimitPoolStructs.BurnCache memory) {
        if (params.lower >= params.upper) require (false, 'InvalidPositionBounds()');
        if (cache.position.epochLast == 0) require(false, 'PositionNotFound()');
        if (cache.position.crossedInto
            || params.claim != (params.zeroForOne ? params.lower : params.upper)
            || cache.position.epochLast < (params.zeroForOne ? EpochMap.get(params.lower, tickMap, cache.constants)
                                                             : EpochMap.get(params.upper, tickMap, cache.constants)))
        {
            // position has been crossed into
            (
                cache.state,
                cache.pool,
                cache.position,
                params.claim
            ) = PositionsLimit.update(
                positions,
                ticks,
                tickMap,
                cache.state,
                cache.pool,
                ILimitPoolStructs.UpdateParams(
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
            (cache.pool, cache.position) = PositionsLimit.remove(
                positions,
                ticks,
                tickMap,
                cache.pool,
                ILimitPoolStructs.UpdateParams(
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
