// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../interfaces/ILimitPoolStructs.sol';
import '../../libraries/EpochMap.sol';

contract EpochMapTest {
    ILimitPoolStructs.TickMap public tickMap;

    using EpochMap for ILimitPoolStructs.TickMap;

    function get(
        int24 tick,
        int16 tickSpacing
    ) external view returns (
        uint32 epoch
    ) {
        ILimitPoolStructs.Immutables memory constants;
        constants.tickSpacing = tickSpacing;
        return EpochMap.get(tick, tickMap, constants);
    }

    function set(
        int24 tick,
        uint256 epoch,
        int16 tickSpacing
    ) external {
        ILimitPoolStructs.Immutables memory constants;
        constants.tickSpacing = tickSpacing;
        return EpochMap.set(tick, epoch, tickMap, constants);
    }

    function unset(
        int24 tick,
        int16 tickSpacing
    ) external {
        ILimitPoolStructs.Immutables memory constants;
        constants.tickSpacing = tickSpacing;
        return EpochMap.unset(tick, tickMap, constants);
    }

    function getIndices(
        int24 tick,
        int16 tickSpacing
    ) external pure returns (
        uint256 tickIndex,
        uint256 wordIndex,
        uint256 blockIndex,
        uint256 volumeIndex
    ) {
        ILimitPoolStructs.Immutables memory constants;
        constants.tickSpacing = tickSpacing;
        return EpochMap.getIndices(tick, constants);
    }

    function getTickIndex(
        uint256 tickIndex,
        int16 tickSpacing
    ) external pure returns (
        int24 tick
    ) {
        ILimitPoolStructs.Immutables memory constants;
        constants.tickSpacing = tickSpacing;
        return EpochMap._tick(tickIndex, constants);
    }

    function round(
        int24 tick,
        int16 tickSpacing
    ) external pure returns (
        int24 roundedTick
    ) {
        return EpochMap._round(tick, tickSpacing);
    }
}