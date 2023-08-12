// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

abstract contract LimitPoolManagerEvents {
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
    event ProtocolFeesModified(
        address[] modifyPools,
        uint16[] syncFees,
        uint16[] fillFees,
        bool[] setFees,
        uint128[] token0Fees,
        uint128[] token1Fees
    );
    event ProtocolFeesCollected(
        address[] collectPools,
        uint128[] token0Fees,
        uint128[] token1Fees
    );
}