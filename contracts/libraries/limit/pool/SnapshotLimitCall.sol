// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../../interfaces/limit/ILimitPoolStructs.sol';
import '../LimitPositions.sol';
import '../../utils/Collect.sol';

library SnapshotLimitCall {
    uint8 private constant _ENTERED = 2;

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
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.LimitPosition)))
            storage positions,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.GlobalState memory state,
        ILimitPoolStructs.BurnLimitParams memory params
    ) external view returns (
        uint128,
        uint128
    )
    {
        if (state.unlocked == _ENTERED)
            require(false, 'ReentrancyGuardReadOnlyReentrantCall()');
        ILimitPoolStructs.BurnLimitCache memory cache;
        cache.state = state;
        cache.position = positions[msg.sender][params.lower][params.upper];
        if (params.lower >= params.upper) require (false, 'InvalidPositionBounds()');
        if (cache.position.epochLast == 0) require(false, 'PositionNotFound()');
        return LimitPositions.snapshot(
            positions,
            ticks,
            tickMap,
            cache,
            params
        );
    }
}
