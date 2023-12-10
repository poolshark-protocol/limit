// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

import '../structs/RangePoolStructs.sol';
import './IRangePoolManager.sol';

interface IRangePool is RangePoolStructs {
    function mintRange(
        MintRangeParams memory mintParams
    ) external returns (
        int256,
        int256
    );

    function burnRange(
        BurnRangeParams memory burnParams
    ) external returns (
        int256,
        int256
    );

    function swap(
        SwapParams memory params
    ) external returns (
        int256 amount0,
        int256 amount1
    );

    function quote(
        QuoteParams memory params
    ) external view returns (
        uint256 inAmount,
        uint256 outAmount,
        uint160 priceAfter
    );

    function snapshotRange(
        uint32 positionId
    ) external view returns(
        int56   tickSecondsAccum,
        uint160 secondsPerLiquidityAccum,
        uint128 feesOwed0,
        uint128 feesOwed1
    );

    function sample(
        uint32[] memory secondsAgo
    ) external view returns(
        int56[]   memory tickSecondsAccum,
        uint160[] memory secondsPerLiquidityAccum,
        uint160 averagePrice,
        uint128 averageLiquidity,
        int24 averageTick
    );

    function positions(uint256 positionId) external view returns (
        uint256 feeGrowthInside0Last,
        uint256 feeGrowthInside1Last,
        uint128 liquidity,
        int24 lower,
        int24 upper
    );

    function increaseSampleCount(
        uint16 newSampleCountMax
    ) external;

    function ticks(int24) external view returns (
        RangeTick memory,
        LimitTick memory
    );

    function samples(uint256) external view returns (
        uint32,
        int56,
        uint160
    );
}
