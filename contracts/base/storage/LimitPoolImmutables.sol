// SPDX-License-Identifier: BSD
pragma solidity ^0.8.4;

import { Clone } from "../../libraries/solady/Clone.sol";

contract LimitPoolImmutables is Clone {
    function owner() public pure returns (address) {
        return _getArgAddress(0);
    }

    function token0() public pure returns (address) {
        return _getArgAddress(20);
    }

    function token1() public pure returns (address) {
        return _getArgAddress(40);
    }

    function poolToken() public pure returns (address) {
        return _getArgAddress(60);
    }

    function minPrice() public pure returns (uint160) {
        return _getArgUint160(80);
    }

    function maxPrice() public pure returns (uint160) {
        return _getArgUint160(100);
    }

    function genesisTime() public pure returns (uint32) {
        return _getArgUint32(120);
    }

    function tickSpacing() public pure returns (int16) {
        return int16(_getArgUint16(124));
    }

    function swapFee() public pure returns (uint16) {
        return _getArgUint16(126);
    }
}