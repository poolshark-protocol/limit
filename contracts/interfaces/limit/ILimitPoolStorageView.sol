// SPDX-License-Identifier: AGPL-3.0-only
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
}
