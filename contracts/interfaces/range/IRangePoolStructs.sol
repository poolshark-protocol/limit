// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import "./IRangePoolERC1155.sol";
import '../../base/structs/PoolsharkStructs.sol';

interface IRangePoolStructs is PoolsharkStructs {

    struct Position {
        uint256 feeGrowthInside0Last;
        uint256 feeGrowthInside1Last;
        uint128 liquidity;
        uint128 amount0;
        uint128 amount1;
    }

    struct MintParams {
        address to;
        int24 lower;
        int24 upper;
        uint128 amount0;
        uint128 amount1;
    }

    struct BurnParams {
        address to;
        int24 lower;
        int24 upper;
        uint128 burnPercent;
    }

    struct SnapshotParams {
        address owner;
        int24 lower;
        int24 upper;
    }

    struct CompoundParams {
        int24 lower;
        int24 upper;
    }

    struct SampleParams {
        uint16 sampleIndex;
        uint16 sampleLength;
        uint32 time;
        uint32[] secondsAgo;
        int24 tick;
        uint128 liquidity;
        PoolsharkStructs.Immutables constants;
    }

    struct AddParams {
        GlobalState state;
        MintParams mint;
        uint128 amount;
        uint128 liquidity;
    }

    struct RemoveParams {
        uint128 amount0;
        uint128 amount1;
        uint128 tokenBurned;
        PoolsharkStructs.Immutables constants;
    }

    struct UpdateParams {
        int24 lower;
        int24 upper;
        uint128 burnPercent;
    }

    struct MintCache {
        GlobalState state;
        Position position;
        PoolsharkStructs.Immutables constants;
        uint256 liquidityMinted;
    }

    struct BurnCache {
        GlobalState state;
        Position position;
        PoolsharkStructs.Immutables constants;
        uint128 amount0;
        uint128 amount1;
        uint128 tokenBurned;
    }

    struct PositionCache {
        uint160 priceLower;
        uint160 priceUpper;
        uint256 liquidityOnPosition;
        uint256 liquidityAmount;
        uint256 totalSupply;
        uint256 tokenId;
    }

    struct UpdatePositionCache {
        uint256 totalSupply;
        uint256 tokenBurned;
        uint256 rangeFeeGrowth0;
        uint256 rangeFeeGrowth1;
        uint128 amountFees0;
        uint128 amountFees1;
        uint128 feesBurned0;
        uint128 feesBurned1;
    }

    struct SnapshotCache {
        int24   tick;
        uint160 price;
        uint32  blockTimestamp;
        uint32  secondsOutsideLower;
        uint32  secondsOutsideUpper;
        int56   tickSecondsAccum;
        int56   tickSecondsAccumLower;
        int56   tickSecondsAccumUpper;
        uint128 liquidity;
        uint160 secondsPerLiquidityAccum;
        uint160 secondsPerLiquidityAccumLower;
        uint160 secondsPerLiquidityAccumUpper;
        uint256 userBalance;
        uint256 totalSupply;
        Position position;
        SampleState samples;
        PoolsharkStructs.Immutables constants;
    }
}
