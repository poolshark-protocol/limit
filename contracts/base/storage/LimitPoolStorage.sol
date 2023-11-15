// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../interfaces/structs/RangePoolStructs.sol';
import '../../interfaces/structs/LimitPoolStructs.sol';
import '../../interfaces/limit/ILimitPoolFactory.sol';
import '../../utils/LimitPoolErrors.sol';

abstract contract LimitPoolStorage is LimitPoolStructs, RangePoolStructs, LimitPoolErrors {
    GlobalState public globalState; ///@dev - holds pool state and other contract storage
    TickMap public rangeTickMap; ///@dev - tick bitmap for range ticks
    TickMap public limitTickMap; ///@dev - tick bitmap for limit ticks
    Sample[65535] public samples; ///@dev - oracle TWAP samples
    mapping(int24 => Tick) public ticks; ///@dev - range and limit tick data
    mapping(uint256 => RangePosition) public positions;  ///@dev - range positions
    mapping(uint256 => LimitPosition) public positions0; ///@dev - limit positions token0 -> token1
    mapping(uint256 => LimitPosition) public positions1; ///@dev - limit positions token1 -> token0
}
