// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../../interfaces/structs/LimitPoolStructs.sol';
import '../../../interfaces/IPositionERC1155.sol';
import '../LimitPositions.sol';
import '../../utils/Collect.sol';
import '../../utils/PositionTokens.sol';

library BurnLimitCall {
    event BurnLimit(
        address indexed to,
        uint32 positionId,
        int24 lower,
        int24 upper,
        int24 oldClaim,
        int24 newClaim,
        bool zeroForOne,
        uint128 liquidityBurned,
        uint128 tokenInClaimed,
        uint128 tokenOutBurned
    );

    function perform(
        mapping(uint256 => LimitPoolStructs.LimitPosition)
            storage positions,
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.GlobalState storage globalState,
        PoolsharkStructs.BurnLimitParams memory params,
        LimitPoolStructs.BurnLimitCache memory cache
    ) external {
        // check for invalid receiver
        if (params.to == address(0))
            require(false, 'CollectToZeroAddress()');

        // initialize cache
        cache.state = globalState;
        cache.position = positions[params.positionId];

        // check positionId owner
        if (PositionTokens.balanceOf(cache.constants, msg.sender, params.positionId) == 0)
            require(false, 'PositionNotFound()');
        
        // update position
        (
            params,
            cache
        ) = LimitPositions.update(
            ticks,
            tickMap,
            cache,
            params
        );

        // save position before transfer
        if ((params.zeroForOne ? params.claim != cache.position.upper
                               : params.claim != cache.position.lower)) {
            if (cache.position.liquidity > 0) {
                if (params.zeroForOne) {
                    cache.position.lower = params.claim;
                } else {
                    cache.position.upper = params.claim;
                }
                positions[params.positionId] = cache.position;
            } else {
                IPositionERC1155(cache.constants.poolToken).burn(msg.sender, params.positionId, 1, cache.constants);
                delete positions[params.positionId];
            }
        } else {
            IPositionERC1155(cache.constants.poolToken).burn(msg.sender, params.positionId, 1, cache.constants);
            delete positions[params.positionId];
        }

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
