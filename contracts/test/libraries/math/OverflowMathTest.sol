// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import '../../../libraries/math/OverflowMath.sol';

contract OverflowMathTest {

    function divRoundingUp(
        uint256 x,
        uint256 y
    ) external pure returns (
        uint256
    ) {
        return OverflowMath.divRoundingUp(x,y);
    }

    function mulDiv(
        uint256 a,
        uint256 b,
        uint256 denominator
    ) external pure returns (
        uint256 result
    ) {
        return OverflowMath.mulDiv(a, b, denominator);
    }

    function mulDivRoundingUp(
        uint256 a,
        uint256 b,
        uint256 denominator
    ) external pure returns (
        uint256 result
    ){
        return OverflowMath.mulDivRoundingUp(a, b, denominator);
    }
}