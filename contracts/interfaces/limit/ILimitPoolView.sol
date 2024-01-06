// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.18;

import '../structs/LimitPoolStructs.sol';

interface ILimitPoolView is LimitPoolStructs {
    function snapshotLimit(SnapshotLimitParams memory params)
        external
        view
        returns (uint128, uint128);

    function immutables() external view returns (LimitImmutables memory);

    function priceBounds(int16 tickSpacing)
        external
        pure
        returns (uint160 minPrice, uint160 maxPrice);

    function sample(uint32[] memory secondsAgo)
        external
        view
        returns (
            int56[] memory tickSecondsAccum,
            uint160[] memory secondsPerLiquidityAccum,
            uint160 averagePrice,
            uint128 averageLiquidity,
            int24 averageTick
        );
}
