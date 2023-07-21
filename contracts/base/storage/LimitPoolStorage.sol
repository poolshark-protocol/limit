// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../interfaces/ILimitPoolStructs.sol';
import '../../interfaces/ILimitPoolFactory.sol';
import '../../utils/LimitPoolErrors.sol';

abstract contract LimitPoolStorage is ILimitPoolStructs, LimitPoolErrors {
    GlobalState public globalState;
    PoolState public pool0; /// @dev State for token0 as output
    PoolState public pool1; /// @dev State for token1 as output
    TickMap public tickMap;
    address public feeTo;
    mapping(int24 => Tick) public ticks0; /// @dev Ticks containing token0 as output
    mapping(int24 => Tick) public ticks1; /// @dev Ticks containing token1 as output
    mapping(address => mapping(int24 => mapping(int24 => Position))) public positions0; //positions with token0 deposited
    mapping(address => mapping(int24 => mapping(int24 => Position))) public positions1; //positions with token1 deposited
}
