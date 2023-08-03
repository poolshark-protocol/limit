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
    
    struct Immutables {
        address owner;
        address factory;
        PriceBounds bounds;
        address token0;
        address token1;
        int16 tickSpacing;
    }

    struct PriceBounds {
        uint160 min;
        uint160 max;
    }
}