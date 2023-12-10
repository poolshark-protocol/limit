// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

abstract contract FinStakerEvents {
    event StakeFin(
        address owner,
        uint256 amount
    );

    event UnstakeFin(
        address pool,
        uint256 amount
    );

    event StakeFinAccrued(
        address owner,
        uint128 stakingPointsAccrued
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
