// SPDX-License-Identifier: BSD
pragma solidity 0.8.13;

import { Clone } from "../../libraries/solady/Clone.sol";

contract RangePoolERC1155Immutables is Clone {
    function poolImpl() public pure returns (address) {
        return _getArgAddress(0);
    }
}