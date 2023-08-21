// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

import './ILimitPoolStructs.sol';
import '../../base/structs/LimitPoolFactoryStructs.sol';

interface ILimitPool is ILimitPoolStructs {
    function initialize(
        uint160 startPrice
    ) external;

    function mintLimit(
        MintLimitParams memory params
    ) external;

    function burnLimit(
        BurnLimitParams memory params
    ) external;

    function snapshotLimit(
        BurnLimitParams memory params
    ) external view returns(
        uint128,
        uint128
    );

    function fees(
        FeesParams memory params
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
