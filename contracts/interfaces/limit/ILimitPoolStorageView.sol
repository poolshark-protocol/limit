// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.18;

import '../structs/LimitPoolStructs.sol';

interface ILimitPoolStorageView is LimitPoolStructs {
    function globalState()
        external
        view
        returns (
            RangePoolState memory pool,
            LimitPoolState memory pool0,
            LimitPoolState memory pool1,
            uint128 liquidityGlobal,
            uint32 positionIdNext,
            uint32 epoch,
            uint8 unlocked
        );
    
    function ticks(int24 tickIndex)
        external
        view
        returns (
            RangeTick memory,
            LimitTick memory
        );

    function positions0(uint256 positionId)
        external
        returns (uint128 liquidity, uint32 epochLast, int24 lower, int24 upper, bool crossedInto);

    function positions1(uint256 positionId)
        external
        returns (uint128 liquidity, uint32 epochLast, int24 lower, int24 upper, bool crossedInto);
}
