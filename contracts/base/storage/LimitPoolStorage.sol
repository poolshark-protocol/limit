// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../interfaces/range/IRangePoolStructs.sol';
import '../../interfaces/limit/ILimitPoolStructs.sol';
import '../../interfaces/limit/ILimitPoolFactory.sol';
import '../../utils/LimitPoolErrors.sol';

abstract contract LimitPoolStorage is ILimitPoolStructs, IRangePoolStructs, LimitPoolErrors {
    GlobalState public globalState;
    TickMap public rangeTickMap;
    TickMap public limitTickMap;
    address public feeTo;
    Sample[65535] public samples;
    mapping(int24 => Tick) public ticks;
    mapping(int24 => mapping(int24 => Position)) public positions; /// @dev - positions owned by the pool
    mapping(address => mapping(int24 => mapping(int24 => LimitPosition))) public positions0; //positions with token0 deposited
    mapping(address => mapping(int24 => mapping(int24 => LimitPosition))) public positions1; //positions with token1 deposited
}
