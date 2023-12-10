// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import '../../../interfaces/structs/LimitPoolStructs.sol';
import '../../../interfaces/callbacks/ILimitPoolCallback.sol';
import '../../../interfaces/IERC20Minimal.sol';
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
        PoolsharkStructs.MintLimitParams memory params,
        LimitPoolStructs.MintLimitCache memory cache
    ) external {
        // check for invalid receiver
        if (params.to == address(0))
            require(false, "CollectToZeroAddress()");

        cache.state = globalState;

        // validate position ticks
        ConstantProduct.checkTicks(params.lower, params.upper, cache.constants.tickSpacing);

        if (params.positionId > 0) {
            cache.position = positions[params.positionId];
            if (cache.position.liquidity == 0) {
                // position doesn't exist
                require(false, 'PositionNotFound()');
            }
            if (PositionTokens.balanceOf(cache.constants, params.to, params.positionId) == 0)
                require(false, 'PositionOwnerMismatch()');
        }

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

        // transfer out if swap output 
        if (cache.swapCache.output > 0)
            SafeTransfers.transferOut(
                params.to,
                params.zeroForOne ? cache.constants.token1 
                                  : cache.constants.token0,
                cache.swapCache.output
            );
        // mint position if amount is left
        if (params.amount > 0 && params.lower < params.upper) {
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
                uint128(params.amount),
                uint128(cache.liquidityMinted)
            );
        }
        // save lp side for safe reentrancy
        save(cache, globalState, params.zeroForOne);

        // check balance and execute callback
        uint256 balanceStart = balance(params, cache);
        ILimitPoolMintLimitCallback(msg.sender).limitPoolMintLimitCallback(
            params.zeroForOne ? -int256(params.amount + cache.swapCache.input) : int256(cache.swapCache.output),
            params.zeroForOne ? int256(cache.swapCache.output) : -int256(params.amount + cache.swapCache.input),
            params.callbackData
        );

        // check balance requirements after callback
        if (balance(params, cache) < balanceStart + params.amount + cache.swapCache.input)
            require(false, 'MintInputAmountTooLow()');
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

    
    function balance(
        PoolsharkStructs.MintLimitParams memory params,
        LimitPoolStructs.MintLimitCache memory cache
    ) private view returns (uint256) {
        (
            bool success,
            bytes memory data
        ) = (params.zeroForOne ? cache.constants.token0
                               : cache.constants.token1)
                               .staticcall(
                                    abi.encodeWithSelector(
                                        IERC20Minimal.balanceOf.selector,
                                        address(this)
                                    )
                                );
        require(success && data.length >= 32);
        return abi.decode(data, (uint256));
    }
}
