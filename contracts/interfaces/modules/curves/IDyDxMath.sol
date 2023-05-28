// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import '../../../interfaces/ILimitPoolStructs.sol';
import '../../../base/structs/CurveMathStructs.sol';

interface IDyDxMath {
    function getDy(
        uint256 liquidity,
        uint256 priceLower,
        uint256 priceUpper,
        bool roundUp
    ) external pure returns (
        uint256 dy
    );

    function getDx(
        uint256 liquidity,
        uint256 priceLower,
        uint256 priceUpper,
        bool roundUp
    ) external pure returns (
        uint256 dx
    );

    function getLiquidityForAmounts(
        uint256 priceLower,
        uint256 priceUpper,
        uint256 currentPrice,
        uint256 dy,
        uint256 dx
    ) external pure returns (
        uint256 liquidity
    );

    function getAmountsForLiquidity(
        uint256 priceLower,
        uint256 priceUpper,
        uint256 price,
        uint256 liquidity,
        bool roundUp
    ) external pure returns (
        uint128 token0amount,
        uint128 token1amount
    );

    function getNewPrice(
        uint256 price,
        uint256 liquidity,
        uint256 input,
        bool zeroForOne
    ) external pure returns (
        uint256 newPrice
    );
}
