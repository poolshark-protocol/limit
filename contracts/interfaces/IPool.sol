// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

import '../base/structs/PoolsharkStructs.sol';

interface IPool is PoolsharkStructs {
    function immutables() external view returns (Immutables memory);
    
    function swap(
        SwapParams memory params
    ) external returns (
        int256 amount0,
        int256 amount1
    );

    function quote(
        QuoteParams memory params
    ) external view returns (
        uint256 inAmount,
        uint256 outAmount,
        uint160 priceAfter
    );

    function fees(
        uint16 protocolSwapFee0,
        uint16 protocolSwapFee1,
        uint16 protocolFillFee0,
        uint16 protocolFillFee1,
        uint8 setFeesFlag
    ) external returns (
        uint128 token0Fees,
        uint128 token1Fees
    );

    function globalState() external view returns (
        RangePoolState memory pool,
        LimitPoolState memory pool0,
        LimitPoolState memory pool1,
        uint128 liquidityGlobal,
        uint32 epoch,
        uint8 unlocked
    );

    function samples(uint256) external view returns (
        uint32,
        int56,
        uint160
    );

    function ticks(int24) external view returns (
        RangeTick memory,
        LimitTick memory
    );

    function positions(uint32) external view returns (
        uint256 feeGrowthInside0Last,
        uint256 feeGrowthInside1Last,
        uint128 amount0,
        uint128 amount1,
        uint128 liquidity,
        int24 lower,
        int24 upper
    );
}
