// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;
import '../base/storage/LimitPoolFactoryStorage.sol';

abstract contract ILimitPoolFactory is LimitPoolFactoryStorage {
    function createLimitPool(
        bytes32 sourceName,
        address tokenIn,
        address tokenOut,
        uint16 fee,
        int16  tickSpread,
        uint16 twapLength
    ) external virtual returns (address book);

    function getLimitPool(
        bytes32 sourceName,
        address tokenIn,
        address tokenOut,
        uint16 fee,
        int16 tickSpread,
        uint16 twapLength
    ) external view virtual returns (address);
}
