// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import '../../ILimitPoolStructs.sol';

interface ITwapSource {
    function initialize(
        ILimitPoolStructs.Immutables memory constants
    ) external returns (
        uint8 initializable,
        int24 startingTick
    );

    function calculateAverageTick(
        ILimitPoolStructs.Immutables memory constants
    ) external view returns (
        int24 averageTick
    );

    function getPool(
        address tokenA,
        address tokenB,
        uint16 feeTier
    ) external view returns (
        address pool
    );

    function feeTierTickSpacing(
        uint16 feeTier
    ) external view returns (
        int24 tickSpacing
    );

    function factory()
    external view returns (address);
}
