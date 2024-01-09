// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.18;

/// @notice Events emitted by the LimitPoolFactory contract
abstract contract LimitPoolFactoryEvents {

    /////////////////////////////////////////////////////////////
    /////////////////////// Custom Events ///////////////////////
    /////////////////////////////////////////////////////////////

    event LimitPoolCreated(
        address pool,
        address token,
        address indexed token0,
        address indexed token1,
        uint16 indexed swapFee,
        int16 tickSpacing,
        uint16 poolTypeId
    );

    /////////////////////////////////////////////////////////////
    ////////////////////// Standard Events //////////////////////
    /////////////////////////////////////////////////////////////

    event PoolCreated(
        address indexed token0,
        address indexed token1,
        uint24 indexed fee,
        int24 tickSpacing,
        address pool
    );
}
