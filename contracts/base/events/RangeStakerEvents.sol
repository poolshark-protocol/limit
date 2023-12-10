// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

abstract contract RangeStakerEvents {
    event StakeRange(
        address pool,
        uint32 positionId,
        address recipient,
        uint256 feeGrowthInside0Last,
        uint256 feeGrowthInside1Last,
        uint128 liquidity
    );

    event UnstakeRange(address pool, uint32 positionId, address recipient);

    event StakeRangeAccrued(
        address pool,
        uint32 positionId,
        uint256 feeGrowth0Accrued,
        uint256 feeGrowth1Accrued
    );

    event FeeToTransfer(
        address indexed previousFeeTo,
        address indexed newFeeTo
    );

    event OwnerTransfer(
        address indexed previousOwner,
        address indexed newOwner
    );
}
