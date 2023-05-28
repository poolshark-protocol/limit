// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;

import './modules/curves/ICurveMath.sol';
import './modules/sources/ITwapSource.sol';

interface ILimitPoolStructs {
    struct GlobalState {
        ProtocolFees protocolFees;
        uint160  latestPrice;      /// @dev price of latestTick
        uint128  liquidityGlobal;
        //uint32   genesisTime;      /// @dev reference time for which auctionStart is an offset of
        uint32   lastTime;         /// @dev last block checked
        uint32   auctionStart;     /// @dev last block price reference was updated
        uint32   swapEpoch;       /// @dev number of times this pool has been synced
        int24    latestTick;       /// @dev latest updated inputPool price tick
        uint16   syncFee;
        uint16   fillFee;
        //int16    tickSpread;       /// @dev this is a integer multiple of the inputPool tickSpacing
        //uint16   twapLength;       /// @dev number of blocks used for TWAP sampling
        //uint16   auctionLength;    /// @dev number of seconds to improve price by tickSpread
        uint8    unlocked;
    }

    struct PoolState {
        uint160 price; /// @dev Starting price current
        uint128 liquidity; /// @dev Liquidity currently active
        uint128 amountInDelta; /// @dev Delta for the current tick auction
        uint128 amountInDeltaMaxClaimed;  /// @dev - needed when users claim and don't burn; should be cleared when users burn liquidity
        uint128 amountOutDeltaMaxClaimed; /// @dev - needed when users claim and don't burn; should be cleared when users burn liquidity
    }

    struct TickMap {
        uint256 blocks;                     /// @dev - sets of words
        mapping(uint256 => uint256) words;  /// @dev - sets to words
        mapping(uint256 => uint256) ticks;  /// @dev - words to ticks
        mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256))) epochs; /// @dev - ticks to epochs
    }

    struct Tick {
        Deltas deltas;
        int128  liquidityDelta;
        uint128 amountInDeltaMaxMinus;
        uint128 amountOutDeltaMaxMinus;
        uint128 amountInDeltaMaxStashed;
        uint128 amountOutDeltaMaxStashed;
    }

    struct Deltas {
        uint128 amountInDelta;     // amt unfilled
        uint128 amountOutDelta;    // amt unfilled
        uint128 amountInDeltaMax;  // max unfilled 
        uint128 amountOutDeltaMax; // max unfilled
    }

    struct Position {
        uint160 claimPriceLast; // highest price claimed at
        uint128 liquidity; // expected amount to be used not actual
        uint128 amountIn; // token amount already claimed; balance
        uint128 amountOut; // necessary for non-custodial positions
        uint32  swapEpochLast;  // last epoch this position was updated at
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
        PoolState pool0;
        PoolState pool1;
        uint256 liquidityMinted;
    }

    struct BurnCache {
        GlobalState state;
        Position position;
        Immutables constants;
        PoolState pool0;
        PoolState pool1;
    }

    struct SwapCache {
        GlobalState state;
        Immutables constants;
        PoolState pool0;
        PoolState pool1;
        uint256 price;
        uint256 liquidity;
        uint256 amountIn;
        uint256 input;
        uint256 output;
    }

    struct PositionCache {
        Position position;
        uint160 priceLower;
        uint160 priceUpper;
        uint256 liquidityMinted;
    }

    struct UpdatePositionCache {
        Deltas deltas;
        Deltas finalDeltas;
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

    struct AccumulateCache {
        Deltas deltas0;
        Deltas deltas1;
        int24 newLatestTick;
        int24 nextTickToCross0;
        int24 nextTickToCross1;
        int24 nextTickToAccum0;
        int24 nextTickToAccum1;
        int24 stopTick0;
        int24 stopTick1;
    }

    struct AccumulateParams {
        Deltas deltas;
        Tick crossTick;
        Tick accumTick;
        bool updateAccumDeltas;
        bool isPool0;
    }
}
