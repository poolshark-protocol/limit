// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../interfaces/structs/RangePoolStructs.sol';
import '../../interfaces/structs/LimitPoolStructs.sol';
import '../../interfaces/limit/ILimitPoolFactory.sol';
import '../../utils/LimitPoolErrors.sol';

abstract contract LimitPoolStorage is LimitPoolStructs, RangePoolStructs, LimitPoolErrors {
    GlobalState public globalState;
    TickMap public rangeTickMap;
    TickMap public limitTickMap;
    Sample[65535] public samples;
    mapping(int24 => Tick) public ticks;
    mapping(uint256 => RangePosition) public positions; /// @dev - positions owned by the pool
    mapping(uint256 => LimitPosition) public positions0; //positions with token0 deposited
    mapping(uint256 => LimitPosition) public positions1; //positions with token1 deposited
}
