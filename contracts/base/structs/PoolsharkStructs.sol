// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

interface PoolsharkStructs {
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
        uint16 swapFee;
        int16 tickSpacing;
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
}