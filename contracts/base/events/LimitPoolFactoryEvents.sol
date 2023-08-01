// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

abstract contract LimitPoolFactoryEvents {
    event PoolCreated(
        address pool,
        address implementation,
        address indexed token0,
        address indexed token1,
        int16 indexed tickSpacing
    );
}
