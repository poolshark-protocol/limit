// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

import '../../interfaces/structs/PoolsharkStructs.sol';

abstract contract LimitPoolManagerEvents is PoolsharkStructs {
    event FactoryChanged(address indexed previousFactory, address indexed newFactory);
    event FeeDeltaConstChanged(uint16 oldFeeDeltaConst, uint16 newFeeDeltaConst);
    event PoolTypeEnabled(
        bytes32 poolTypeName,
        address poolImpl,
        address tokenImpl,
        uint16  poolTypeId
    );
    event FeeTierEnabled(
        uint16 swapFee,
        int16 tickSpacing
    );
    event FeeToTransfer(address indexed previousFeeTo, address indexed newFeeTo);
    event OwnerTransfer(address indexed previousOwner, address indexed newOwner);
    event ProtocolSwapFeesModified(
        address[] pools,
        int16[] protocolSwapFees0,
        int16[] protocolSwapFees1
    );
    event ProtocolFillFeesModified(
        address[] pools,
        int16[] protocolFillFees0,
        int16[] protocolFillFees1
    );
    event ProtocolFeesCollected(
        address[] pools,
        uint128[] token0FeesCollected,
        uint128[] token1FeesCollected
    );
}