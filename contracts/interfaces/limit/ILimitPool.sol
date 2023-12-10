// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

import '../structs/LimitPoolStructs.sol';

interface ILimitPool is LimitPoolStructs {
    function initialize(
        uint160 startPrice
    ) external;

    function mintLimit(
        MintLimitParams memory params
    ) external returns (
        int256,
        int256
    );

    function burnLimit(
        BurnLimitParams memory params
    ) external returns (
        int256,
        int256
    );

    function fees(
        FeesParams memory params
    ) external returns (
        uint128 token0Fees,
        uint128 token1Fees
    );
}
