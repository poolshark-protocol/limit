// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

import '../base/structs/PoolsharkStructs.sol';

interface IPool is PoolsharkStructs {
    function immutables() external view returns (Immutables memory);
    function swap(
        SwapParams memory params
    ) external returns (
        int256 amount0,
        int256 amount1
    );
}
