// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

abstract contract LimitPoolFactoryStructs {
    struct LimitPoolParams {
        address owner;
        address token0;
        address token1;
        uint160 startPrice;
        int16   tickSpacing;
    }
}




