// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;

import './LimitPoolManagerStructs.sol';

abstract contract LimitPoolFactoryStructs is LimitPoolManagerStructs {
    struct LimitPoolParams {
        address owner;
        address token0;
        address token1;
        int16   tickSpacing;
    }
}




