// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../interfaces/structs/LimitPoolStructs.sol';
import '../../libraries/math/ConstantProduct.sol';

library EchidnaAssertions {

    event LiquidityGlobalUnderflow(uint128 liquidityGlobal, uint128 amount, string location);
    event LiquidityUnderflow(uint128 liquidity, uint128 amount, string location);
    event LiquidityOverflow(uint128 liquidity, uint128 amount, string location);
    event LiquidityUnlock(int128 liquidity);
    event PoolBalanceExceeded(uint256 poolBalance, uint256 outputAmount);
    event PoolBalanceExceededRange(uint256 poolBalance, int256 outputAmount);
    event LiquidityDelta(int128 liquidityDelta);
    event TickAtPriceDivisibleByTickSpacing(int24 tick, uint160 priceAt, int16 tickSpacing);
    event FeeGrowthInsideUnderflow(uint256 rangeFeeGrowth, uint256 positionFeeGrowthInsideLast);
    event FeeGrowthOutsideUnderflow(uint256 feeGrowthGlobal, uint256 tickFeeGrowthOutside);
    event TickSecondsAccumWithinBounds(int56 tickSecondsAccum, int56 tickTickSecondsAccum);
    event SecondsPerLiquidityAccumUnderflow(uint160 secondsPerLiquidityAccum, uint160 tickSecondsPerLiquidityAccum, int24 tick);

    function assertLiquidityGlobalUnderflows(uint128 liquidityGlobal, uint128 amount, string memory location) internal {
        emit LiquidityGlobalUnderflow(liquidityGlobal, amount, location);
        assert(liquidityGlobal >= amount);
    }

    function assertLiquidityUnderflows(uint128 liquidity, uint128 amount, string memory location) internal {
        emit LiquidityUnderflow(liquidity, amount, location);
        assert(liquidity >= amount);
    }

    function assertFeeGrowthInsideUnderflows(uint256 rangeFeeGrowth, uint256 positionFeeGrowthInsideLast) internal {
        emit FeeGrowthInsideUnderflow(rangeFeeGrowth, positionFeeGrowthInsideLast);
        assert(rangeFeeGrowth >= positionFeeGrowthInsideLast);
    }

    function assertFeeGrowthOutsideUnderflows(uint256 feeGrowthGlobal, uint256 tickFeeGrowthOutside) internal {
        emit FeeGrowthOutsideUnderflow(feeGrowthGlobal, tickFeeGrowthOutside);
        assert(feeGrowthGlobal >= tickFeeGrowthOutside);
    }

    function assertTickSecondsAccumWithinBounds(int56 tickSecondsAccum, int56 tickTickSecondsAccum) internal {
        emit TickSecondsAccumWithinBounds(tickSecondsAccum, tickTickSecondsAccum);
        assert(int256(tickSecondsAccum) - int256(tickTickSecondsAccum) <= type(int56).max);
        assert(int256(tickSecondsAccum) - int256(tickTickSecondsAccum) >= type(int56).min);
    }

    function assertSecondsPerLiquidityAccumUnderflows(uint160 secondsPerLiquidityAccum, uint160 tickSecondsPerLiquidityAccum, int24 tick) internal {
        emit SecondsPerLiquidityAccumUnderflow(secondsPerLiquidityAccum, tickSecondsPerLiquidityAccum, tick);
        assert(secondsPerLiquidityAccum >= tickSecondsPerLiquidityAccum);
    }

    function assertLiquidityOverflows(uint128 liquidity, uint128 amount, string memory location) internal {
        emit LiquidityUnderflow(liquidity, amount, location);
        assert(uint256(liquidity) + uint256(amount) <= uint128(type(int128).max));
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

    function assertPoolBalanceExceededRange(uint256 poolBalance, int256 outputAmount) internal {
        emit PoolBalanceExceededRange(poolBalance, outputAmount);
        assert(outputAmount > 0);
        assert(int256(poolBalance) >= outputAmount);
    }

    function assertTickAtPriceDivisibleByTickSpacing(int24 tick, uint160 priceAt, int16 tickSpacing) internal {
        emit TickAtPriceDivisibleByTickSpacing(tick, priceAt, tickSpacing);
        if(tick % tickSpacing == 0) assert(priceAt == 0);
    }
}