// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

import '../structs/LimitPoolStructs.sol';

interface ILimitPool is LimitPoolStructs {
    function initialize(
        uint160 startPrice
    ) external;

    function mintLimit(
        MintLimitParams memory params
    ) external;

    function burnLimit(
        BurnLimitParams memory params
    ) external;

    function snapshotLimit(
        SnapshotLimitParams memory params
    ) external view returns(
        uint128,
        uint128
    );

    function fees(
        FeesParams memory params
    ) external returns (
        uint128 token0Fees,
        uint128 token1Fees
    );

    function immutables(
    ) external view returns(
        LimitImmutables memory
    );

    function priceBounds(
        int16 tickSpacing
    ) external pure returns (
        uint160 minPrice,
        uint160 maxPrice
    );

    function globalState() external view returns (
        RangePoolState memory pool,
        LimitPoolState memory pool0,
        LimitPoolState memory pool1,
        uint128 liquidityGlobal,
        uint32 positionIdNext,
        uint32 epoch,
        uint8 unlocked
    );
}
