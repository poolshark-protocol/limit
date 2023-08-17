// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../../interfaces/IPool.sol';
import '../../interfaces/range/IRangePoolStructs.sol';
import '../math/ConstantProduct.sol';
import './math/FeeMath.sol';
import '../math/OverflowMath.sol';
import '../utils/SafeCast.sol';
import './RangeTicks.sol';
import './RangeTokens.sol';
import './Samples.sol';
import 'hardhat/console.sol';

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
        uint128 tokenMinted,
        uint128 liquidityMinted,
        uint128 amount0,
        uint128 amount1
    );

    event Burn(
        address indexed recipient,
        int24 lower,
        int24 upper,
        uint256 indexed tokenId,
        uint128 tokenBurned,
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
        RangeTicks.validate(params.lower, params.upper, cache.constants.tickSpacing);
        
        cache.priceLower = ConstantProduct.getPriceAtTick(params.lower, cache.constants);
        cache.priceUpper = ConstantProduct.getPriceAtTick(params.upper, cache.constants);

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
        IRangePoolStructs.MintParams memory params,
        IRangePoolStructs.MintCache memory cache
    ) internal returns (
        IRangePoolStructs.MintCache memory
    ) {
        if (params.amount0 == 0 && params.amount1 == 0) return cache;

        cache.tokenId = Tokens.id(params.lower, params.upper);
        cache.totalSupply = Tokens.totalSupply(cache.constants.poolToken, params.lower, params.upper);

        cache.state = RangeTicks.insert(
            ticks,
            samples,
            tickMap,
            cache.state,
            cache.constants,
            params.lower,
            params.upper,
            cache.liquidityMinted.toUint128()
        );
        (
            cache.position.feeGrowthInside0Last,
            cache.position.feeGrowthInside1Last
        ) = rangeFeeGrowth(
            ticks[params.lower].range,
            ticks[params.upper].range,
            cache.state,
            params.lower,
            params.upper
        );

        console.log('position amounts', cache.position.amount0, cache.position.amount1);
        console.log('total supply', cache.totalSupply);

        if (cache.position.liquidity == cache.totalSupply &&
            cache.position.amount0 == 0 &&
            cache.position.amount1 == 0
        ) {
            console.log('fresh mint', cache.liquidityMinted);
            cache.tokenMinted = cache.liquidityMinted;
        } else {
            (cache.amount0, cache.amount1) = ConstantProduct.getAmountsForLiquidity(
                cache.priceLower,
                cache.priceUpper,
                cache.state.pool.price,
                cache.position.liquidity,
                true
            );
            cache.amount0 += cache.position.amount0;
            cache.amount1 += cache.position.amount1;
            if (cache.state.pool.tickAtPrice >= 0) {
                // score in terms of token1
                cache.mintScore = OverflowMath.mulDivRoundingUp(params.amount0, cache.state.pool.price, Q96) + params.amount1;
                cache.positionScore = OverflowMath.mulDivRoundingUp(cache.amount0, cache.state.pool.price, Q96) + cache.amount1;
            } else {
                // score in terms of token0
                cache.mintScore = params.amount0 + OverflowMath.mulDivRoundingUp(params.amount1, Q96, cache.state.pool.price);
                cache.positionScore = cache.amount0 + OverflowMath.mulDivRoundingUp(cache.amount1, Q96, cache.state.pool.price);
            }
            console.log(ConstantProduct.getPriceAtTick(0, cache.constants));
            console.log('position score', cache.positionScore);
            console.log('mint score', cache.mintScore);
            cache.tokenMinted = cache.mintScore * cache.totalSupply / cache.positionScore;
        }
        IRangePoolERC1155(cache.constants.poolToken).mintFungible(
            params.to,
            cache.tokenId,
            cache.tokenMinted,
            cache.constants
        );
        cache.position.liquidity += uint128(cache.liquidityMinted);
        emit Mint(
            params.to,
            params.lower,
            params.upper,
            cache.tokenId,
            cache.tokenMinted.toUint128(),
            cache.liquidityMinted.toUint128(),
            params.amount0,
            params.amount1
        );
        return cache;
    }

    function remove(
        IRangePoolStructs.Position memory position,
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        IRangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.GlobalState memory state,
        IRangePoolStructs.BurnParams memory params,
        IRangePoolStructs.RemoveParams memory removeParams
    ) internal returns (
        PoolsharkStructs.GlobalState memory,
        IRangePoolStructs.Position memory,
        uint128,
        uint128
    ) {
        IRangePoolStructs.PositionCache memory cache = IRangePoolStructs.PositionCache({
            priceLower: ConstantProduct.getPriceAtTick(params.lower, removeParams.constants),
            priceUpper: ConstantProduct.getPriceAtTick(params.upper, removeParams.constants),
            liquidityOnPosition: 0,
            liquidityAmount: 0,
            totalSupply: 0,
            tokenId: Tokens.id(params.lower, params.upper),
            amount0: 0,
            amount1: 0
        });
        cache.totalSupply = Tokens.totalSupplyById(removeParams.constants.poolToken, cache.tokenId);
        cache.liquidityAmount = params.burnPercent > 0 ? removeParams.tokenBurned * uint256(position.liquidity) 
                                                                       / (cache.totalSupply + removeParams.tokenBurned)
                                                                     : 0;
        if (removeParams.tokenBurned == 0) {
            return (state, position, removeParams.amount0, removeParams.amount1);
        } 
        if (cache.liquidityAmount > position.liquidity) require(false, 'NotEnoughPositionLiquidity()');
        {
            uint128 amount0Removed; uint128 amount1Removed;
            (amount0Removed, amount1Removed) = ConstantProduct.getAmountsForLiquidity(
                cache.priceLower,
                cache.priceUpper,
                state.pool.price,
                cache.liquidityAmount,
                false
            );
            removeParams.amount0 += amount0Removed;
            removeParams.amount1 += amount1Removed;

            position.amount0 += amount0Removed;
            position.amount1 += amount1Removed;
            position.liquidity -= uint128(cache.liquidityAmount);
        }
        if (position.liquidity == 0) {
            position.feeGrowthInside0Last = 0;
            position.feeGrowthInside1Last = 0;
        }
        state = RangeTicks.remove(
            ticks,
            samples,
            tickMap,
            state,
            removeParams.constants,
            params.lower,
            params.upper,
            uint128(cache.liquidityAmount)
        );
        emit Burn(
            params.to,
            params.lower,
            params.upper,
            cache.tokenId,
            removeParams.tokenBurned,
            uint128(cache.liquidityAmount),
            removeParams.amount0,
            removeParams.amount1
        );
        return (state, position, removeParams.amount0, removeParams.amount1);
    }

    function compound(
        IRangePoolStructs.Position memory position,
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        IRangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage tickMap,
        PoolsharkStructs.GlobalState memory state,
        IRangePoolStructs.CompoundParams memory params,
        PoolsharkStructs.Immutables memory constants
    ) internal returns (IRangePoolStructs.Position memory, PoolsharkStructs.GlobalState memory) {
        IRangePoolStructs.PositionCache memory cache = IRangePoolStructs.PositionCache({
            priceLower: ConstantProduct.getPriceAtTick(params.lower, constants),
            priceUpper: ConstantProduct.getPriceAtTick(params.upper, constants),
            liquidityOnPosition: 0,
            liquidityAmount: 0,
            totalSupply: 0,
            tokenId: 0,
            amount0: 0,
            amount1: 0
        });

        // price tells you the ratio so you need to swap into the correct ratio and add liquidity
        cache.liquidityAmount = ConstantProduct.getLiquidityForAmounts(
            cache.priceLower,
            cache.priceUpper,
            state.pool.price,
            position.amount1,
            position.amount0
        );
        if (cache.liquidityAmount > 0) {
            state = RangeTicks.insert(
                ticks,
                samples,
                tickMap,
                state,
                constants,
                params.lower,
                params.upper,
                uint128(cache.liquidityAmount)
            );
            uint256 amount0; uint256 amount1;
            (amount0, amount1) = ConstantProduct.getAmountsForLiquidity(
                cache.priceLower,
                cache.priceUpper,
                state.pool.price,
                cache.liquidityAmount,
                true
            );
            position.amount0 -= (amount0 <= position.amount0) ? uint128(amount0) : position.amount0;
            position.amount1 -= (amount1 <= position.amount1) ? uint128(amount1) : position.amount1;
            position.liquidity += uint128(cache.liquidityAmount);
        }
        emit Compound(
            params.lower,
            params.upper,
            uint128(cache.liquidityAmount),
            position.amount0,
            position.amount1
        );
        return (position, state);
    }

    function update(
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        IRangePoolStructs.Position memory position,
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.Immutables memory constants,
        IRangePoolStructs.UpdateParams memory params
    ) internal returns (
        IRangePoolStructs.Position memory,
        uint128, 
        uint128,
        uint128
    ) {
        IRangePoolStructs.UpdatePositionCache memory cache;
        cache.totalSupply = Tokens.totalSupply(constants.poolToken, params.lower, params.upper);
        /// @dev - only true if burn call
        if (params.burnPercent > 0) {
            uint256 tokenId = Tokens.id(params.lower, params.upper);
            cache.tokenBurned = params.burnPercent * Tokens.balanceOf(constants.poolToken, msg.sender, params.lower, params.upper) / 1e38;
            IRangePoolERC1155(constants.poolToken).burnFungible(msg.sender, tokenId, cache.tokenBurned, constants);
        }
        
        (uint256 rangeFeeGrowth0, uint256 rangeFeeGrowth1) = rangeFeeGrowth(
            ticks[params.lower].range,
            ticks[params.upper].range,
            state,
            params.lower,
            params.upper
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

        if (params.burnPercent > 0) {
            cache.feesBurned0 = uint128(
                (uint256(position.amount0) * uint256(cache.tokenBurned)) / (cache.totalSupply)
            );
            cache.feesBurned1 = uint128(
                (uint256(position.amount1) * uint256(cache.tokenBurned)) / (cache.totalSupply)
            );
        }
        return (position, cache.feesBurned0, cache.feesBurned1, uint128(cache.tokenBurned));
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
        address owner,
        int24 lower,
        int24 upper
    ) external view returns (
        int56   tickSecondsAccum,
        uint160 secondsPerLiquidityAccum,
        uint128 feesOwed0,
        uint128 feesOwed1
    ) {
        PoolsharkStructs.Immutables memory constants = IPool(pool).immutables();
        
        RangeTicks.validate(lower, upper, constants.tickSpacing);

        IRangePoolStructs.SnapshotCache memory cache;
        (
            PoolsharkStructs.RangePoolState memory poolState,
            ,,,,
        ) = IPool(pool).globalState();


        cache.price = poolState.price;
        cache.liquidity = poolState.liquidity;
        cache.samples = poolState.samples;

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

        cache.tickSecondsAccumLower =  tickLower.tickSecondsAccumOutside;
        cache.secondsPerLiquidityAccumLower = tickLower.secondsPerLiquidityAccumOutside;

        // if both have never been crossed into return 0
        cache.tickSecondsAccumUpper = tickUpper.tickSecondsAccumOutside;
        cache.secondsPerLiquidityAccumUpper = tickUpper.secondsPerLiquidityAccumOutside;

        (
            cache.position.feeGrowthInside0Last,
            cache.position.feeGrowthInside1Last,
            cache.position.liquidity,
            cache.position.amount0,
            cache.position.amount1
        ) = IPool(pool).positions(lower, upper);

        cache.constants = IPool(pool).immutables();
        
        cache.userBalance = Tokens.balanceOf(constants.poolToken, owner, lower, upper);
        cache.totalSupply = Tokens.totalSupply(constants.poolToken, lower, upper);

        (uint256 rangeFeeGrowth0, uint256 rangeFeeGrowth1) = rangeFeeGrowth(
            pool,
            lower,
            upper
        );
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
        if (lower >= cache.tick) {
            return (
                cache.tickSecondsAccumLower - cache.tickSecondsAccumUpper,
                cache.secondsPerLiquidityAccumLower - cache.secondsPerLiquidityAccumUpper,
                cache.position.amount0,
                cache.position.amount1
            );
        } else if (upper >= cache.tick) {
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

    function id(int24 lower, int24 upper) public pure returns (uint256) {
        return Tokens.id(lower, upper);
    }
}
