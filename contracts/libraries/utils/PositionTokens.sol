// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import './Bytes.sol';
import './String.sol';
import "../math/OverflowMath.sol";
import '../../interfaces/IPositionERC1155.sol';
import "../../interfaces/range/IRangePoolFactory.sol";
import "../../interfaces/structs/RangePoolStructs.sol";
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

/// @notice Token library for ERC-1155 calls.
library PositionTokens {
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    function balanceOf(
        PoolsharkStructs.LimitImmutables memory constants,
        address owner,
        uint32 positionId
    ) internal view returns (
        uint256
    )
    {
        return IPositionERC1155(constants.poolToken).balanceOf(owner, positionId);
    }

    function name(address token0, address token1) internal view returns (bytes32 result) {
        string memory nameString = string.concat(
            'Poolshark Limit ',
            ERC20(token0).symbol(), '-',
            ERC20(token1).symbol(), ' LP'
        );

        result = Bytes.from(nameString);
    }

    function symbol(address token0, address token1) internal view returns (bytes32 result) {
        string memory symbolString = string.concat(
            'PSHARK-L-',
            ERC20(token0).symbol(), '-',
            ERC20(token1).symbol(), '-LP'
        );

        result = Bytes.from(symbolString);
    }

    function swapFeeString(uint16 swapFee) internal pure returns (string memory) {
        if (swapFee == 10000) {
            // 10000 = 1.0%
            return string.concat('1.0%');
        } else if (swapFee >= 1000 && (swapFee % 1000 == 0)) {
            // 1000 = 0.1%
            return string.concat('0.', String.from(swapFee / 1000), '%');
        } else if (swapFee >= 100 && (swapFee % 100 == 0)) {
            if (swapFee < 1000)
                // 500 = 0.05%  
                return string.concat('0.0', String.from(swapFee / 100), '%');
            else
                // 1500 = 0.15%
                return string.concat('0.', String.from(swapFee / 100), '%');
        } else if (swapFee >= 10 && (swapFee % 10 == 0)) {
            if (swapFee < 100)
                // 50 = 0.005%
                return string.concat('0.00', String.from(swapFee / 10), '%');
            else if (swapFee < 1000)
                // 150 = 0.015%
                return string.concat('0.0', String.from(swapFee / 10), '%');
            else
                // 1550 = 0.155%
                return string.concat('0.', String.from(swapFee / 10), '%');
        }
        else {
            if (swapFee < 10)
                // 5 = 0.0005%
                return string.concat('0.000', String.from(swapFee), '%'); 
            if (swapFee < 100)
                // 55 = 0.0055%
                return string.concat('0.00', String.from(swapFee), '%');
            else if (swapFee < 1000)
                // 555 = 0.0555%
                return string.concat('0.0', String.from(swapFee), '%');
            else
                // 5555 = 0.5555%
                return string.concat('0.', String.from(swapFee), '%');
        }
    }
}