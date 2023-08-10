// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

interface PoolsharkStructs {

    struct GlobalState {
        RangePoolState pool;
        LimitPoolState pool0;
        LimitPoolState pool1;
        uint128 liquidityGlobal;
        uint32 epoch;
        uint8 unlocked;
    }

    struct LimitPoolState {
        uint160 price; /// @dev Starting price current
        uint128 liquidity; /// @dev Liquidity currently active
        uint128 protocolFees;
        uint16 protocolFee;
        int24 tickAtPrice;
    }

    struct RangePoolState {
        SampleState  samples;
        uint200 feeGrowthGlobal0;
        uint200 feeGrowthGlobal1;
        uint160 secondsPerLiquidityAccum;
        uint160 price;               /// @dev Starting price current
        uint128 liquidity;           /// @dev Liquidity currently active
        int56   tickSecondsAccum;
        int24   tickAtPrice;
    }

    struct Tick {
        RangeTick range;
        LimitTick limit;
    }

    struct LimitTick {
        uint160 priceAt;                             // LimitPool
        int128 liquidityDelta;                       // LimitPool
        //add liquidityAbsolute
    }

    struct RangeTick {
        uint200 feeGrowthOutside0;                   // RangePool
        uint200 feeGrowthOutside1;                   // RangePool
        uint160 secondsPerLiquidityAccumOutside;     // RangePool
        int128 liquidityDelta;                       // RangePool
        // add liquidityAbsolute
        int56 tickSecondsAccumOutside;               // RangePool
    }

    struct Sample {
        uint32  blockTimestamp;
        int56   tickSecondsAccum;
        uint160 secondsPerLiquidityAccum;
    }

    struct SampleState {
        uint16  index;
        uint16  length;
        uint16  lengthNext;
    }

    struct SwapParams {
        address to;
        uint160 priceLimit;
        uint128  amount;
        bool exactIn;
        bool zeroForOne;
        bytes callbackData;
    }

    struct QuoteParams {
        uint160 priceLimit;
        uint128 amount;
        bool exactIn;
        bool zeroForOne;
    }
    
    struct Immutables {
        address owner;
        address factory;
        PriceBounds bounds;
        address token0;
        address token1;
        address poolToken;
        int16 tickSpacing;
        uint16 swapFee;
    }

    struct PriceBounds {
        uint160 min;
        uint160 max;
    }

    struct TickMap {
        uint256 blocks;                     /// @dev - sets of words
        mapping(uint256 => uint256) words;  /// @dev - sets to words
        mapping(uint256 => uint256) ticks;  /// @dev - words to ticks
        mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256))) epochs; /// @dev - ticks to epochs
    }

    struct SwapCache {
        GlobalState state;
        PoolsharkStructs.Immutables constants;
        uint256 price;
        uint256 liquidity;
        uint256 amountLeft;
        uint256 input;
        uint256 output;
        uint160 crossPrice;
        uint160 secondsPerLiquidityAccum;
        int56   tickSecondsAccum;
        int24   crossTick;
        uint8   crossStatus;
        bool    limitActive;
        bool    exactIn;
        bool    cross;
    }

    // struct CrossState {
    //     int24   tickAhead;
    //     bool    limitPoolAhead;
    //     bool    active;
    // }    

    enum CrossStatus {
        RANGE,
        LIMIT,
        BOTH
    }
}