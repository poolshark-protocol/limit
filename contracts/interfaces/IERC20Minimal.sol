// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.18;

interface IERC20Minimal {
    /// @notice Returns the balance of a token
    /// @param account The address for which to look up the balance for
    /// @return amount of tokens held by the account
    function balanceOf(address account) external view returns (uint256);
}
