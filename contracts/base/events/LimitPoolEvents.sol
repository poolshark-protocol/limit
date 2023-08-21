// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

abstract contract LimitPoolEvents {
    event Initialize(
        int24 minTick,
        int24 maxTick,
        uint160 startPrice,
        int24 startTick
    );

    event Sync(
        uint160 price,
        uint128 liquidity,
        int24 tickAtPrice,
        bool isPool0
    );

    event MintRange(
        address indexed recipient,
        int24 lower,
        int24 upper,
        uint32 indexed positionId,
        uint128 liquidityMinted,
        int128 amount0Delta,
        int128 amount1Delta
    );

    event BurnRange(
        address indexed recipient,
        uint256 indexed positionId,
        uint128 liquidityBurned,
        int128 amount0,
        int128 amount1
    );

    event CompoundRange(
        uint32 indexed positionId,
        uint128 liquidityCompounded
    );

    event CollectRange(
        uint128 amount0,
        uint128 amount1
    );

    event MintLimit(
        address indexed to,
        int24 lower,
        int24 upper,
        bool zeroForOne,
        uint32 epochLast,
        uint128 amountIn,
        uint128 amountFilled,
        uint128 liquidityMinted
    );

    event BurnLimit(
        address indexed to,
        int24 lower,
        int24 upper,
        int24 claim,
        bool zeroForOne,
        uint128 liquidityBurned,
        uint128 tokenInClaimed,
        uint128 tokenOutBurned
    );

    event Swap(
        address indexed recipient,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut,
        uint160 price,
        uint128 liquidity,
        uint128 feeAmount,
        int24 tickAtPrice
    );

    event SampleRecorded(
        int56 tickSecondsAccum,
        uint160 secondsPerLiquidityAccum
    );

    event SampleLengthIncreased(
        uint16 sampleLengthNext
    );
}
