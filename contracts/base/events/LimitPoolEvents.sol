// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

abstract contract LimitPoolEvents {
    event Initialize(
        int24 minTick,
        int24 maxTick,
        uint160 startPrice,
        int24 startTick
    );

    event Swap(
        address indexed recipient,
        uint256 amountIn,
        uint256 amountOut,
        uint200 feeGrowthGlobal0,
        uint200 feeGrowthGlobal1,
        uint160 price,
        uint128 liquidity,
        uint128 feeAmount,
        int24 tickAtPrice,
        bool indexed zeroForOne,
        bool indexed exactIn
    );

    event SampleRecorded(
        int56 tickSecondsAccum,
        uint160 secondsPerLiquidityAccum
    );

    event SampleCountIncreased(
        uint16 newSampleCountMax
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

    event CollectRange0(
        uint128 amount0
    );

    event CollectRange1(
        uint128 amount1
    );

    event SyncRangeTick(
        uint200 feeGrowthOutside0,
        uint200 feeGrowthOutside1,
        int24 tick
    );

    event MintLimit(
        address indexed to,
        int24 lower,
        int24 upper,
        bool zeroForOne,
        uint32 positionId,
        uint32 epochLast,
        uint128 amountIn,
        uint128 liquidityMinted
    );

    event BurnLimit(
        address indexed to,
        uint32 positionId,
        int24 lower,
        int24 upper,
        int24 oldClaim,
        int24 newClaim,
        bool zeroForOne,
        uint128 liquidityBurned,
        uint128 tokenInClaimed,
        uint128 tokenOutBurned
    );

    event SyncLimitPool(
        uint160 price,
        uint128 liquidity,
        uint32 epoch,
        int24 tickAtPrice,
        bool isPool0
    );

    event SyncLimitLiquidity(
        uint128 liquidityAdded,
        int24 tick,
        bool zeroForOne
    );

    event SyncLimitTick(
        uint32 epoch,
        int24 tick,
        bool zeroForOne
    );
}
