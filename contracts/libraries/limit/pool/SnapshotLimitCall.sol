// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../../interfaces/structs/LimitPoolStructs.sol';
import '../LimitPositions.sol';
import '../../utils/Collect.sol';

library SnapshotLimitCall {
    uint8 private constant _ENTERED = 2;

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
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.Immutables memory constants,
        LimitPoolStructs.SnapshotLimitParams memory params
    ) external view returns (
        uint128,
        uint128
    )
    {
        if (state.unlocked == _ENTERED)
            require(false, 'ReentrancyGuardReadOnlyReentrantCall()');
        LimitPoolStructs.BurnLimitCache memory cache;
        cache.state = state;
        cache.constants = constants;
        cache.position = positions[params.positionId];
        LimitPoolStructs.BurnLimitParams memory burnParams = LimitPoolStructs.BurnLimitParams ({
            to: params.owner,
            burnPercent: params.burnPercent,
            positionId: params.positionId,
            claim: params.claim,
            zeroForOne: params.zeroForOne
        });
        if (cache.position.epochLast == 0) require(false, 'PositionNotFound()');
        return LimitPositions.snapshot(
            ticks,
            tickMap,
            cache,
            burnParams
        );
    }
}
