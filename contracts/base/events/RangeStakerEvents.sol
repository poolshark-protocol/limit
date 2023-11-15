// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

abstract contract RangeStakerEvents {
    event StakeRange( 
        address pool,
        uint32 positionId,
        uint256 feeGrowthInside0Last,
        uint256 feeGrowthInside1Last,
        uint128 liquidity
    );

    event UnstakeRange(
        address pool,
        uint32 positionId
    );

    event StakeRangeAccrued(
        address pool,
        uint32 positionId,
        uint256 feeGrowth0Accrued,
        uint256 feeGrowth1Accrued
    );

    event StakeRangeBurn(
        address pool,
        uint32 positionId,
        uint128 newLiquidity
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
