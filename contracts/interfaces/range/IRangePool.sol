// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

import '../structs/RangePoolStructs.sol';
import './IRangePoolManager.sol';

interface IRangePool is RangePoolStructs {
    function mintRange(
        MintRangeParams memory mintParams
    ) external;

    function burnRange(
        BurnRangeParams memory burnParams
    ) external;

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

    function increaseSampleLength(
        uint16 sampleLengthNext
    ) external;
}
