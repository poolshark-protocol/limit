// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.18;

import '../../interfaces/structs/PoolsharkStructs.sol';

/// @notice Events emitted by the LimitPoolManager contract
abstract contract LimitPoolManagerEvents is PoolsharkStructs {

    /////////////////////////////////////////////////////////////
    /////////////////////// Custom Events ///////////////////////
    /////////////////////////////////////////////////////////////

    /// @notice Event emitted when pool is initialized by the factory
    event FactoryChanged(
        address indexed previousFactory,
        address indexed newFactory
    );

    /// @notice Event emitted the fee delta constant is modified
    event FeeDeltaConstChanged(
        uint16 oldFeeDeltaConst,
        uint16 newFeeDeltaConst
    );

    /// @notice Event emitted the fee delta constant is modified
    event PoolFeeDeltaConstChanged(
        address pool,
        uint16 oldFeeDeltaConst,
        uint16 newFeeDeltaConst
    );

    /// @notice Event emitted when a new pool type is enabled
    event PoolTypeEnabled(
        bytes32 poolTypeName,
        address poolImpl,
        address tokenImpl,
        uint16 poolTypeId
    );

    /// @notice Event emitted when a new fee tier is enabled
    event FeeTierEnabled(uint16 swapFee, int16 tickSpacing);

    /// @notice Event emitted when the feeTo address is modified
    event FeeToTransfer(
        address indexed previousFeeTo,
        address indexed newFeeTo
    );

    /// @notice Event emitted when the owner address is modified
    event OwnerTransfer(
        address indexed previousOwner,
        address indexed newOwner
    );

    /// @notice Event emitted when protocolSwapFees0 or protocolSwapFees1 is modified
    event ProtocolSwapFeesModified(
        address[] pools,
        int16[] protocolSwapFees0,
        int16[] protocolSwapFees1
    );

    /// @notice Event emitted when protocolSwapFees0 or protocolSwapFees1 is modified
    event ProtocolFillFeesModified(
        address[] pools,
        int16[] protocolFillFees0,
        int16[] protocolFillFees1
    );

    /// @notice Event emitted when protocol fees are collected
    event ProtocolFeesCollected(
        address[] pools,
        uint128[] token0FeesCollected,
        uint128[] token1FeesCollected
    );
}
