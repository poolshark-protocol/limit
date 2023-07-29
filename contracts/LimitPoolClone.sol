// SPDX-License-Identifier: BSD
pragma solidity ^0.8.4;

import { Clone } from "./libraries/solady/Clone.sol";

contract LimitPoolClone is Clone {
    function owner() public pure returns (address) {
        return _getArgAddress(0);
    }

    function token0() public pure returns (address) {
        return _getArgAddress(20);
    }

    function token1() public pure returns (address) {
        return _getArgAddress(40);
    }

    function minPrice() public pure returns (uint160) {
        return _getArgUint160(60);
    }

    function maxPrice() public pure returns (uint160) {
        return _getArgUint160(80);
    }

    function tickSpacing() public pure returns (int16) {
        return int16(_getArgUint16(100));
    }
}