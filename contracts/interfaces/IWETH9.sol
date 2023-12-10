// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.18;

interface IWETH9 {
    /// @notice Deposits ether in return for wrapped ether
    function deposit() external payable;

    /// @notice Withdraws ether from wrapped ether balance
    function withdraw(uint wad) external;

    /// @notice Withdraws ether from wrapped ether balance
    function transfer(address dst, uint wad) external returns (bool);

    /// @notice Returns balance for address
    function balanceOf(address account) external returns (uint256);
}