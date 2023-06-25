// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;

import './modules/curves/ICurveMath.sol';
import './modules/sources/ITwapSource.sol';

interface ILimitPoolStructs {
    struct GlobalState {
        ProtocolFees protocolFees;
        uint128 liquidityGlobal;
        uint32  swapEpoch;
        uint8   unlocked;
    }

    struct PoolState {
        uint160 price; /// @dev Starting price current
        uint128 liquidity; /// @dev Liquidity currently active
        uint128 protocolFees; /// @dev Fees collected by the protocol
        int24 tickAtPrice;
        uint16 protocolFee;   /// @dev Fees applied to each swap
    }

    struct TickMap {
        uint256 blocks;                     /// @dev - sets of words
        mapping(uint256 => uint256) words;  /// @dev - sets to words
        mapping(uint256 => uint256) ticks;  /// @dev - words to ticks
        mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256))) epochs; /// @dev - ticks to epochs
    }

    struct Tick {
        int128 liquidityDelta;
        uint32 epochLast;
    }

    struct Position {
        uint160 claimPriceLast; // highest price claimed at
        uint128 liquidity; // expected amount to be used not actual
        uint128 amountIn; // token amount already claimed; balance
        uint128 amountOut; // necessary for non-custodial positions
        uint32  epochLast;  // last epoch this position was updated at
    }

    struct Immutables {
        ICurveMath.PriceBounds bounds;
        address token0;
        address token1;
        int16 tickSpacing;
    }

    struct ProtocolFees {
        uint128 token0;
        uint128 token1;
    }

    struct MintParams {
        address to;
        address refundTo;
        uint128 amount;
        int24 lower;
        int24 upper;
        bool zeroForOne;
    }

    struct BurnParams {
        address to;
        uint128 burnPercent;
        int24 lower;
        int24 claim;
        int24 upper;
        bool zeroForOne;
    }

    struct SwapParams {
        address to;
        address refundTo;
        uint160 priceLimit;
        uint128 amountIn;
        bool zeroForOne;
    }

    struct QuoteParams {
        uint160 priceLimit;
        uint128 amountIn;
        bool zeroForOne;
    }

    struct SnapshotParams {
        address owner;
        uint128 burnPercent;
        int24 lower;
        int24 upper;
        int24 claim;
        bool zeroForOne;
    }

    struct CollectParams {
        address to;
        int24 lower;
        int24 claim;
        int24 upper;
        bool zeroForOne;
    }

    struct SizeParams {
        uint256 priceLower;
        uint256 priceUpper;
        uint128 liquidityAmount;
        bool zeroForOne;
        int24 latestTick;
        uint24 auctionCount;
    }

    struct AddParams {
        address to;
        uint128 amount;
        uint128 amountIn;
        int24 lower;
        int24 upper;
        bool zeroForOne;
    }

    struct RemoveParams {
        address owner;
        address to;
        uint128 amount;
        int24 lower;
        int24 upper;
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

    struct MintCache {
        GlobalState state;
        Position position;
        Immutables constants;
        PoolState pool;
        uint256 liquidityMinted;
        int256 amountIn;
        uint256 amountOut;
    }

    struct BurnCache {
        GlobalState state;
        Position position;
        Immutables constants;
        PoolState pool;
    }

    struct SwapCache {
        GlobalState state;
        Immutables constants;
        PoolState pool;
        uint256 price;
        uint256 liquidity;
        uint256 amountIn;
        uint256 input;
        uint256 output;
        uint160 crossPrice;
        int24 crossTick;
        bool cross;
    }

    struct PositionCache {
        Position position;
        uint160 priceLower;
        uint160 priceUpper;
        uint256 liquidityMinted;
        int24 requiredStart;
    }

    struct UpdatePositionCache {
        PoolState pool;
        uint256 amountInFilledMax;    // considers the range covered by each update
        uint256 amountOutUnfilledMax; // considers the range covered by each update
        Tick claimTick;
        Tick finalTick;
        Position position;
        uint160 priceLower;
        uint160 priceClaim;
        uint160 priceUpper;
        uint160 priceSpread;
        bool earlyReturn;
        bool removeLower;
        bool removeUpper;
    }
}
