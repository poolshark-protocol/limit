// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../../interfaces/IPool.sol';
import '../../interfaces/IPositionERC1155.sol';
import '../../interfaces/structs/RangePoolStructs.sol';
import '../math/ConstantProduct.sol';
import './math/FeeMath.sol';
import '../math/OverflowMath.sol';
import '../utils/SafeCast.sol';
import './RangeTicks.sol';
import '../Samples.sol';

/// @notice Position management library for ranged liquidity.
library RangePositions {
    using SafeCast for uint256;
    using SafeCast for uint128;
    using SafeCast for int256;
    using SafeCast for int128;

    error NotEnoughPositionLiquidity();
    error InvalidClaimTick();
    error LiquidityOverflow();
    error WrongTickClaimedAt();
    error NoLiquidityBeingAdded();
    error PositionNotUpdated();
    error InvalidLowerTick();
    error InvalidUpperTick();
    error InvalidPositionAmount();
    error InvalidPositionBoundsOrder();
    error NotImplementedYet();

    uint256 internal constant Q96 = 0x1000000000000000000000000;
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    event BurnRange(
        address indexed recipient,
        uint256 indexed positionId,
        uint128 liquidityBurned,
        int128 amount0,
        int128 amount1
    );

    event CompoundRange(
        uint32 indexed positionId,
        uint128 liquidityCompounded
    );

    function validate(
        RangePoolStructs.MintRangeParams memory params,
        RangePoolStructs.MintRangeCache memory cache
    ) internal pure returns (
        RangePoolStructs.MintRangeParams memory,
        RangePoolStructs.MintRangeCache memory
    ) {
        RangeTicks.validate(cache.position.lower, cache.position.upper, cache.constants.tickSpacing);

        cache.liquidityMinted = ConstantProduct.getLiquidityForAmounts(
            cache.priceLower,
            cache.priceUpper,
            cache.state.pool.price,
            params.amount1,
            params.amount0
        );
        if (cache.liquidityMinted == 0) require(false, 'NoLiquidityBeingAdded()');
        (params.amount0, params.amount1) = ConstantProduct.getAmountsForLiquidity(
            cache.priceLower,
            cache.priceUpper,
            cache.state.pool.price,
            cache.liquidityMinted,
            true
        );
        if (cache.liquidityMinted > uint128(type(int128).max)) require(false, 'LiquidityOverflow()');

        return (params, cache);
    }

    function add(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage tickMap,
        RangePoolStructs.MintRangeCache memory cache,
        RangePoolStructs.MintRangeParams memory params
    ) internal returns (
        RangePoolStructs.MintRangeCache memory
    ) {
        if (params.amount0 == 0 && params.amount1 == 0) return cache;

        cache.state = RangeTicks.insert(
            ticks,
            samples,
            tickMap,
            cache.state,
            cache.constants,
            cache.position.lower,
            cache.position.upper,
            cache.liquidityMinted.toUint128()
        );
        (
            cache.position.feeGrowthInside0Last,
            cache.position.feeGrowthInside1Last
        ) = rangeFeeGrowth(
            ticks[cache.position.lower].range,
            ticks[cache.position.upper].range,
            cache.state,
            cache.position.lower,
            cache.position.upper
        );
        if (cache.position.liquidity == 0) {
            IPositionERC1155(cache.constants.poolToken).mint(
                params.to,
                params.positionId,
                1,
                cache.constants
            );
        }
        cache.position.liquidity += uint128(cache.liquidityMinted);
        return cache;
    }

    function remove(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage tickMap,
        RangePoolStructs.BurnRangeParams memory params,
        RangePoolStructs.BurnRangeCache memory cache
    ) internal returns (
        RangePoolStructs.BurnRangeCache memory
    ) {
        cache.priceLower = ConstantProduct.getPriceAtTick(cache.position.lower, cache.constants);
        cache.priceUpper = ConstantProduct.getPriceAtTick(cache.position.upper, cache.constants);
        cache.liquidityBurned = _convert(cache.position.liquidity, params.burnPercent);
        if (cache.liquidityBurned  == 0) {
            return cache;
        }
        if (cache.liquidityBurned > cache.position.liquidity) require(false, 'NotEnoughPositionLiquidity()');
        {
            uint128 amount0Removed; uint128 amount1Removed;
            (amount0Removed, amount1Removed) = ConstantProduct.getAmountsForLiquidity(
                cache.priceLower,
                cache.priceUpper,
                cache.state.pool.price,
                cache.liquidityBurned ,
                false
            );
            cache.amount0 += amount0Removed.toInt128();
            cache.amount1 += amount1Removed.toInt128();
            cache.position.liquidity -= cache.liquidityBurned.toUint128();
        }
        cache.state = RangeTicks.remove(
            ticks,
            samples,
            tickMap,
            cache.state,
            cache.constants,
            cache.position.lower,
            cache.position.upper,
            uint128(cache.liquidityBurned)
        );
        emit BurnRange(
            params.to,
            params.positionId,
            uint128(cache.liquidityBurned),
            cache.amount0,
            cache.amount1
        );
        if (cache.position.liquidity == 0) {
            cache.position.lower = 0;
            cache.position.upper = 0;
        }
        return cache;
    }

    function compound(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.LimitImmutables memory constants,
        RangePoolStructs.RangePosition memory position,
        RangePoolStructs.CompoundRangeParams memory params
    ) internal returns (
        RangePoolStructs.RangePosition memory,
        PoolsharkStructs.GlobalState memory,
        int128,
        int128
    ) {
        // price tells you the ratio so you need to swap into the correct ratio and add liquidity
        uint256 liquidityAmount = ConstantProduct.getLiquidityForAmounts(
            params.priceLower,
            params.priceUpper,
            state.pool.price,
            params.amount1,
            params.amount0
        );
        if (liquidityAmount > 0) {
            state = RangeTicks.insert(
                ticks,
                samples,
                tickMap,
                state,
                constants,
                position.lower,
                position.upper,
                uint128(liquidityAmount)
            );
            uint256 amount0; uint256 amount1;
            (amount0, amount1) = ConstantProduct.getAmountsForLiquidity(
                params.priceLower,
                params.priceUpper,
                state.pool.price,
                liquidityAmount,
                true
            );
            params.amount0 -= (amount0 <= params.amount0) ? uint128(amount0) : params.amount0;
            params.amount1 -= (amount1 <= params.amount1) ? uint128(amount1) : params.amount1;
            position.liquidity += uint128(liquidityAmount);
        }
        emit CompoundRange(
            params.positionId,
            uint128(liquidityAmount)
        );
        return (position, state, params.amount0.toInt128(), params.amount1.toInt128());
    }

    function update(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        RangePoolStructs.RangePosition memory position,
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.LimitImmutables memory constants,
        RangePoolStructs.UpdateParams memory params
    ) internal returns (
        RangePoolStructs.RangePosition memory,
        int128,
        int128
    ) {
        RangePoolStructs.RangePositionCache memory cache;
        /// @dev - only true if burn call
        if (params.burnPercent > 0) {
            cache.liquidityAmount = _convert(position.liquidity, params.burnPercent);
            if (position.liquidity == cache.liquidityAmount)
                IPositionERC1155(constants.poolToken).burn(msg.sender, params.positionId, 1, constants);
        }

        (uint256 rangeFeeGrowth0, uint256 rangeFeeGrowth1) = rangeFeeGrowth(
            ticks[position.lower].range,
            ticks[position.upper].range,
            state,
            position.lower,
            position.upper
        );

        int128 amount0Fees = OverflowMath.mulDiv(
            rangeFeeGrowth0 - position.feeGrowthInside0Last,
            uint256(position.liquidity),
            Q128
        ).toInt256().toInt128();

        int128 amount1Fees = OverflowMath.mulDiv(
            rangeFeeGrowth1 - position.feeGrowthInside1Last,
            position.liquidity,
            Q128
        ).toInt256().toInt128();

        position.feeGrowthInside0Last = rangeFeeGrowth0;
        position.feeGrowthInside1Last = rangeFeeGrowth1;

        return (position, amount0Fees, amount1Fees);
    }

    function rangeFeeGrowth(
        PoolsharkStructs.RangeTick memory lowerTick,
        PoolsharkStructs.RangeTick memory upperTick,
        PoolsharkStructs.GlobalState memory state,
        int24 lower,
        int24 upper
    ) internal pure returns (uint256 feeGrowthInside0, uint256 feeGrowthInside1) {

        uint256 feeGrowthGlobal0 = state.pool.feeGrowthGlobal0;
        uint256 feeGrowthGlobal1 = state.pool.feeGrowthGlobal1;

        uint256 feeGrowthBelow0;
        uint256 feeGrowthBelow1;
        if (state.pool.tickAtPrice >= lower) {
            feeGrowthBelow0 = lowerTick.feeGrowthOutside0;
            feeGrowthBelow1 = lowerTick.feeGrowthOutside1;
        } else {
            feeGrowthBelow0 = feeGrowthGlobal0 - lowerTick.feeGrowthOutside0;
            feeGrowthBelow1 = feeGrowthGlobal1 - lowerTick.feeGrowthOutside1;
        }

        uint256 feeGrowthAbove0;
        uint256 feeGrowthAbove1;
        if (state.pool.tickAtPrice < upper) {
            feeGrowthAbove0 = upperTick.feeGrowthOutside0;
            feeGrowthAbove1 = upperTick.feeGrowthOutside1;
        } else {
            feeGrowthAbove0 = feeGrowthGlobal0 - upperTick.feeGrowthOutside0;
            feeGrowthAbove1 = feeGrowthGlobal1 - upperTick.feeGrowthOutside1;
        }
        feeGrowthInside0 = feeGrowthGlobal0 - feeGrowthBelow0 - feeGrowthAbove0;
        feeGrowthInside1 = feeGrowthGlobal1 - feeGrowthBelow1 - feeGrowthAbove1;
    }

    function snapshot(
        mapping(uint256 => RangePoolStructs.RangePosition)
            storage positions,
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.LimitImmutables memory constants,
        uint32 positionId
    ) internal view returns (
        int56   tickSecondsAccum,
        uint160 secondsPerLiquidityAccum,
        uint128 feesOwed0,
        uint128 feesOwed1
    ) {
        RangePoolStructs.SnapshotRangeCache memory cache;
        cache.position = positions[positionId];

        // early return if position empty
        if (cache.position.liquidity == 0)
            return (0,0,0,0);

        cache.price = state.pool.price;
        cache.liquidity = state.pool.liquidity;
        cache.samples = state.pool.samples;

        // grab lower tick
        PoolsharkStructs.RangeTick memory tickLower = ticks[cache.position.lower].range;
        
        // grab upper tick
        PoolsharkStructs.RangeTick memory tickUpper = ticks[cache.position.upper].range;

        cache.tickSecondsAccumLower =  tickLower.tickSecondsAccumOutside;
        cache.secondsPerLiquidityAccumLower = tickLower.secondsPerLiquidityAccumOutside;

        // if both have never been crossed into return 0
        cache.tickSecondsAccumUpper = tickUpper.tickSecondsAccumOutside;
        cache.secondsPerLiquidityAccumUpper = tickUpper.secondsPerLiquidityAccumOutside;
        cache.constants = constants;

        (uint256 rangeFeeGrowth0, uint256 rangeFeeGrowth1) = rangeFeeGrowth(
            tickLower,
            tickUpper,
            state,
            cache.position.lower,
            cache.position.upper
        );

        // calcuate fees earned
        cache.amount0 += uint128(
            OverflowMath.mulDiv(
                rangeFeeGrowth0 - cache.position.feeGrowthInside0Last,
                cache.position.liquidity,
                Q128
            )
        );
        cache.amount1 += uint128(
            OverflowMath.mulDiv(
                rangeFeeGrowth1 - cache.position.feeGrowthInside1Last,
                cache.position.liquidity,
                Q128
            )
        );

        cache.tick = state.pool.tickAtPrice;

        if (cache.tick < cache.position.lower) {
            // lower accum values are greater
            return (
                cache.tickSecondsAccumLower - cache.tickSecondsAccumUpper,
                cache.secondsPerLiquidityAccumLower - cache.secondsPerLiquidityAccumUpper,
                cache.amount0,
                cache.amount1
            );
        } else if (cache.position.upper >= cache.tick) {
            // grab current sample
            cache.blockTimestamp = uint32(block.timestamp);
            (
                cache.tickSecondsAccum,
                cache.secondsPerLiquidityAccum
            ) = Samples.getSingle(
                IRangePool(address(this)), 
                RangePoolStructs.SampleParams(
                    cache.samples.index,
                    cache.samples.count,
                    uint32(block.timestamp),
                    new uint32[](2),
                    cache.tick,
                    cache.liquidity,
                    cache.constants
                ),
                0
            );
            return (
                cache.tickSecondsAccum 
                  - cache.tickSecondsAccumLower 
                  - cache.tickSecondsAccumUpper,
                cache.secondsPerLiquidityAccum
                  - cache.secondsPerLiquidityAccumLower
                  - cache.secondsPerLiquidityAccumUpper,
                cache.amount0,
                cache.amount1
            );
        } else {
            // upper accum values are greater
            return (
                cache.tickSecondsAccumUpper - cache.tickSecondsAccumLower,
                cache.secondsPerLiquidityAccumUpper - cache.secondsPerLiquidityAccumLower,
                cache.amount0,
                cache.amount1
            );
        }
    }

    function _convert(
        uint128 liquidity,
        uint128 percent
    ) internal pure returns (
        uint128
    ) {
        // convert percentage to liquidity amount
        if (percent > 1e38) percent = 1e38;
        if (liquidity == 0 && percent > 0) require (false, 'PositionNotFound()');
        return uint128(uint256(liquidity) * uint256(percent) / 1e38);
    }
}
