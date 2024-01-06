// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.18;

abstract contract LimitPoolFactoryStorage {
    mapping(bytes32 => address) public pools; ///@dev - map for limit pool lookup by key
}
