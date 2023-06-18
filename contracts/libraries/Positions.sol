// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;

import '../interfaces/modules/curves/ICurveMath.sol';
import './Ticks.sol';
import '../interfaces/ILimitPoolStructs.sol';
import './math/OverflowMath.sol';
import '../interfaces/modules/curves/ICurveMath.sol';
import './Claims.sol';
import './EpochMap.sol';

/// @notice Position management library for ranged liquidity.
library Positions {
    uint256 internal constant Q96 = 0x1000000000000000000000000;

    event Mint(
        address indexed to,
        int24 lower,
        int24 upper,
        bool zeroForOne,
        uint32 epochLast,
        uint128 amountIn,
        uint128 liquidityMinted
    );

    event Burn(
        address indexed to,
        int24 lower,
        int24 upper,
        int24 claim,
        bool zeroForOne,
        uint128 liquidityBurned,
        uint128 tokenInClaimed,
        uint128 tokenOutClaimed,
        uint128 tokenOutBurned
    );

    function resize(
        ILimitPoolStructs.Position memory position,
        ILimitPoolStructs.MintParams memory params,
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.Immutables memory constants
    ) internal pure returns (
        ILimitPoolStructs.MintParams memory,
        uint256
    )
    {
        ConstantProduct.checkTicks(params.lower, params.upper, constants.tickSpacing);

        ILimitPoolStructs.PositionCache memory cache = ILimitPoolStructs.PositionCache({
            position: position,
            priceLower: ConstantProduct.getPriceAtTick(params.lower, constants),
            priceUpper: ConstantProduct.getPriceAtTick(params.upper, constants),
            requiredStart: params.zeroForOne ? params.lower
                                             : params.upper,
            liquidityMinted: 0
        });

        // cannot mint empty position
        if (params.amount == 0) require (false, 'PositionAmountZero()');

        // calculate L constant
        cache.liquidityMinted = ConstantProduct.getLiquidityForAmounts(
            cache.priceLower,
            cache.priceUpper,
            params.zeroForOne ? cache.priceLower : cache.priceUpper,
            params.zeroForOne ? 0 : uint256(params.amount),
            params.zeroForOne ? uint256(params.amount) : 0
        );

        // trim position if undercutting way below market price
        // execute market swap if liquidity available

        // handle partial mints
        if (params.zeroForOne) {
            if (params.upper > cache.requiredStart) {
                params.upper = cache.requiredStart;
                uint256 priceNewUpper = ConstantProduct.getPriceAtTick(params.upper, constants);
                params.amount -= uint128(
                    ConstantProduct.getDx(cache.liquidityMinted, priceNewUpper, cache.priceUpper, false)
                );
                cache.priceUpper = uint160(priceNewUpper);
            }
        } else {
            if (params.lower < cache.requiredStart) {
                params.lower = cache.requiredStart;
                uint256 priceNewLower = ConstantProduct.getPriceAtTick(params.lower, constants);
                params.amount -= uint128(
                    ConstantProduct.getDy(cache.liquidityMinted, cache.priceLower, priceNewLower, false)
                );
                cache.priceLower = uint160(priceNewLower);
            }
        }
        // check for liquidity overflow
        if (cache.liquidityMinted > uint128(type(int128).max)) require (false, 'LiquidityOverflow()');
 
        return (
            params,
            cache.liquidityMinted
        );
    }

    function add(
       ILimitPoolStructs.Position memory position,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.AddParams memory params,
        ILimitPoolStructs.Immutables memory constants
    ) internal returns (
        ILimitPoolStructs.GlobalState memory,
        ILimitPoolStructs.Position memory
    ) {
        if (params.amount == 0) return (state, position);

        // initialize cache
        ILimitPoolStructs.PositionCache memory cache = ILimitPoolStructs.PositionCache({
            position: position,
            priceLower: ConstantProduct.getPriceAtTick(params.lower, constants),
            priceUpper: ConstantProduct.getPriceAtTick(params.upper, constants),
            requiredStart: params.zeroForOne ? params.lower
                                             : params.upper,
            liquidityMinted: 0
        });
        /// call if claim != lower and liquidity being added
        /// initialize new position

        if (cache.position.liquidity == 0) {
            cache.position.swapEpochLast = state.swapEpoch;
        } else {
            // safety check in case we somehow get here
            if (
                params.zeroForOne
                    ? EpochMap.get(TickMap.next(tickMap, params.lower, constants.tickSpacing), tickMap, constants)
                            > cache.position.swapEpochLast
                    : EpochMap.get(TickMap.previous(tickMap, params.upper, constants.tickSpacing), tickMap, constants)
                            > cache.position.swapEpochLast
            ) {
                require (false, string.concat('UpdatePositionFirstAt(', String.from(params.lower), ', ', String.from(params.upper), ')'));
            }
        }
        
        // add liquidity to ticks
        Ticks.insert(
            ticks,
            tickMap,
            state,
            constants,
            params.lower,
            params.upper,
            uint128(params.amount),
            params.zeroForOne
        );

        // update liquidity global
        state.liquidityGlobal += params.amount;

        cache.position.liquidity += uint128(params.amount);

        emit Mint(
            params.to,
            params.lower,
            params.upper,
            params.zeroForOne,
            state.swapEpoch,
            uint128(params.amountIn),
            uint128(params.amount)
        );

        return (state, cache.position);
    }

    function remove(
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.Position)))
            storage positions,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.RemoveParams memory params,
        ILimitPoolStructs.Immutables memory constants
    ) internal returns (uint128, ILimitPoolStructs.GlobalState memory) {
        // validate burn percentage
        if (params.amount > 1e38) require (false, 'InvalidBurnPercentage()');
        // initialize cache
        ILimitPoolStructs.PositionCache memory cache = ILimitPoolStructs.PositionCache({
            position: positions[params.owner][params.lower][params.upper],
            requiredStart: params.zeroForOne ? params.lower
                                             : params.upper,
            priceLower: ConstantProduct.getPriceAtTick(params.lower, constants),
            priceUpper: ConstantProduct.getPriceAtTick(params.upper, constants),
            liquidityMinted: 0
        });
        // convert percentage to liquidity amount
        params.amount = _convert(cache.position.liquidity, params.amount);
        // early return if no liquidity to remove
        if (params.amount == 0) return (0, state);
        if (params.amount > cache.position.liquidity) {
            require (false, 'NotEnoughPositionLiquidity()');
        } else {
            /// @dev - validate needed in case user passes in wrong tick
            if (
                params.zeroForOne
                    ? state.latestTick < params.upper ||
                        EpochMap.get(TickMap.previous(tickMap, params.upper, constants.tickSpacing), tickMap, constants)
                            > cache.position.swapEpochLast
                    : state.latestTick > params.lower ||
                        EpochMap.get(TickMap.next(tickMap, params.lower, constants.tickSpacing), tickMap, constants)
                            > cache.position.swapEpochLast
            ) {
                require (false, 'WrongTickClaimedAt()');
            }
        }

        Ticks.remove(
            ticks,
            tickMap,
            constants,
            params.lower,
            params.upper,
            params.amount,
            params.zeroForOne,
            true,
            true
        );

        // update liquidity global
        state.liquidityGlobal -= params.amount;

        {
            // update max deltas
            ILimitPoolStructs.Tick memory finalTick = ticks[params.zeroForOne ? params.lower : params.upper];
            ticks[params.zeroForOne ? params.lower : params.upper] = finalTick;
        }

        cache.position.amountOut += uint128(
            params.zeroForOne
                ? ConstantProduct.getDx(params.amount, cache.priceLower, cache.priceUpper, false)
                : ConstantProduct.getDy(params.amount, cache.priceLower, cache.priceUpper, false)
        );

        cache.position.liquidity -= uint128(params.amount);
        positions[params.owner][params.lower][params.upper] = cache.position;

        if (params.amount > 0) {
            emit Burn(
                    params.to,
                    params.lower,
                    params.upper,
                    params.zeroForOne ? params.upper : params.lower,
                    params.zeroForOne,
                    params.amount,
                    0, 0,
                    cache.position.amountOut
            );
        }
        return (params.amount, state);
    }

    function update(
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.Position)))
            storage positions,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.UpdateParams memory params,
        ILimitPoolStructs.Immutables memory constants
    ) internal returns (
            ILimitPoolStructs.GlobalState memory,
            ILimitPoolStructs.PoolState memory,
            int24
        )
    {
        ILimitPoolStructs.UpdatePositionCache memory cache;
        (
            cache,
            state
        ) = _deltas(
            positions,
            ticks,
            tickMap,
            state,
            pool,
            params,
            constants
        );

        if (cache.earlyReturn)
            return (state, pool, params.claim);

        // save claim tick
        ticks[params.claim] = cache.claimTick;
        if (params.claim != (params.zeroForOne ? params.lower : params.upper))
            ticks[params.zeroForOne ? params.lower : params.upper] = cache.finalTick;
        
        // update pool liquidity
        if (state.latestTick == params.claim
            && params.claim != (params.zeroForOne ? params.lower : params.upper)
        ) pool.liquidity -= params.amount;
        
        if (params.amount > 0) {
            if (params.claim == (params.zeroForOne ? params.lower : params.upper)) {
                // only remove once if final tick of position
                cache.removeLower = false;
                cache.removeUpper = false;
            } else {
                params.zeroForOne ? cache.removeUpper = true 
                                  : cache.removeLower = true;
            }
            Ticks.remove(
                ticks,
                tickMap,
                constants,
                params.zeroForOne ? params.lower : params.claim,
                params.zeroForOne ? params.claim : params.upper,
                params.amount,
                params.zeroForOne,
                cache.removeLower,
                cache.removeUpper
            );
            // update position liquidity
            cache.position.liquidity -= uint128(params.amount);
            // update global liquidity
            state.liquidityGlobal -= params.amount;
        }

        (
            cache,
            params
        ) = _checkpoint(state, pool, params, constants, cache);

        // clear out old position
        if (params.zeroForOne ? params.claim != params.upper 
                              : params.claim != params.lower) {
            /// @dev - this also clears out position end claims
            if (params.zeroForOne ? params.claim == params.lower 
                                  : params.claim == params.upper) {
                // subtract remaining position liquidity out from global
                state.liquidityGlobal -= cache.position.liquidity;
            }
            delete positions[params.owner][params.lower][params.upper];
        }
        // force collection to the user
        // store cached position in memory
        if (cache.position.liquidity == 0) {
            cache.position.swapEpochLast = 0;
            cache.position.claimPriceLast = 0;
        }
        params.zeroForOne
            ? positions[params.owner][params.lower][params.claim] = cache.position
            : positions[params.owner][params.claim][params.upper] = cache.position;
        
        emit Burn(
            params.to,
            params.lower,
            params.upper,
            params.claim,
            params.zeroForOne,
            params.amount,
            cache.position.amountIn,
            cache.finalDeltas.amountOutDelta,
            cache.position.amountOut - cache.finalDeltas.amountOutDelta
        );
        // return cached position in memory and transfer out
        return (state, pool, params.claim);
    }

    function snapshot(
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.Position)))
            storage positions,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.UpdateParams memory params,
        ILimitPoolStructs.Immutables memory constants
    ) external view returns (
        ILimitPoolStructs.Position memory
    ) {
        ILimitPoolStructs.UpdatePositionCache memory cache;
        (
            cache,
            state
        ) = _deltas(
            positions,
            ticks,
            tickMap,
            state,
            pool,
            params,
            constants
        );

        if (cache.earlyReturn) {
            if (params.amount > 0)
                cache.position.amountOut += uint128(
                    params.zeroForOne
                        ? ConstantProduct.getDx(params.amount, cache.priceLower, cache.priceUpper, false)
                        : ConstantProduct.getDy(params.amount, cache.priceLower, cache.priceUpper, false)
                );
            return cache.position;
        }

        if (params.amount > 0) {
            cache.position.liquidity -= uint128(params.amount);
        }
        // checkpoint claimPriceLast
        (
            cache,
            params
        ) = _checkpoint(state, pool, params, constants, cache);
        
        // clear position values if empty
        if (cache.position.liquidity == 0) {
            cache.position.swapEpochLast = 0;
            cache.position.claimPriceLast = 0;
        }    
        return cache.position;
    }

    function _convert(
        uint128 liquidity,
        uint128 percent
    ) internal pure returns (
        uint128
    ) {
        // convert percentage to liquidity amount
        if (percent > 1e38) require (false, 'InvalidBurnPercentage()');
        if (liquidity == 0 && percent > 0) require (false, 'NotEnoughPositionLiquidity()');
        return uint128(uint256(liquidity) * uint256(percent) / 1e38);
    }

    function _deltas(
        mapping(address => mapping(int24 => mapping(int24 => ILimitPoolStructs.Position)))
            storage positions,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.UpdateParams memory params,
        ILimitPoolStructs.Immutables memory constants
    ) internal view returns (
        ILimitPoolStructs.UpdatePositionCache memory,
        ILimitPoolStructs.GlobalState memory
    ) {
        ILimitPoolStructs.UpdatePositionCache memory cache = ILimitPoolStructs.UpdatePositionCache({
            position: positions[params.owner][params.lower][params.upper],
            pool: pool,
            priceLower: ConstantProduct.getPriceAtTick(params.lower, constants),
            priceClaim: ConstantProduct.getPriceAtTick(params.claim, constants),
            priceUpper: ConstantProduct.getPriceAtTick(params.upper, constants),
            priceSpread: ConstantProduct.getPriceAtTick(params.zeroForOne ? params.claim - constants.tickSpacing 
                                                                          : params.claim + constants.tickSpacing,
                                                        constants),
            amountInFilledMax: 0,
            amountOutUnfilledMax: 0,
            claimTick: ticks[params.claim],
            finalTick: ticks[params.zeroForOne ? params.lower : params.upper],
            earlyReturn: false,
            removeLower: true,
            removeUpper: true,
            deltas: ILimitPoolStructs.Deltas(0,0,0,0),
            finalDeltas: ILimitPoolStructs.Deltas(0,0,0,0)
        });

        params.amount = _convert(cache.position.liquidity, params.amount);

        // check claim is valid
        cache = Claims.validate(
            positions,
            tickMap,
            state,
            cache.pool,
            params,
            cache,
            constants
        );
        if (cache.earlyReturn) {
            return (cache, state);
        }
        // get deltas from claim tick
        cache = Claims.getDeltas(cache, params);

        return (cache, state);
    }

    function _checkpoint(
        ILimitPoolStructs.GlobalState memory state,
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.UpdateParams memory params,
        ILimitPoolStructs.Immutables memory constants,
        ILimitPoolStructs.UpdatePositionCache memory cache
    ) internal pure returns (
        ILimitPoolStructs.UpdatePositionCache memory,
        ILimitPoolStructs.UpdateParams memory
    ) {
        // update claimPriceLast
        cache.priceClaim = ConstantProduct.getPriceAtTick(params.claim, constants);
        cache.position.claimPriceLast = (params.claim == state.latestTick)
            ? pool.price
            : cache.priceClaim;
        /// @dev - if tick 0% filled, set CPL to latestTick
        if (pool.price == cache.priceSpread) cache.position.claimPriceLast = cache.priceClaim;
        /// @dev - if tick 100% filled, set CPL to next tick to unlock
        if (pool.price == cache.priceClaim && params.claim == state.latestTick){
            cache.position.claimPriceLast = cache.priceSpread;
            // set claim tick to claim + tickSpread
            params.claim = params.zeroForOne ? params.claim - constants.tickSpacing
                                             : params.claim + constants.tickSpacing;
        }
        return (cache, params);
    }
}
