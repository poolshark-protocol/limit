// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

library EchidnaAssertions {

    event LiquidityGlobalUnderflow(uint128 liquidityGlobal, uint128 amount, string location);
    event LiquidityUnderflow(uint128 liquidity, uint128 amount, string location);
    event LiquidityUnlock(int128 liquidity);
    event PoolBalanceExceeded(uint256 poolBalance, uint256 outputAmount);

    function assertLiquidityGlobalUnderflows(uint128 liquidityGlobal, uint128 amount, string memory location) internal {
        emit LiquidityGlobalUnderflow(liquidityGlobal, amount, location);
        assert(liquidityGlobal >= amount);
    }

    function assertLiquidityUnderflows(uint128 liquidity, uint128 amount, string memory location) internal {
        emit LiquidityUnderflow(liquidity, amount, location);
        assert(liquidity >= amount);
    }

    function assertPositiveLiquidityOnUnlock(int128 liquidity) internal {
        emit LiquidityUnlock(liquidity);
        assert(liquidity >= 0);
    }

    function assertPoolBalanceExceeded(uint256 poolBalance, uint256 outputAmount) internal {
        emit PoolBalanceExceeded(poolBalance, outputAmount);
        assert(poolBalance >= outputAmount);
    }

}