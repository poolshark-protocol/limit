// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

abstract contract ICoverPoolFactory {
    struct CoverPoolParams {
        bytes32 poolType;
        address tokenIn;
        address tokenOut;
        uint16 feeTier;
        int16 tickSpread;
        uint16 twapLength;
    }

    /**
     * @notice Creates a new CoverPool.
     * @param params The CoverPoolParams struct referenced above.
     */
    function createCoverPool(CoverPoolParams memory params)
        external
        virtual
        returns (address pool, address poolToken);

    /**
     * @notice Fetches an existing CoverPool.
     * @param params The CoverPoolParams struct referenced above.
     */
    function getCoverPool(CoverPoolParams memory params)
        external
        view
        virtual
        returns (address pool, address poolToken);
}
