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
        SnapshotLimitParams memory params
    ) external view returns (
        LimitPosition memory
    );

    function fees(
        uint16 protocolFee0,
        uint16 protocolFee1,
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