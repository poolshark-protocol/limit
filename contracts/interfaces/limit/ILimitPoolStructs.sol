// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../libraries/math/ConstantProduct.sol';

interface ILimitPoolStructs {
    struct GlobalState {
        uint8   unlocked;
    }

    struct PoolState {
        uint160 price; /// @dev Starting price current
        uint128 liquidity; /// @dev Liquidity currently active
        uint128 liquidityGlobal;
        uint128 protocolFees;
        uint32  swapEpoch;
        uint16 protocolFee;
        int24 tickAtPrice;
    }

    struct Tick {
        uint160 priceAt;
        int128 liquidityDelta;
        //liquidityDelta0
        //liquidityDelta1
    }

    struct Position {
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

    struct UpdateParams {
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
        Position position;
        PoolsharkStructs.Immutables constants;
        PoolState pool;
        PoolState swapPool;
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
        Position position;
        PoolsharkStructs.Immutables constants;
        PoolState pool;
    }

    struct SwapCache {
        GlobalState state;
        PoolsharkStructs.Immutables constants;
        PoolState pool;
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

    struct UpdateCache {
        PoolState pool;
        Tick claimTick;
        Position position;
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
