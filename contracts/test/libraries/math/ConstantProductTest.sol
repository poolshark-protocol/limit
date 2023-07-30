// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../../libraries/math/ConstantProduct.sol';

contract ConstantProductTest {

    function getDy(
        uint256 liquidity,
        uint256 priceLower,
        uint256 priceUpper,
        bool roundUp
    ) external pure returns (uint256 dy) {
        return ConstantProduct.getDy(liquidity, priceLower, priceUpper, roundUp);
    }

    function getDx(
        uint256 liquidity,
        uint256 priceLower,
        uint256 priceUpper,
        bool roundUp
    ) external pure returns (uint256 dy) {
        return ConstantProduct.getDx(liquidity, priceLower, priceUpper, roundUp);
    }

    function getLiquidityForAmounts(
        uint256 priceLower,
        uint256 priceUpper,
        uint256 currentPrice,
        uint256 dy,
        uint256 dx
    ) external pure returns (uint256 liquidity) {
        return ConstantProduct.getLiquidityForAmounts(priceLower, priceUpper, currentPrice, dy, dx);
    }

    function getAmountsForLiquidity(
        uint256 priceLower,
        uint256 priceUpper,
        uint256 currentPrice,
        uint256 liquidityAmount,
        bool roundUp
    ) external pure returns (uint128 token0amount, uint128 token1amount) {
        return ConstantProduct.getAmountsForLiquidity(priceLower, priceUpper, currentPrice, liquidityAmount, roundUp);
    }

    function getNewPrice(
        uint256 price,
        uint256 liquidity,
        uint256 amount,
        bool zeroForOne,
        bool exactIn
    ) external pure returns (
        uint256 newPrice
    ) {
        return ConstantProduct.getNewPrice(price, liquidity, amount, zeroForOne, exactIn);
    }

    function minTick(
        int16 tickSpacing
    ) external pure returns (
        int24 tick
    ) {
        return ConstantProduct.minTick(tickSpacing);
    }

    function maxTick(
        int16 tickSpacing
    ) external pure returns (
        int24 tick
    ) {
        return ConstantProduct.maxTick(tickSpacing);
    }

    function priceBounds(
        int16 tickSpacing
    ) external pure returns (
        uint160,
        uint160
    ) {
        return ConstantProduct.priceBounds(tickSpacing);
    }

    function minPrice(
        int16 tickSpacing
    ) external pure returns (
        uint160 price
    ) {
        return ConstantProduct.minPrice(tickSpacing);
    }

    function maxPrice(
        int16 tickSpacing
    ) external pure returns (
        uint160 price
    ) {
        return ConstantProduct.maxPrice(tickSpacing);
    }

    function checkTicks(
        int24 lower,
        int24 upper,
        int16 tickSpacing
    ) external pure
    {
        ConstantProduct.checkTicks(lower, upper, tickSpacing);
    }

    function getPriceAtTick(
        int24 tick,
        int16 tickSpacing
    ) external pure returns (
        uint160 price
    ) {
        ILimitPoolStructs.Immutables memory constants;
        constants.tickSpacing = tickSpacing;
        return ConstantProduct.getPriceAtTick(tick, constants);
    }

    function getTickAtPrice(
        uint160 price,
        int16 tickSpacing
    ) external pure returns (int24 tick) {
        ILimitPoolStructs.Immutables memory constants;
        constants.tickSpacing = tickSpacing;
        return ConstantProduct.getTickAtPrice(price, constants);
    }
}