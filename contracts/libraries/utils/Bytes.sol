// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

library Bytes {
    function getSender(bytes memory data, uint256 offset) internal view returns (address result) {
        bytes32 out;

        // extract first 32 bytes
        for (uint i = 0; i < 32; i++) {
            out |= bytes32(data[offset + i] & 0xFF) >> (i * 8);
        }
        // convert to address
        result = address(uint160(uint256(out)));

        // if callback data is empty, use msg.sender
        if (result == address(0))
            result = msg.sender;
    }
}