// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import "../math/OverflowMath.sol";
import "../../interfaces/range/IRangePoolFactory.sol";
import "../../interfaces/range/IRangePoolStructs.sol";

/// @notice Token library for ERC-1155 calls.
library RangeTokens {
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    function balanceOf(
        PoolsharkStructs.Immutables memory constants,
        address owner,
        uint32 positionId
    ) internal view returns (
        uint256
    )
    {
        return IRangePoolERC1155(constants.poolToken).balanceOf(owner, positionId);
    }
}