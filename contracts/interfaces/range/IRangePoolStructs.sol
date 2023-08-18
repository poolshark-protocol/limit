// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import "./IRangePoolERC1155.sol";
import '../../base/structs/PoolsharkStructs.sol';

interface IRangePoolStructs is PoolsharkStructs {

    struct RangePosition {
        uint256 feeGrowthInside0Last;
        uint256 feeGrowthInside1Last;
        uint128 amount0;
        uint128 amount1;
        uint128 liquidity;
        int24 lower;
        int24 upper;
    }

    struct MintParams {
        address to;
        int24 lower;
        int24 upper;
        uint32 positionId;
        uint128 amount0;
        uint128 amount1;
    }

    struct BurnParams {
        address to;
        uint32 positionId;
        uint128 burnPercent;
    }

    struct SnapshotParams {
        address owner;
        int24 lower;
        int24 upper;
    }

    struct CompoundParams {
        uint160 priceLower;
        uint160 priceUpper;
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
        uint128 tokenBurned;
        PoolsharkStructs.Immutables constants;
    }

    struct UpdateParams {
        int24 lower;
        int24 upper;
        uint32 positionId;
        uint128 burnPercent;
    }

    struct MintCache {
        GlobalState state;
        RangePosition position;
        PoolsharkStructs.Immutables constants;
        uint256 liquidityMinted;
        uint160 priceLower;
        uint160 priceUpper;
    }

    struct BurnCache {
        GlobalState state;
        RangePosition position;
        PoolsharkStructs.Immutables constants;
        uint256 liquidityBurned;
        uint160 priceLower;
        uint160 priceUpper;
    }

    struct PositionCache {
        uint256 liquidityAmount;
        uint160 priceLower;
        uint160 priceUpper;
        uint128 amount0;
        uint128 amount1;
    }

    struct UpdatePositionCache {
        uint256 liquidityAmount;
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
        RangePosition position;
        SampleState samples;
        PoolsharkStructs.Immutables constants;
    }
}
