// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.18;

import '../structs/RangePoolStructs.sol';

interface IRangePoolManager {
    function owner() external view returns (address);

    function feeTo() external view returns (address);

    function protocolFees(address pool) external view returns (uint16);

    function feeTiers(uint16 swapFee) external view returns (int24);
}
