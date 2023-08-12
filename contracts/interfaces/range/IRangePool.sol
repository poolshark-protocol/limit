// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.13;

import './IRangePoolStructs.sol';
import './IRangePoolManager.sol';

interface IRangePool is IRangePoolStructs {
    function mint(
        MintParams memory mintParams
    ) external;

    function burn(
        BurnParams memory burnParams
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
        uint160 priceAfter
    );

    function increaseSampleLength(
        uint16 sampleLengthNext
    ) external;
}
