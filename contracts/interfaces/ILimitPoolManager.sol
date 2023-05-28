// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

import '../base/structs/LimitPoolManagerStructs.sol';

/// @notice LimitPoolManager interface
interface ILimitPoolManager is LimitPoolManagerStructs {
    function owner() external view returns (address);
    function feeTo() external view returns (address);
    function tickSpacings(
        int16 tickSpacing
    ) external view returns (
        bool
    );
}
