// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../../interfaces/structs/LimitPoolStructs.sol';
import '../RangePositions.sol';
import '../../utils/Collect.sol';

library SnapshotRangeCall {
    uint8 private constant _ENTERED = 2;

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
        mapping(uint256 => RangePoolStructs.RangePosition)
            storage positions,
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.LimitImmutables memory constants,
        uint32 positionId
    ) external view returns (
        int56,
        uint160,
        uint128,
        uint128
    )
    {
        if (state.unlocked == _ENTERED)
            require(false, 'ReentrancyGuardReadOnlyReentrantCall()');
        return RangePositions.snapshot(
            positions,
            ticks,
            state,
            constants,
            positionId
        );
    }
}
