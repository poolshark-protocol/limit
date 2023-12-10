// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

/// @notice Events emitted by the RangeStaker contract
abstract contract RangeStakerEvents {
    /// @notice Event emitted when a RangePosition is staked
    event StakeRange(
        address pool,
        uint32 positionId,
        address recipient,
        uint256 feeGrowthInside0Last,
        uint256 feeGrowthInside1Last,
        uint128 liquidity
    );

    /// @notice Event emitted when a Range Position is unstaked
    event UnstakeRange(address pool, uint32 positionId, address recipient);

    /// @notice Event emitted when a staked RangePosition accrues fees
    event StakeRangeAccrued(
        address pool,
        uint32 positionId,
        uint256 feeGrowth0Accrued,
        uint256 feeGrowth1Accrued
    );

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
}
