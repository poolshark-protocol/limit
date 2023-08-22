// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

abstract contract PoolsharkRouterEvents {
    event RouterDeployed(
        address router,
        address limitPoolFactory,
        address coverPoolFactory
    );
}
