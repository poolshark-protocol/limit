// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.21;

import '../../interfaces/structs/LimitPoolStructs.sol';
import '../Ticks.sol';

library QuoteCall {
    uint8 private constant _ENTERED = 2;

    event Event();

    function perform(
        mapping(int24 => LimitPoolStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage rangeTickMap,
        PoolsharkStructs.TickMap storage limitTickMap,
        PoolsharkStructs.GlobalState storage globalState,
        PoolsharkStructs.QuoteParams memory params,
        PoolsharkStructs.SwapCache memory cache
    )
        external
        view
        returns (
            uint256,
            uint256,
            uint160
        )
    {
        if (cache.state.unlocked == _ENTERED)
            require(false, 'ReentrancyGuardReadOnlyReentrantCall()');
        cache.state = globalState;
        return Ticks.quote(ticks, rangeTickMap, limitTickMap, params, cache);
    }
}
