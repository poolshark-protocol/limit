// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

abstract contract LimitPoolEvents {
    event Mint(
        address indexed to,
        int24 lower,
        int24 upper,
        bool zeroForOne,
        uint32 epochLast,
        uint128 amountIn,
        uint128 liquidityMinted,
        uint128 amountInDeltaMaxMinted,
        uint128 amountOutDeltaMaxMinted
    );

    event Burn(
        address indexed to,
        int24 lower,
        int24 upper,
        int24 claim,
        bool zeroForOne,
        uint128 liquidityBurned,
        uint128 tokenInClaimed,
        uint128 tokenOutClaimed,
        uint128 tokenOutBurned,
        uint128 amountInDeltaMaxStashedBurned,
        uint128 amountOutDeltaMaxStashedBurned,
        uint128 amountInDeltaMaxBurned,
        uint128 amountOutDeltaMaxBurned,
        uint160 claimPriceLast
    );

    event Swap(
        address indexed recipient,
        uint128 amountIn,
        uint128 amountOut,
        uint160 priceLimit,
        uint160 newPrice,
        bool zeroForOne
    );

    event Initialize(
        int24 minTick,
        int24 maxTick,
        int24 latestTick,
        uint32 genesisTime,
        uint32 auctionStart,
        uint160 pool0Price,
        uint160 pool1Price
    );

    event Sync(
        uint160 pool0Price,
        uint160 pool1Price,
        uint128 pool0Liquidity,
        uint128 pool1Liquidity,
        uint32 auctionStart,
        uint32 swapEpoch,
        int24 oldLatestTick,
        int24 newLatestTick
    );

    event FinalDeltasAccumulated(
        uint128 amountInDelta,
        uint128 amountOutDelta,
        uint32 swapEpoch,
        int24 accumTick,
        bool isPool0
    );

    event StashDeltasCleared(
        int24 stashTick,
        bool isPool0
    );

    event StashDeltasAccumulated(
        uint128 amountInDelta,
        uint128 amountOutDelta,
        uint128 amountInDeltaMaxStashed,
        uint128 amountOutDeltaMaxStashed,
        uint32 swapEpoch,
        int24 stashTick,
        bool isPool0
    );

    event SyncFeesCollected(
        address indexed collector,
        uint128 token0Amount,
        uint128 token1Amount
    );
}
