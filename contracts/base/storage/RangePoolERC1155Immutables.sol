// SPDX-License-Identifier: BSD
pragma solidity ^0.8.4;

import { Clone } from "../../libraries/solady/Clone.sol";

contract LimitPoolImmutables is Clone {
    function owner() public pure returns (address) {
        return _getArgAddress(0);
    }
}