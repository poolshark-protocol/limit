// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../../interfaces/IPool.sol';
import '../../interfaces/range/IRangePoolStructs.sol';
import '../math/ConstantProduct.sol';
import './math/FeeMath.sol';
import '../math/OverflowMath.sol';
import '../utils/SafeCast.sol';
import './RangeTicks.sol';
import './Samples.sol';

/// @notice Position management library for ranged liquidity.
library RangePositions {
    using SafeCast for uint256;

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

    event Mint(
        address indexed recipient,
        int24 lower,
        int24 upper,
        uint256 indexed tokenId,
        uint128 liquidityMinted,
        uint128 amount0,
        uint128 amount1
    );

    event Burn(
        address indexed recipient,
        int24 lower,
        int24 upper,
        uint256 indexed tokenId,
        uint128 liquidityBurned,
        uint128 amount0,
        uint128 amount1
    );

    event Compound(
        int24 indexed lower,
        int24 indexed upper,
        uint128 liquidityCompounded,
        uint128 positionAmount0,
        uint128 positionAmount1
    );

    function validate(
        IRangePoolStructs.MintParams memory params,
        IRangePoolStructs.MintCache memory cache
    ) internal pure returns (
        IRangePoolStructs.MintParams memory,
        IRangePoolStructs.MintCache memory
    ) {
        RangeTicks.validate(cache.position.lower, cache.position.upper, cache.constants.tickSpacing);
        
        cache.priceLower = ConstantProduct.getPriceAtTick(cache.position.lower, cache.constants);
        cache.priceUpper = ConstantProduct.getPriceAtTick(cache.position.upper, cache.constants);

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
        IRangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage tickMap,
        IRangePoolStructs.MintCache memory cache,
        IRangePoolStructs.MintParams memory params
    ) internal returns (
        IRangePoolStructs.MintCache memory
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
            IRangePoolERC1155(cache.constants.poolToken).mint(
                params.to,
                params.positionId,
                1,
                cache.constants
            );
        }
        cache.position.liquidity += uint128(cache.liquidityMinted);
        emit Mint(
            params.to,
            cache.position.lower,
            cache.position.upper,
            params.positionId,
            cache.liquidityMinted.toUint128(),
            params.amount0,
            params.amount1
        );
        return cache;
    }

    function remove(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        IRangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage tickMap,
        IRangePoolStructs.BurnParams memory params,
        IRangePoolStructs.BurnCache memory cache
    ) internal returns (
        IRangePoolStructs.BurnCache memory
    ) {
        cache.priceLower = ConstantProduct.getPriceAtTick(cache.position.lower, cache.constants);
        cache.priceUpper = ConstantProduct.getPriceAtTick(cache.position.upper, cache.constants);
        cache.liquidityBurned = uint256(params.burnPercent) * cache.position.liquidity / 1e38;
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
            cache.position.amount0 += amount0Removed;
            cache.position.amount1 += amount1Removed;
            cache.position.liquidity -= uint128(cache.liquidityBurned);
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
        emit Burn(
            params.to,
            cache.position.lower,
            cache.position.upper,
            params.positionId,
            uint128(cache.liquidityBurned),
            cache.position.amount0,
            cache.position.amount1
        );
        if (cache.position.liquidity == 0) {
            cache.position.feeGrowthInside0Last = 0;
            cache.position.feeGrowthInside1Last = 0;
            cache.position.lower = 0;
            cache.position.upper = 0;
        }
        return cache;
    }

    function compound(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        IRangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.Immutables memory constants,
        IRangePoolStructs.RangePosition memory position,
        IRangePoolStructs.CompoundParams memory params
    ) internal returns (
        IRangePoolStructs.RangePosition memory,
        PoolsharkStructs.GlobalState memory
    ) {
        // price tells you the ratio so you need to swap into the correct ratio and add liquidity
        uint256 liquidityAmount = ConstantProduct.getLiquidityForAmounts(
            params.priceLower,
            params.priceUpper,
            state.pool.price,
            position.amount1,
            position.amount0
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
            position.amount0 -= (amount0 <= position.amount0) ? uint128(amount0) : position.amount0;
            position.amount1 -= (amount1 <= position.amount1) ? uint128(amount1) : position.amount1;
            position.liquidity += uint128(liquidityAmount);
        }
        emit Compound(
            position.lower,
            position.upper,
            uint128(liquidityAmount),
            position.amount0,
            position.amount1
        );
        return (position, state);
    }

    function update(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        IRangePoolStructs.RangePosition memory position,
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.Immutables memory constants,
        IRangePoolStructs.UpdateParams memory params
    ) internal returns (
        IRangePoolStructs.RangePosition memory
    ) {
        IRangePoolStructs.UpdatePositionCache memory cache;
        /// @dev - only true if burn call
        if (params.burnPercent > 0) {
            cache.liquidityAmount = uint256(params.burnPercent) * position.liquidity / 1e38;
            if (position.liquidity == cache.liquidityAmount)
                IRangePoolERC1155(constants.poolToken).burn(msg.sender, params.positionId, 1, constants);
        }

        (uint256 rangeFeeGrowth0, uint256 rangeFeeGrowth1) = rangeFeeGrowth(
            ticks[position.lower].range,
            ticks[position.upper].range,
            state,
            position.lower,
            position.upper
        );

        uint128 amount0Fees = uint128(
            OverflowMath.mulDiv(
                rangeFeeGrowth0 - position.feeGrowthInside0Last,
                uint256(position.liquidity),
                Q128
            )
        );

        uint128 amount1Fees = uint128(
            OverflowMath.mulDiv(
                rangeFeeGrowth1 - position.feeGrowthInside1Last,
                position.liquidity,
                Q128
            )
        );

        position.feeGrowthInside0Last = rangeFeeGrowth0;
        position.feeGrowthInside1Last = rangeFeeGrowth1;

        position.amount0 += amount0Fees;
        position.amount1 += amount1Fees;

        return position;
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

    function rangeFeeGrowth(
        address pool,
        int24 lower,
        int24 upper
    ) public view returns (
        uint256 feeGrowthInside0,
        uint256 feeGrowthInside1
    ) {
        RangeTicks.validate(lower, upper, (IPool(pool).immutables()).tickSpacing);
        (
            PoolsharkStructs.RangePoolState memory poolState,
            ,,,,
        ) = IPool(pool).globalState();

        (
            PoolsharkStructs.RangeTick memory tickLower
            ,
        )
            = IPool(pool).ticks(lower);
        (
            PoolsharkStructs.RangeTick memory tickUpper
            ,
        )
            = IPool(pool).ticks(upper);

        uint256 feeGrowthBelow0;
        uint256 feeGrowthBelow1;
        uint256 feeGrowthAbove0;
        uint256 feeGrowthAbove1;

        if (lower <= poolState.tickAtPrice) {
            feeGrowthBelow0 = tickLower.feeGrowthOutside0;
            feeGrowthBelow1 = tickLower.feeGrowthOutside1;
        } else {
            feeGrowthBelow0 = poolState.feeGrowthGlobal0 - tickLower.feeGrowthOutside0;
            feeGrowthBelow1 = poolState.feeGrowthGlobal1 - tickLower.feeGrowthOutside1;
        }

        if (poolState.tickAtPrice < upper) {
            feeGrowthAbove0 = tickUpper.feeGrowthOutside0;
            feeGrowthAbove1 = tickUpper.feeGrowthOutside1;
        } else {
            feeGrowthAbove0 = poolState.feeGrowthGlobal0 - tickUpper.feeGrowthOutside0;
            feeGrowthAbove1 = poolState.feeGrowthGlobal1 - tickUpper.feeGrowthOutside1;
        }
        feeGrowthInside0 = poolState.feeGrowthGlobal0 - feeGrowthBelow0 - feeGrowthAbove0;
        feeGrowthInside1 = poolState.feeGrowthGlobal1 - feeGrowthBelow1 - feeGrowthAbove1;
    }

    function snapshot(
        address pool,
        uint32 positionId
    ) external view returns (
        int56   tickSecondsAccum,
        uint160 secondsPerLiquidityAccum,
        uint128 feesOwed0,
        uint128 feesOwed1
    ) {
        IRangePoolStructs.SnapshotCache memory cache;
        (
            PoolsharkStructs.RangePoolState memory poolState,
            ,,,,
        ) = IPool(pool).globalState();

        (
            cache.position.feeGrowthInside0Last,
            cache.position.feeGrowthInside1Last,
            cache.position.amount0,
            cache.position.amount1,
            cache.position.liquidity,
            cache.position.lower,
            cache.position.upper
        ) = IPool(pool).positions(positionId);

        // early return if position empty
        if (cache.position.liquidity == 0)
            return (0,0,0,0);

        cache.price = poolState.price;
        cache.liquidity = poolState.liquidity;
        cache.samples = poolState.samples;

        // grab lower tick
        (
            PoolsharkStructs.RangeTick memory tickLower,
        ) = IPool(pool).ticks(cache.position.lower);
        
        // grab upper tick
        (
            PoolsharkStructs.RangeTick memory tickUpper,
        ) = IPool(pool).ticks(cache.position.upper);

        cache.tickSecondsAccumLower =  tickLower.tickSecondsAccumOutside;
        cache.secondsPerLiquidityAccumLower = tickLower.secondsPerLiquidityAccumOutside;

        // if both have never been crossed into return 0
        cache.tickSecondsAccumUpper = tickUpper.tickSecondsAccumOutside;
        cache.secondsPerLiquidityAccumUpper = tickUpper.secondsPerLiquidityAccumOutside;
        cache.constants = IPool(pool).immutables();

        (uint256 rangeFeeGrowth0, uint256 rangeFeeGrowth1) = rangeFeeGrowth(
            pool,
            cache.position.lower,
            cache.position.upper
        );

        // calcuate fees earned
        cache.position.amount0 += uint128(
            OverflowMath.mulDiv(
                rangeFeeGrowth0 - cache.position.feeGrowthInside0Last,
                cache.position.liquidity,
                Q128
            )
        );
        cache.position.amount1 += uint128(
            OverflowMath.mulDiv(
                rangeFeeGrowth1 - cache.position.feeGrowthInside1Last,
                cache.position.liquidity,
                Q128
            )
        );
        if (cache.totalSupply > 0) {
            cache.position.amount0 = uint128(cache.position.amount0 * cache.userBalance / cache.totalSupply);
            cache.position.amount1 = uint128(cache.position.amount1 * cache.userBalance / cache.totalSupply);
        }
        cache.tick = ConstantProduct.getTickAtPrice(cache.price, cache.constants);
        if (cache.position.lower >= cache.tick) {
            return (
                cache.tickSecondsAccumLower - cache.tickSecondsAccumUpper,
                cache.secondsPerLiquidityAccumLower - cache.secondsPerLiquidityAccumUpper,
                cache.position.amount0,
                cache.position.amount1
            );
        } else if (cache.position.upper >= cache.tick) {
            cache.blockTimestamp = uint32(block.timestamp);
            (
                cache.tickSecondsAccum,
                cache.secondsPerLiquidityAccum
            ) = Samples.getSingle(
                IPool(pool), 
                IRangePoolStructs.SampleParams(
                    cache.samples.index,
                    cache.samples.length,
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
                cache.position.amount0,
                cache.position.amount1
            );
        }
    }
}
