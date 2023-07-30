// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../interfaces/ILimitPoolStructs.sol';
import '../../libraries/TickMap.sol';

contract TickMapTest {
    ILimitPoolStructs.TickMap public tickMap;

    using TickMap for ILimitPoolStructs.TickMap;

    function get(
        int24 tick,
        int16 tickSpacing
    ) external view returns (
        bool exists
    ) {
        return tickMap.get(tick, tickSpacing);
    }

    function set(
        int24 tick,
        int16 tickSpacing
    ) external returns (
        bool exists
    ) {
        return tickMap.set(tick, tickSpacing);
    }

    function unset(
        int24 tick,
        int16 tickSpacing
    ) external {
        tickMap.unset(tick, tickSpacing);
    }

    function previous(
        int24 tick,
        int16 tickSpacing,
        bool inclusive
    ) external view returns (
        int24 previousTick
    ) {
        return tickMap.previous(tick, tickSpacing, inclusive);
    }

    function next(
        int24 tick,
        int16 tickSpacing
    ) external view returns (
        int24 nextTick
    ) {
        return tickMap.next(tick, tickSpacing);
    }

    function getIndices(
        int24 tick,
        int16 tickSpacing
    ) public pure returns (
        uint256 tickIndex,
        uint256 wordIndex,
        uint256 blockIndex
    ) {
        return TickMap.getIndices(tick, tickSpacing);
    }

    function getTickIndex(
        uint256 tickIndex,
        int16 tickSpacing
    ) external pure returns (
        int24 tick
    ) {
        return TickMap._tick(tickIndex, tickSpacing);
    }

    function round(
        int24 tick,
        int16 tickSpacing
    ) external pure returns (
        int24 roundedTick
    ) {
        return TickMap.round(tick, tickSpacing);
    }

    function roundHalf(
        int24 tick,
        int16 tickSpacing,
        uint256 price
    ) external pure returns (
        int24 roundedTick,
        uint160 roundedTickPrice
    )
    {
        ILimitPoolStructs.Immutables memory constants;
        constants.tickSpacing = tickSpacing;
        return TickMap.roundHalf(tick, constants, price);
    }

    function roundAhead(
        int24 tick,
        int16 tickSpacing,
        bool zeroForOne,
        uint256 price
    ) external pure returns (
        int24 roundedTick
    ) {
        ILimitPoolStructs.Immutables memory constants;
        constants.tickSpacing = tickSpacing;
        return TickMap.roundAhead(tick, constants, zeroForOne, price);
    }

    function roundBack(
        int24 tick,
        int16 tickSpacing,
        bool zeroForOne,
        uint256 price
    ) external pure returns (
        int24 roundedTick
    ) {
        ILimitPoolStructs.Immutables memory constants;
        constants.tickSpacing = tickSpacing;
        return TickMap.roundBack(tick, constants, zeroForOne, price);
    }
}