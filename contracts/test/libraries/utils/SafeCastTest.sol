// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../../libraries/utils/SafeCast.sol';

contract SafeCastTest {

    function toUint128(uint256 y) external pure returns (uint128 z) {
        return SafeCast.toUint128(y);
    }

    function toUint160(uint256 y) external pure returns (uint160 z) {
        return SafeCast.toUint160(y);
    }

    function toInt128(int256 y) external pure returns (int128 z) {
        return SafeCast.toInt128(y);
    }

    function toInt256(uint256 y) external pure returns (int256 z) {
        return SafeCast.toInt256(y);
    }
}