// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import "../../math/OverflowMath.sol";
import "../../../interfaces/range/IRangePoolStructs.sol";

/// @notice Math library that facilitates fee handling.
library FeeMath {
    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    function calculate(
        IRangePoolStructs.PoolState memory pool,
        IRangePoolStructs.SwapCache memory cache,
        uint256 amountOut,
        bool zeroForOne
    ) internal pure returns (
        IRangePoolStructs.PoolState memory,
        IRangePoolStructs.SwapCache memory
    )
    {
        if (cache.liquidity == 0 ) return (pool, cache);
        uint256 feeAmount = OverflowMath.mulDivRoundingUp(amountOut, cache.constants.swapFee, 1e6); 
        uint256 protocolFee = OverflowMath.mulDivRoundingUp(feeAmount, cache.protocolFee, 1e6);
        amountOut -= feeAmount;
        feeAmount -= protocolFee;

        if (zeroForOne) {
           pool.protocolFees.token1 += uint128(protocolFee);
           pool.feeGrowthGlobal1 += uint200(OverflowMath.mulDiv(feeAmount, Q128, cache.liquidity));
        } else {
          pool.protocolFees.token0 += uint128(protocolFee);
          pool.feeGrowthGlobal0 += uint200(OverflowMath.mulDiv(feeAmount, Q128, cache.liquidity));
        }
        cache.output += amountOut;
        return (pool, cache);
    }
}