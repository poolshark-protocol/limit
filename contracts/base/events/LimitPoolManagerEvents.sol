// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

import '../../interfaces/structs/PoolsharkStructs.sol';

abstract contract LimitPoolManagerEvents is PoolsharkStructs {
    event FactoryChanged(address indexed previousFactory, address indexed newFactory);
    event ImplementationEnabled(
        bytes32 key,
        address poolImpl,
        address tokenImpl
    );
    event FeeTierEnabled(
        uint16 swapFee,
        int16 tickSpacing
    );
    event FeeToTransfer(address indexed previousFeeTo, address indexed newFeeTo);
    event OwnerTransfer(address indexed previousOwner, address indexed newOwner);
    event ProtocolSwapFeesModified(
        address[] pools,
        uint16[] protocolSwapFees0,
        uint16[] protocolSwapFees1
    );
    event ProtocolFillFeesModified(
        address[] pools,
        uint16[] protocolFillFees0,
        uint16[] protocolFillFees1
    );
    event ProtocolFeesCollected(
        address[] pools,
        uint128[] token0FeesCollected,
        uint128[] token1FeesCollected
    );
}