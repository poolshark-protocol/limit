// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

library Bytes {
    function getSender(bytes memory data) internal view returns (address result) {
        if (data.length == 32) {
            result = abi.decode(data, (address));
        } else if (data.length > 32) {
            (result,) = abi.decode(data, (address, bytes1[]));
        }
        if (result == address(0)) {
            result = msg.sender;
        }
    }
}