// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;
import '../base/storage/LimitPoolFactoryStorage.sol';

abstract contract ILimitPoolFactory is LimitPoolFactoryStorage {
    function createLimitPool(
        bytes32 poolType,
        address tokenIn,
        address tokenOut,
        int16  tickSpacing,
        uint160 startPrice
    ) external virtual returns (address pool);

    function getLimitPool(
        bytes32 poolType,
        address tokenIn,
        address tokenOut,
        int16  tickSpacing
    ) external view virtual returns (address);
}
