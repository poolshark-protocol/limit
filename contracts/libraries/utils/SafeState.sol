// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../interfaces/limit/ILimitPoolStructs.sol';
import '../../interfaces/IERC20Minimal.sol';

library SafeState {
    function saveLimit(
        PoolsharkStructs.LimitPoolState memory pool,
        PoolsharkStructs.GlobalState storage globalState,
        uint32 epoch,
        bool isPool0
    ) internal {
        if (isPool0) {
            globalState.pool0 = pool;
        } else {
            globalState.pool1 = pool;
        }
        // save epoch
        globalState.epoch = epoch;
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
