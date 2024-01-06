// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.18;

interface IRangePoolFactory {
    function createRangePool(
        address fromToken,
        address destToken,
        uint16 fee,
        uint160 startPrice
    ) external returns (address book);

    function getRangePool(
        address fromToken,
        address destToken,
        uint256 fee
    ) external view returns (address);

    function owner() external view returns (address);
}
