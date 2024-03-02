// SPDX-License-Identifier: SSPL-1.0

pragma solidity 0.8.18;

import '../structs/PoolsharkStructs.sol';

interface ILimitStaker is PoolsharkStructs {
    function stakeLimit(StakeLimitParams memory) external;
}
