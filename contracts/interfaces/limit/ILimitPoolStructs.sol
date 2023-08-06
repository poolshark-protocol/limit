// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../base/structs/PoolsharkStructs.sol';

interface ILimitPoolStructs is PoolsharkStructs {

    struct PositionLimit {
        uint128 amountIn; // token amount already claimed; balance
        uint128 amountOut; // necessary for non-custodial positions
        uint128 liquidity; // expected amount to be used not actual
        uint32 epochLast;  // epoch when this position was created at
        bool crossedInto; // whether the position was crossed into already
    }

    struct MintLimitParams {
        address to;
        uint128 amount;
        uint96 mintPercent;
        int24 lower;
        int24 upper;
        bool zeroForOne;
    }

    struct BurnLimitParams {
        address to;
        uint128 burnPercent;
        int24 lower;
        int24 claim;
        int24 upper;
        bool zeroForOne;
    }

    struct SnapshotLimitParams {
        address owner;
        uint128 burnPercent;
        int24 lower;
        int24 upper;
        int24 claim;
        bool zeroForOne;
    }

    struct UpdateLimitParams {
        address owner;
        address to;
        uint128 amount;
        int24 lower;
        int24 upper;
        int24 claim;
        bool zeroForOne;
    }

    struct MintLimitCache {
        GlobalState state;
        PositionLimit position;
        Immutables constants;
        LimitPoolState pool;
        LimitPoolState swapPool;
        SwapCache swapCache;
        uint256 liquidityMinted;
        uint256 mintSize;
        uint256 priceLimit;
        int256 amountIn;
        uint256 amountOut;
        uint256 priceLower;
        uint256 priceUpper;
        int24 tickLimit;
    }

    struct BurnLimitCache {
        GlobalState state;
        PositionLimit position;
        PoolsharkStructs.Immutables constants;
        LimitPoolState pool;
    }

    struct SwapCache {
        GlobalState state;
        PoolsharkStructs.Immutables constants;
        LimitPoolState pool;
        uint256 price;
        uint256 liquidity;
        uint256 amountLeft;
        uint256 input;
        uint256 output;
        uint160 crossPrice;
        int24 crossTick;
        bool exactIn;
        bool cross;
    }

    struct UpdateLimitCache {
        GlobalState state;
        LimitPoolState pool;
        Tick claimTick;
        PositionLimit position;
        uint160 priceLower;
        uint160 priceClaim;
        uint160 priceUpper;
        bool earlyReturn;
        bool removeLower;
        bool removeUpper;
    }

    struct InsertSingleLocals {
        int24 previousFullTick;
        int24 nextFullTick;
        uint256 priceNext;
        uint256 pricePrevious;
        uint256 amountInExact;
        uint256 amountOutExact;
        uint256 amountToCross;
    }

    struct GetDeltasLocals {
        int24 previousFullTick;
        uint256 pricePrevious;
        uint256 priceNext;
    }
}
