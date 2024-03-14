// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.21;

import {Clone} from '../../external/solady/Clone.sol';

contract PositionERC1155Immutables is Clone {
    function tokenName() public pure returns (bytes32) {
        return _getArgBytes32(0);
    }

    function tokenSymbol() public pure returns (bytes32) {
        return _getArgBytes32(32);
    }
}
