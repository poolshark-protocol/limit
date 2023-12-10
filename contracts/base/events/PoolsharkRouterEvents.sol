// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

/// @notice Events emitted by the PoolsharkRouter contract
abstract contract PoolsharkRouterEvents {
    /// @notice Event emitted when the router is initially deployed
    event RouterDeployed(
        address router,
        address limitPoolFactory,
        address coverPoolFactory
    );
}
