// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

/// @notice Events emitted by the PositionERC1155 contract(s)
abstract contract PositionERC1155Events {
    /// @notice Event emitted when single token is transferred
    event TransferSingle(
        address indexed sender,
        address indexed from,
        address indexed to,
        uint256 id,
        uint256 amount
    );

    /// @notice Event emitted when multiple tokens are transferred
    event TransferBatch(
        address indexed sender,
        address indexed from,
        address indexed to,
        uint256[] ids,
        uint256[] amounts
    );

    /// @notice Event emitted when spender is approved for all token ids
    event ApprovalForAll(
        address indexed account,
        address indexed sender,
        bool approve
    );
}
