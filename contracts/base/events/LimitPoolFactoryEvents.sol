// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

/// @notice Events emitted by the LimitPoolFactory contract
abstract contract LimitPoolFactoryEvents {
    /// @notice Event emitted when a LimitPool is created
    event PoolCreated(
        address pool,
        address token,
        address indexed token0,
        address indexed token1,
        uint16 indexed swapFee,
        int16 tickSpacing,
        uint16 poolTypeId
    );
}
