// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../../interfaces/structs/LimitPoolStructs.sol';
import '../LimitPositions.sol';
import '../../utils/Collect.sol';
import '../../utils/PositionTokens.sol';

library MintLimitCall {
    event MintLimit(
        address indexed to,
        int24 lower,
        int24 upper,
        bool zeroForOne,
        uint32 positionId,
        uint32 epochLast,
        uint128 amountIn,
        uint128 amountFilled,
        uint128 liquidityMinted
    );

    event SyncLimitPool(
        uint160 price,
        uint128 liquidity,
        uint32 epoch,
        int24 tickAtPrice,
        bool isPool0
    );

    function perform(
        mapping(uint256 => LimitPoolStructs.LimitPosition)
            storage positions,
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.GlobalState storage globalState,
        LimitPoolStructs.MintLimitParams memory params,
        LimitPoolStructs.MintLimitCache memory cache
    ) internal {
        if (params.positionId > 0) {
            if (PositionTokens.balanceOf(cache.constants, msg.sender, params.positionId) == 0)
                // check for balance held
                require(false, 'PositionNotFound()');
            cache.position = positions[params.positionId];
        }

        cache.state = globalState;

        // resize position if necessary
        (params, cache) = LimitPositions.resize(
            ticks,
            samples,
            rangeTickMap,
            limitTickMap,
            params,
            cache
        );

        // save state for reentrancy safety
        save(cache, globalState, !params.zeroForOne);

        // transfer in token amount
        SafeTransfers.transferIn(
                                 params.zeroForOne ? cache.constants.token0 
                                                   : cache.constants.token1,
                                 params.amount + cache.swapCache.input
                                );
        // transfer out if swap output 
        if (cache.swapCache.output > 0) {
            EchidnaAssertions.assertPoolBalanceExceeded(
                (params.zeroForOne ? balance(cache.constants.token1) : balance(cache.constants.token0)),
                cache.swapCache.output
            );
            SafeTransfers.transferOut(
                params.to,
                params.zeroForOne ? cache.constants.token1 
                                  : cache.constants.token0,
                cache.swapCache.output
            );
        }

        // mint position if amount is left
        if (params.amount > 0 && cache.liquidityMinted > 0 && params.lower < params.upper) {
            // check if new position created
            if (params.positionId == 0 ||                       // new position
                    params.lower != cache.position.lower ||     // lower mismatch
                    params.upper != cache.position.upper) {     // upper mismatch
                LimitPoolStructs.LimitPosition memory newPosition;
                newPosition.lower = params.lower;
                newPosition.upper = params.upper;
                // use new position in cache
                cache.position = newPosition;
                params.positionId = cache.state.positionIdNext;
                cache.state.positionIdNext += 1;
            }
            cache.pool = params.zeroForOne ? cache.state.pool0 : cache.state.pool1;
            // bump to the next tick if there is no liquidity
            if (cache.pool.liquidity == 0) {
                /// @dev - this makes sure to have liquidity unlocked if undercutting
                (cache, cache.pool) = LimitTicks.unlock(cache, cache.pool, ticks, limitTickMap, params.zeroForOne);
            }

            if (params.zeroForOne) {
                uint160 priceLower = ConstantProduct.getPriceAtTick(params.lower, cache.constants);
                if (priceLower <= cache.pool.price) {
                    // save liquidity if active
                    if (cache.pool.liquidity > 0) {
                        cache.pool = LimitTicks.insertSingle(params, ticks, limitTickMap, cache, cache.pool, cache.constants);
                    }
                    cache.pool.price = priceLower;
                    cache.pool.tickAtPrice = params.lower;
                    /// @auditor - double check liquidity is set correctly for this in insertSingle
                    cache.pool.liquidity += uint128(cache.liquidityMinted);
                    cache.position.crossedInto = true;
                    // set epoch on start tick to signify position being crossed into
                    /// @auditor - this is safe assuming we have swapped at least this far on the other side
                    emit SyncLimitPool(cache.pool.price, cache.pool.liquidity, cache.state.epoch, cache.pool.tickAtPrice, params.zeroForOne);
                }
            } else {
                uint160 priceUpper = ConstantProduct.getPriceAtTick(params.upper, cache.constants);
                if (priceUpper >= cache.pool.price) {
                    if (cache.pool.liquidity > 0) {
                        cache.pool = LimitTicks.insertSingle(params, ticks, limitTickMap, cache, cache.pool, cache.constants);
                    }
                    cache.pool.price = priceUpper;
                    cache.pool.tickAtPrice = params.upper;
                    cache.pool.liquidity += uint128(cache.liquidityMinted);
                    cache.position.crossedInto = true;
                    // set epoch on start tick to signify position being crossed into
                    /// @auditor - this is safe assuming we have swapped at least this far on the other side
                    emit SyncLimitPool(cache.pool.price, cache.pool.liquidity, cache.state.epoch, cache.pool.tickAtPrice, params.zeroForOne);
                }
            }
            (cache.pool, cache.position) = LimitPositions.add(
                cache,
                ticks,
                limitTickMap,
                params
            );

            // save position to storage
            positions[params.positionId] = cache.position;

            params.zeroForOne ? cache.state.pool0 = cache.pool : cache.state.pool1 = cache.pool;

            emit MintLimit(
                params.to,
                params.lower,
                params.upper,
                params.zeroForOne,
                params.positionId,
                cache.position.epochLast,
                uint128(params.amount + cache.swapCache.input),
                uint128(cache.swapCache.output),
                uint128(cache.liquidityMinted)
            );
        }

        // save lp side for safe reentrancy
        save(cache, globalState, params.zeroForOne);
    }

    function balance(
        address token
    ) private view returns (uint256) {
        (
            bool success,
            bytes memory data
        ) = token.staticcall(
                                    abi.encodeWithSelector(
                                        IERC20Minimal.balanceOf.selector,
                                        address(this)
                                    )
                                );
        require(success && data.length >= 32);
        return abi.decode(data, (uint256));
    }

    function save(
        LimitPoolStructs.MintLimitCache memory cache,
        PoolsharkStructs.GlobalState storage globalState,
        bool zeroForOne
    ) internal {
        globalState.epoch = cache.state.epoch;
        globalState.liquidityGlobal = cache.state.liquidityGlobal;
        globalState.positionIdNext = cache.state.positionIdNext;
        if (zeroForOne) {
            globalState.pool = cache.state.pool;
            globalState.pool0 = cache.state.pool0;
        } else {
            globalState.pool = cache.state.pool;
            globalState.pool1 = cache.state.pool1;
        }
    }
}
