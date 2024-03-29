// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../../interfaces/structs/PoolsharkStructs.sol';
import '../../interfaces/structs/RangePoolStructs.sol';
import '../../interfaces/range/IRangePoolFactory.sol';
import '../../interfaces/range/IRangePool.sol';
import './math/FeeMath.sol';
import './RangePositions.sol';
import '../math/OverflowMath.sol';
import '../math/ConstantProduct.sol';
import '../TickMap.sol';
import '../Samples.sol';

/// @notice Tick management library for range pools
library RangeTicks {

    event SyncRangeTick(
        uint200 feeGrowthOutside0,
        uint200 feeGrowthOutside1,
        int24 tick
    );

    uint256 internal constant Q96 = 0x1000000000000000000000000;
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    function validate(
        int24 lower,
        int24 upper,
        int16 tickSpacing
    ) internal pure {
        if (lower % tickSpacing != 0) require(false, 'InvalidLowerTick()');
        if (lower < ConstantProduct.minTick(tickSpacing)) require(false, 'InvalidLowerTick()');
        if (upper % tickSpacing != 0) require(false, 'InvalidUpperTick()');
        if (upper > ConstantProduct.maxTick(tickSpacing)) require(false, 'InvalidUpperTick()');
        if (lower >= upper) require(false, 'InvalidPositionBounds()');
    }

    function insert(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.LimitImmutables memory constants,
        int24 lower,
        int24 upper,
        uint128 amount
    ) internal returns (PoolsharkStructs.GlobalState memory) {

        // get tick at price
        int24 tickAtPrice = state.pool.tickAtPrice;

        if(TickMap.set(tickMap, lower, constants.tickSpacing)) {
            ticks[lower].range.liquidityDelta += int128(amount);
            ticks[lower].range.liquidityAbsolute += amount;
        } else {
            if (lower <= tickAtPrice) {
                (
                    int56 tickSecondsAccum,
                    uint160 secondsPerLiquidityAccum
                ) = Samples.getSingle(
                        IRangePool(address(this)), 
                        RangePoolStructs.SampleParams(
                            state.pool.samples.index,
                            state.pool.samples.count,
                            uint32(block.timestamp),
                            new uint32[](2),
                            state.pool.tickAtPrice,
                            state.pool.liquidity,
                            constants
                        ),
                        0
                );
                ticks[lower].range = PoolsharkStructs.RangeTick(
                    state.pool.feeGrowthGlobal0,
                    state.pool.feeGrowthGlobal1,
                    secondsPerLiquidityAccum,
                    tickSecondsAccum,
                    int128(amount),             // liquidityDelta
                    amount                      // liquidityAbsolute
                );
                emit SyncRangeTick(
                    state.pool.feeGrowthGlobal0,
                    state.pool.feeGrowthGlobal1,
                    lower
                );
            } else {
                ticks[lower].range.liquidityDelta = int128(amount);
                ticks[lower].range.liquidityAbsolute += amount;
            }
        }
        if(TickMap.set(tickMap, upper, constants.tickSpacing)) {
            ticks[upper].range.liquidityDelta -= int128(amount);
            ticks[upper].range.liquidityAbsolute += amount;
        } else {
            if (upper <= tickAtPrice) {

                (
                    int56 tickSecondsAccum,
                    uint160 secondsPerLiquidityAccum
                ) = Samples.getSingle(
                        IRangePool(address(this)), 
                        RangePoolStructs.SampleParams(
                            state.pool.samples.index,
                            state.pool.samples.count,
                            uint32(block.timestamp),
                            new uint32[](2),
                            state.pool.tickAtPrice,
                            state.pool.liquidity,
                            constants
                        ),
                        0
                );
                ticks[upper].range = PoolsharkStructs.RangeTick(
                    state.pool.feeGrowthGlobal0,
                    state.pool.feeGrowthGlobal1,
                    secondsPerLiquidityAccum,
                    tickSecondsAccum,
                    -int128(amount),
                    amount
                );
                emit SyncRangeTick(
                    state.pool.feeGrowthGlobal0,
                    state.pool.feeGrowthGlobal1,
                    upper
                );
            } else {
                ticks[upper].range.liquidityDelta = -int128(amount);
                ticks[upper].range.liquidityAbsolute = amount;
            }
        }
        if (tickAtPrice >= lower && tickAtPrice < upper) {
            // write an oracle entry
            (state.pool.samples.index, state.pool.samples.count) = Samples.save(
                samples,
                state.pool.samples,
                state.pool.liquidity,
                state.pool.tickAtPrice
            );
            // update pool liquidity
            state.pool.liquidity += amount;
        }
        // update global liquidity
        state.liquidityGlobal += amount;

        return state;
    }

    function remove(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.LimitImmutables memory constants, 
        int24 lower,
        int24 upper,
        uint128 amount
    ) internal returns (PoolsharkStructs.GlobalState memory) {
        validate(lower, upper, constants.tickSpacing);
        //check for amount to overflow liquidity delta & global
        if (amount == 0) return state;
        if (amount > uint128(type(int128).max)) require(false, 'LiquidityUnderflow()');
        if (amount > state.liquidityGlobal) require(false, 'LiquidityUnderflow()');

        // get pool tick at price
        int24 tickAtPrice = state.pool.tickAtPrice;

        // update lower liquidity values
        PoolsharkStructs.RangeTick memory tickLower = ticks[lower].range;
        unchecked {
            tickLower.liquidityDelta -= int128(amount);
            tickLower.liquidityAbsolute -= amount;
        }
        ticks[lower].range = tickLower;
        // try to clear tick if possible
        clear(ticks, constants, tickMap, lower);

        // update upper liquidity values
        PoolsharkStructs.RangeTick memory tickUpper = ticks[upper].range;
        unchecked {
            tickUpper.liquidityDelta += int128(amount);
            tickUpper.liquidityAbsolute -= amount;
        }
        ticks[upper].range = tickUpper;
        // try to clear tick if possible
        clear(ticks, constants, tickMap, upper);

        if (tickAtPrice >= lower && tickAtPrice < upper) {
            // write an oracle entry
            (state.pool.samples.index, state.pool.samples.count) = Samples.save(
                samples,
                state.pool.samples,
                state.pool.liquidity,
                tickAtPrice
            );
            state.pool.liquidity -= amount;  
        }
        state.liquidityGlobal -= amount;

        return state;
    }

    function clear(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.LimitImmutables memory constants,
        PoolsharkStructs.TickMap storage tickMap,
        int24 tickToClear
    ) internal {
        if (_empty(ticks[tickToClear])) {
            if (tickToClear != ConstantProduct.maxTick(constants.tickSpacing) &&
                    tickToClear != ConstantProduct.minTick(constants.tickSpacing)) {
                ticks[tickToClear].range = PoolsharkStructs.RangeTick(0,0,0,0,0,0);
                TickMap.unset(tickMap, tickToClear, constants.tickSpacing);
            }
        }
    }

    function _empty(
        LimitPoolStructs.Tick memory tick
    ) internal pure returns (
        bool
    ) {
        return tick.range.liquidityAbsolute == 0;
    }
}
