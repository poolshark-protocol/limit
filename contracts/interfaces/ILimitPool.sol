// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

import './ILimitPoolStructs.sol';
import '../base/structs/LimitPoolFactoryStructs.sol';

interface ILimitPool is ILimitPoolStructs {
    function initialize(
        uint160 startPrice
    ) external;

    function mint(
        MintParams memory params
    ) external;

    function burn(
        BurnParams memory params
    ) external;

    function swap(
        SwapParams memory params
    ) external returns (
        int256 amount0,
        int256 amount1
    );

    function quote(
        QuoteParams memory params
    ) external view returns (
        uint256 inAmount,
        uint256 outAmount,
        uint256 priceAfter
    );

    function snapshot(
        SnapshotParams memory params
    ) external view returns (
        Position memory
    );

    function fees(
        uint16 syncFee,
        uint16 fillFee,
        bool setFees
    ) external returns (
        uint128 token0Fees,
        uint128 token1Fees
    );

    function priceBounds(
        int16 tickSpacing
    ) external pure returns (
        uint160 minPrice,
        uint160 maxPrice
    );
}
