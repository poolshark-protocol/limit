// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import '../../interfaces/ILimitPoolStructs.sol';
import '../Epochs.sol';
import '../Positions.sol';
import '../utils/Collect.sol';

library SwapCall {
    event SwapPool0(
        address indexed recipient,
        uint128 amountIn,
        uint128 amountOut,
        uint160 priceLimit,
        uint160 newPrice
    );

    event SwapPool1(
        address indexed recipient,
        uint128 amountIn,
        uint128 amountOut,
        uint160 priceLimit,
        uint160 newPrice
    );

    function perform(
        ILimitPoolStructs.SwapParams memory params,
        ILimitPoolStructs.SwapCache memory cache
    ) external returns (ILimitPoolStructs.SwapCache memory) {
        SafeTransfers.transferIn(params.zeroForOne ? cache.constants.token0 : cache.constants.token1, params.amountIn);

        {
            ILimitPoolStructs.PoolState memory pool = params.zeroForOne ? cache.pool1 : cache.pool0;
            cache = ILimitPoolStructs.SwapCache({
                state: cache.state,
                syncFees: cache.syncFees,
                constants: cache.constants,
                pool0: cache.pool0,
                pool1: cache.pool1,
                price: pool.price,
                liquidity: pool.liquidity,
                amountIn: params.amountIn,
                auctionDepth: block.timestamp - cache.constants.genesisTime - cache.state.auctionStart,
                auctionBoost: 0,
                input: params.amountIn,
                output: 0,
                inputBoosted: 0,
                amountInDelta: 0
            });
        }
        /// @dev - liquidity range is limited to one tick
        cache = Ticks.quote(params.zeroForOne, params.priceLimit, cache.state, cache, cache.constants);

        if (params.zeroForOne) {
            cache.pool1.price = uint160(cache.price);
            cache.pool1.amountInDelta += uint128(cache.amountInDelta);
        } else {
            cache.pool0.price = uint160(cache.price);
            cache.pool0.amountInDelta += uint128(cache.amountInDelta);
        }

        if (params.zeroForOne) {
            if (cache.input + cache.syncFees.token0 > 0) {
                SafeTransfers.transferOut(params.refundTo, cache.constants.token0, cache.input + cache.syncFees.token0);
            }
            if (cache.output + cache.syncFees.token1 > 0) {
                SafeTransfers.transferOut(params.to, cache.constants.token1, cache.output + cache.syncFees.token1);
                emit SwapPool1(params.to, uint128(params.amountIn - cache.input), uint128(cache.output), uint160(cache.price), params.priceLimit);
            }
        } else {
            if (cache.input + cache.syncFees.token1 > 0) {
                SafeTransfers.transferOut(params.refundTo, cache.constants.token1, cache.input + cache.syncFees.token1);
            }
            if (cache.output + cache.syncFees.token0 > 0) {
                SafeTransfers.transferOut(params.to, cache.constants.token0, cache.output + cache.syncFees.token0);
                emit SwapPool0(params.to, uint128(params.amountIn - cache.input), uint128(cache.output), uint160(cache.price), params.priceLimit);
            }
        }
        return cache;
    }
}
