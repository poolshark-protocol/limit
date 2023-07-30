// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../interfaces/ILimitPoolStructs.sol';
import '../../interfaces/callbacks/IPoolsharkSwapCallback.sol';
import '../../interfaces/IERC20Minimal.sol';
import '../Positions.sol';
import '../Ticks.sol';
import '../utils/Collect.sol';
import '../utils/SafeTransfers.sol';

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
        ILimitPoolStructs.SwapCache memory cache,
        ILimitPoolStructs.TickMap storage tickMap,
        ILimitPoolStructs.PoolState storage poolState,
        mapping(int24 => ILimitPoolStructs.Tick) storage ticks
    ) internal returns (
        int256,
        int256
    ) {
        (cache.pool, cache) = Ticks.swap(
            ticks,
            tickMap,
            params,
            cache,
            cache.pool
        );
        save(cache.pool, poolState);
        // transfer output amount
        SafeTransfers.transferOut(
            params.to, 
            params.zeroForOne ? cache.constants.token1
                              : cache.constants.token0,
            cache.output
        );

        // check balance and execute callback
        uint256 balanceStart = balance(params, cache);
        IPoolsharkSwapCallback(msg.sender).poolsharkSwapCallback(
            params.zeroForOne ? -int256(cache.input) : int256(cache.output),
            params.zeroForOne ? int256(cache.output) : -int256(cache.input),
            params.callbackData
        );

        // check balance requirements after callback
        if (balance(params, cache) < balanceStart + cache.input)
            require(false, 'SwapInputAmountTooLow()');

        return (
            params.zeroForOne ? 
                (
                    -int256(cache.input),
                     int256(cache.output)
                )
              : (
                     int256(cache.output),
                    -int256(cache.input)
                )
        );
    }

    function save(
        ILimitPoolStructs.PoolState memory pool,
        ILimitPoolStructs.PoolState storage poolState
    ) internal {
        poolState.price = pool.price;
        poolState.liquidity = pool.liquidity;
        poolState.liquidityGlobal = pool.liquidityGlobal;
        poolState.swapEpoch = pool.swapEpoch;
        poolState.tickAtPrice = pool.tickAtPrice;
    }

    function balance(
        ILimitPoolStructs.SwapParams memory params,
        ILimitPoolStructs.SwapCache memory cache
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
