// SPDX-License-Identifier: AGPL-3.0-only

pragma solidity 0.8.18;

import '../structs/PoolsharkStructs.sol';

interface IRangeStaker is PoolsharkStructs {
    function stakeRange(StakeRangeParams memory) external;
}
