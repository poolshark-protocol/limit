// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import '../structs/PoolsharkStructs.sol';

interface IRangeStaker is PoolsharkStructs {
    function stakeRange(StakeRangeParams memory) external;
}
