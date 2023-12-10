// SPDX-License-Identifier: BSD
pragma solidity 0.8.18;

import { Clone } from "../../external/solady/Clone.sol";

contract PositionERC1155Immutables is Clone {
    function tokenName() public pure returns (bytes32) {
        return _getArgBytes32(0);
    }

    function tokenSymbol() public pure returns (bytes32) {
        return _getArgBytes32(32);
    }
}