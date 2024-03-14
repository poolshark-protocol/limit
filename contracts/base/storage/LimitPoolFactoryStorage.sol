// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.21;

abstract contract LimitPoolFactoryStorage {
    mapping(bytes32 => address) public pools; ///@dev - map for limit pool lookup by key
}
