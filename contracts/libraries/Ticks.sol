// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../interfaces/ILimitPoolStructs.sol';
import '../interfaces/ILimitPoolFactory.sol';
import '../base/structs/LimitPoolFactoryStructs.sol';
import '../interfaces/ILimitPool.sol';
import './math/ConstantProduct.sol';
import './Positions.sol';
import './math/OverflowMath.sol';
import './TickMap.sol';
import './EpochMap.sol';
import './utils/SafeCast.sol';
import 'hardhat/console.sol';

/// @notice Tick management library
library Ticks {
    error LiquidityOverflow();
    error LiquidityUnderflow();
    error InvalidLowerTick();
    error InvalidUpperTick();
    error InvalidPositionAmount();
    error InvalidPositionBounds();

    using SafeCast for uint256;

    event Initialize(
        int24 minTick,
        int24 maxTick,
        uint160 startPrice
    );

    event Swap(
        address indexed recipient,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut,
        uint160 price,
        uint128 liquidity,
        int24 tickAtPrice
    );

    uint256 internal constant Q96 = 0x1000000000000000000000000;
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    function initialize(
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.PoolState storage pool0,
        ILimitPoolStructs.PoolState storage pool1,
        ILimitPoolStructs.GlobalState memory state,
        LimitPoolFactoryStructs.LimitPoolParams memory params
    ) external returns (
        ILimitPoolStructs.GlobalState memory,
        uint160,
        uint160
    ) {
        // initialize epoch
        pool0.swapEpoch = 1;
        pool1.swapEpoch = 1;

        // check price bounds
        ILimitPoolStructs.Immutables memory constants;
        (constants.bounds.min, constants.bounds.max) = ConstantProduct.priceBounds(params.tickSpacing);
        if (params.startPrice < constants.bounds.min || params.startPrice >= constants.bounds.max) require(false, 'StartPriceInvalid()');

        // initialize ticks
        TickMap.set(tickMap, ConstantProduct.minTick(params.tickSpacing), params.tickSpacing);
        TickMap.set(tickMap, ConstantProduct.maxTick(params.tickSpacing), params.tickSpacing);

        // initialize price
        pool0.price = params.startPrice;
        pool1.price = params.startPrice;

        constants.tickSpacing = params.tickSpacing;
        int24 startTick = TickMath.getTickAtPrice(params.startPrice, constants);
        pool0.tickAtPrice = startTick;
        pool1.tickAtPrice = startTick;

        // emit event
        emit Initialize(
            ConstantProduct.minTick(params.tickSpacing),
            ConstantProduct.maxTick(params.tickSpacing),
            pool0.price
        );

        return (state, constants.bounds.min, constants.bounds.max);
    }

    function validate(
        int24 lower,
        int24 upper,
        int24 tickSpacing
    ) internal pure {
        if (lower % tickSpacing != 0) require(false, 'InvalidLowerTick()');
        if (lower <= ConstantProduct.MIN_TICK) require(false, 'InvalidLowerTick()');
        if (upper % tickSpacing != 0) require(false, 'InvalidUpperTick()');
        if (upper >= ConstantProduct.MAX_TICK) require(false, 'InvalidUpperTick()');
        if (lower >= upper) require(false, 'InvalidPositionBounds()');
    }

    function swap(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.SwapParams memory params,
        ILimitPoolStructs.SwapCache memory cache,
        ILimitPoolStructs.PoolState memory pool
    ) internal returns (
            ILimitPoolStructs.PoolState memory,
            ILimitPoolStructs.SwapCache memory
        )
    {
        cache = ILimitPoolStructs.SwapCache({
            state: cache.state,
            constants: cache.constants,
            pool: cache.pool,
            price: pool.price,
            liquidity: pool.liquidity,
            cross: true,
            crossTick: params.zeroForOne ? TickMap.previous(tickMap, pool.tickAtPrice, cache.constants.tickSpacing) 
                                         : TickMap.next(tickMap, pool.tickAtPrice, cache.constants.tickSpacing),
            crossPrice: 0,
            input: params.amountIn,
            output: 0,
            amountIn: params.amountIn
        });
        // increment swap epoch
        cache.pool.swapEpoch += 1;
        // grab latest sample and store in cache for _cross
        while (cache.cross) {
            cache.crossPrice = ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants);
            (pool, cache) = _quoteSingle(params.zeroForOne, params.priceLimit, pool, cache);
            if (cache.cross) {
                (pool, cache) = _cross(
                    ticks,
                    tickMap,
                    pool,
                    cache,
                    params.zeroForOne
                );
            }
        }
        pool.price = cache.price.toUint160();
        pool.liquidity = cache.liquidity.toUint128();
        if (cache.price != cache.crossPrice) {
            pool.tickAtPrice = ConstantProduct.getTickAtPrice(pool.price, cache.constants);
        } else {
            pool.tickAtPrice = cache.crossTick;
        }
        emit Swap(
            params.to,
            params.zeroForOne,
            params.amountIn - cache.input,
            cache.output, /// @dev - subgraph will do math to compute fee amount
            pool.price,
            pool.liquidity,
            pool.tickAtPrice
        );
        return (pool, cache);
    }

    function quote(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.QuoteParams memory params,
        ILimitPoolStructs.SwapCache memory cache,
        ILimitPoolStructs.PoolState memory pool
    ) internal view returns (
            ILimitPoolStructs.PoolState memory,
            ILimitPoolStructs.SwapCache memory
        )
    {
        cache = ILimitPoolStructs.SwapCache({
            state: cache.state,
            constants: cache.constants,
            pool: cache.pool,
            price: pool.price,
            liquidity: pool.liquidity,
            cross: true,
            crossTick: params.zeroForOne ? TickMap.previous(tickMap, pool.tickAtPrice, cache.constants.tickSpacing) 
                                         : TickMap.next(tickMap, pool.tickAtPrice, cache.constants.tickSpacing),
            crossPrice: 0,
            input: params.amountIn,
            output: 0,
            amountIn: params.amountIn
        });
        while (cache.cross) {
            cache.crossPrice = ConstantProduct.getPriceAtTick(cache.crossTick, cache.constants);
            (pool, cache) = _quoteSingle(params.zeroForOne, params.priceLimit, pool, cache);
            if (cache.cross) {
                (pool, cache) = _pass(
                    ticks,
                    tickMap,
                    pool,
                    cache,
                    params.zeroForOne
                );
            }
        }
        //TODO: safe downcasting
        pool.price = uint160(cache.price);
        return (pool, cache);
    }

    function _quoteSingle(
        bool zeroForOne,
        uint160 priceLimit,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.SwapCache memory cache
    ) internal pure returns (
        ILimitPoolStructs.PoolState memory,
        ILimitPoolStructs.SwapCache memory
    ) {
        if (zeroForOne ? priceLimit >= cache.price
                       : priceLimit <= cache.price)
        {
            cache.cross = false;
            return (pool, cache);
        }
        uint256 nextPrice = cache.crossPrice;
        uint256 amountOut;
        if (zeroForOne) {
            // Trading token 0 (x) for token 1 (y).
            // price  is decreasing.
            if (nextPrice < priceLimit) {
                nextPrice = priceLimit;
            }
            uint256 maxDx = DyDxMath.getDx(cache.liquidity, nextPrice, cache.price, true);
            if (cache.input <= maxDx) {
                // We can swap within the current range.
                uint256 liquidityPadded = uint256(cache.liquidity) << 96;
                // calculate price after swap
                uint256 newPrice = OverflowMath.mulDivRoundingUp(
                    liquidityPadded,
                    cache.price,
                    liquidityPadded + uint256(cache.price) * uint256(cache.input)
                );
                amountOut = DyDxMath.getDy(cache.liquidity, newPrice, uint256(cache.price), false);
                cache.input = 0;
                cache.cross = false;
                cache.price = uint160(newPrice);
            } else { 
                amountOut = DyDxMath.getDy(cache.liquidity, nextPrice, cache.price, false);
                cache.input -= maxDx;
                if (nextPrice == cache.crossPrice
                        && nextPrice != cache.price) { cache.cross = true; }
                else cache.cross = false;
                cache.price = uint160(nextPrice);
            }
        } else {
            // Price is increasing.
            if (nextPrice > priceLimit) {
                nextPrice = priceLimit;
            }
            uint256 maxDy = DyDxMath.getDy(cache.liquidity, uint256(cache.price), nextPrice, true);
            if (cache.input <= maxDy) {
                // We can swap within the current range.
                // Calculate new price after swap: ΔP = Δy/L.
                uint256 newPrice = cache.price +
                    OverflowMath.mulDiv(cache.input, Q96, cache.liquidity);
                // Calculate output of swap
                amountOut = DyDxMath.getDx(cache.liquidity, cache.price, newPrice, false);
                cache.input = 0;
                cache.cross = false;
                cache.price = uint160(newPrice);
            } else {
                // Swap & cross the tick.
                amountOut = DyDxMath.getDx(cache.liquidity, cache.price, nextPrice, false);
                cache.input -= maxDy;
                if (nextPrice == cache.crossPrice 
                    && nextPrice != cache.price) { cache.cross = true; }
                else cache.cross = false;
                cache.price = uint160(nextPrice);
            }
        }
        cache.output += amountOut;
        return (pool, cache);
    }

    //maybe call ticks on msg.sender to get tick
    function _cross(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.SwapCache memory cache,
        bool zeroForOne
    ) internal returns (
        ILimitPoolStructs.PoolState memory,
        ILimitPoolStructs.SwapCache memory
    ) {
        console.log('crossing tick');
        console.logInt(cache.crossTick);
        console.log(cache.liquidity);
        EpochMap.set(cache.crossTick, cache.pool.swapEpoch, tickMap, cache.constants);
        int128 liquidityDelta = ticks[cache.crossTick].liquidityDelta;
        console.logInt(liquidityDelta);
        if (liquidityDelta > 0) cache.liquidity += uint128(ticks[cache.crossTick].liquidityDelta);
        else cache.liquidity -= uint128(-ticks[cache.crossTick].liquidityDelta);
        pool.tickAtPrice = cache.crossTick;
        ticks[cache.crossTick].liquidityDelta = 0;
        if (zeroForOne) {
            cache.crossTick = TickMap.previous(tickMap, cache.crossTick, cache.constants.tickSpacing);
        } else {
            cache.crossTick = TickMap.next(tickMap, cache.crossTick, cache.constants.tickSpacing);
        }
        return (pool, cache);
    }

    function _pass(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.SwapCache memory cache,
        bool zeroForOne
    ) internal view returns (
        ILimitPoolStructs.PoolState memory,
        ILimitPoolStructs.SwapCache memory
    ) {
        if (zeroForOne) {
            unchecked {
                cache.liquidity -= uint128(ticks[cache.crossTick].liquidityDelta);
            }
            pool.tickAtPrice = cache.crossTick;
            cache.crossTick = TickMap.previous(tickMap, cache.crossTick, cache.constants.tickSpacing);
        } else {
            unchecked {
                cache.liquidity += uint128(ticks[cache.crossTick].liquidityDelta);
            }
            pool.tickAtPrice = cache.crossTick;
            cache.crossTick = TickMap.next(tickMap, cache.crossTick, cache.constants.tickSpacing);
        }
        return (pool, cache);
    }
    
    function insert(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.Immutables memory constants,
        int24 lower,
        int24 upper,
        uint128 amount,
        bool isPool0
    ) external {
        /// @dev - validation of ticks is in Positions.validate
        if (amount > uint128(type(int128).max)) require (false, 'LiquidityOverflow()');
        if ((uint128(type(int128).max) - pool.liquidityGlobal) < amount)
            require (false, 'LiquidityOverflow()');

        // load ticks into memory to reduce reads/writes
        ILimitPoolStructs.Tick memory tickLower = ticks[lower];
        ILimitPoolStructs.Tick memory tickUpper = ticks[upper];

        // sets bit in map
        TickMap.set(tickMap, lower, constants.tickSpacing);

        // updates liquidity values
        if (isPool0) {
            tickLower.liquidityDelta += int128(amount);
        } else {
            tickLower.liquidityDelta -= int128(amount);
        }

        TickMap.set(tickMap, upper, constants.tickSpacing);

        if (isPool0) {
            tickUpper.liquidityDelta -= int128(amount);
        } else {
            tickUpper.liquidityDelta += int128(amount);
        }
        ticks[lower] = tickLower;
        ticks[upper] = tickUpper;
    }

    function remove(
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.Immutables memory constants,
        int24 lower,
        int24 upper,
        uint128 amount,
        bool isPool0,
        bool removeLower,
        bool removeUpper
    ) external {
        {
            ILimitPoolStructs.Tick memory tickLower = ticks[lower];
            
            if (removeLower) {
                if (isPool0) {
                    tickLower.liquidityDelta -= int128(amount);
                } else {
                    tickLower.liquidityDelta += int128(amount);
                }
                console.logInt(tickLower.liquidityDelta);
                ticks[lower] = tickLower;
            }
            if (lower != ConstantProduct.minTick(constants.tickSpacing) && _empty(tickLower)) {
                TickMap.unset(tickMap, lower, constants.tickSpacing);
            }
        }
        {
            ILimitPoolStructs.Tick memory tickUpper = ticks[upper];
            if (removeUpper) {
                if (isPool0) {
                    tickUpper.liquidityDelta += int128(amount);
                } else {
                    tickUpper.liquidityDelta -= int128(amount);
                }
                ticks[upper] = tickUpper;
            }
            if (upper != ConstantProduct.maxTick(constants.tickSpacing) && _empty(tickUpper)) {
                TickMap.unset(tickMap, upper, constants.tickSpacing);
            }
        }
    }

    function _empty(
        ILimitPoolStructs.Tick memory tick
    ) internal pure returns (
        bool
    ) {
        if (tick.liquidityDelta != 0) {
            return false;
        }
        return true;
    }
}
