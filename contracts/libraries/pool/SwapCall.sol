// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../interfaces/structs/LimitPoolStructs.sol';
import '../../interfaces/callbacks/ILimitPoolCallback.sol';
import '../../interfaces/IERC20Minimal.sol';
import '../Ticks.sol';
import '../utils/Collect.sol';
import '../utils/SafeTransfers.sol';

library SwapCall {
    event Swap(
        address indexed recipient,
        bool zeroForOne,
        uint256 amountIn,
        uint256 amountOut,
        uint160 price,
        uint128 liquidity,
        uint128 feeAmount,
        int24 tickAtPrice
    );

    function perform(
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.GlobalState storage globalState,
        PoolsharkStructs.SwapParams memory params,
        PoolsharkStructs.SwapCache memory cache
    ) external returns (
        int256,
        int256
    ) {
        cache.state = globalState;
        cache = Ticks.swap(
            ticks,
            samples,
            rangeTickMap,
            limitTickMap,
            params,
            cache
        );
        // save state for reentrancy protection
        save(cache, globalState, params.zeroForOne);

        // transfer output amount
        SafeTransfers.transferOut(
            params.to, 
            params.zeroForOne ? cache.constants.token1
                              : cache.constants.token0,
            cache.output
        );

        // check balance and execute callback
        uint256 balanceStart = balance(params, cache);
        ILimitPoolSwapCallback(msg.sender).limitPoolSwapCallback(
            params.zeroForOne ? -int256(cache.input) : int256(cache.output),
            params.zeroForOne ? int256(cache.output) : -int256(cache.input),
            params.callbackData
        );

        // check balance requirements after callback
        if (balance(params, cache) < balanceStart + cache.input) {
           require(false, 'SwapInputAmountTooLow()');
        }

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
        PoolsharkStructs.SwapCache memory cache,
        PoolsharkStructs.GlobalState storage globalState,
        bool zeroForOne
    ) internal {
        globalState.epoch = cache.state.epoch;
        globalState.pool = cache.state.pool;
        if (zeroForOne)
            globalState.pool1 = cache.state.pool1;
        else
            globalState.pool0 = cache.state.pool0;
    }

    function balance(
        PoolsharkStructs.SwapParams memory params,
        PoolsharkStructs.SwapCache memory cache
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
