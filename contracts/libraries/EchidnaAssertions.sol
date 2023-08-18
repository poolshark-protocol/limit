// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../interfaces/limit/ILimitPoolStructs.sol';
import './math/ConstantProduct.sol';

library EchidnaAssertions {

    event LiquidityGlobalUnderflow(uint128 liquidityGlobal, uint128 amount, string location);
    event LiquidityUnderflow(uint128 liquidity, uint128 amount, string location);
    event LiquidityOverflow(uint128 liquidity, uint128 amount, string location);
    event LiquidityUnlock(int128 liquidity);
    event PoolBalanceExceeded(uint256 poolBalance, uint256 outputAmount);
    event LiquidityDelta(int128 liquidityDelta);
    event TickAtPriceDivisibleByTickSpacing(int24 tick, uint160 priceAt, int16 tickSpacing);

    function assertLiquidityGlobalUnderflows(uint128 liquidityGlobal, uint128 amount, string memory location) internal {
        emit LiquidityGlobalUnderflow(liquidityGlobal, amount, location);
        assert(liquidityGlobal >= amount);
    }

    function assertLiquidityUnderflows(uint128 liquidity, uint128 amount, string memory location) internal {
        emit LiquidityUnderflow(liquidity, amount, location);
        assert(liquidity >= amount);
    }

    function assertLiquidityOverflows(uint128 liquidity, uint128 amount, string memory location) internal {
        emit LiquidityUnderflow(liquidity, amount, location);
        assert(uint256(liquidity) + uint256(amount) <= type(uint128).max);
    }

    function assertLiquidityAbsoluteUnderflows(uint128 liquidityAbs, uint128 amount, string memory location) internal {
        emit LiquidityUnderflow(liquidityAbs, amount, location);
        assert(liquidityAbs >= amount);
    }

    function assertPositiveLiquidityOnUnlock(int128 liquidity) internal {
        emit LiquidityUnlock(liquidity);
        assert(liquidity >= 0);
    }

    function assertPoolBalanceExceeded(uint256 poolBalance, uint256 outputAmount) internal {
        emit PoolBalanceExceeded(poolBalance, outputAmount);
        assert(poolBalance >= outputAmount);
    }

    function assertTickAtPriceDivisibleByTickSpacing(int24 tick, uint160 priceAt, int16 tickSpacing) internal {
        emit TickAtPriceDivisibleByTickSpacing(tick, priceAt, tickSpacing);
        if(tick % tickSpacing == 0) assert(priceAt == 0);
    }
}