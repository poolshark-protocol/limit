// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../interfaces/limit/ILimitPoolStructs.sol';
import '../../interfaces/IERC20Minimal.sol';

library Checks {
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
        PoolsharkStructs.SwapParams memory params,
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
