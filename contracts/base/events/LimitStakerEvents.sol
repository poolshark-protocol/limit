// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.21;

/// @notice Events emitted by the LimitStaker contract
abstract contract LimitStakerEvents {
    /// @notice Event emitted when a LimitPosition is staked
    event StakeLimit(
        address pool,
        uint32 positionId,
        address recipient,
        uint128 liquidity,
        bool zeroForOne
    );

    /// @notice Event emitted when a Limit Position is unstaked
    event UnstakeLimit(address pool, uint32 positionId, address recipient);

    /// @notice Event emitted when a staked LimitPosition accrues fills
    event StakeLimitAccrued(
        address pool,
        uint32 positionId,
        uint128 amountInClaimed,
        bool zeroForOne
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
