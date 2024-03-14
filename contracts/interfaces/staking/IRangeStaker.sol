// SPDX-License-Identifier: SSPL-1.0

pragma solidity 0.8.21;

import '../structs/PoolsharkStructs.sol';

interface IRangeStaker is PoolsharkStructs {
    function stakeRange(StakeRangeParams memory) external;
}
