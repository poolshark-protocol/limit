// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;

import './LimitPool.sol';
import './interfaces/ILimitPoolFactory.sol';
import './base/events/LimitPoolFactoryEvents.sol';
import './base/structs/LimitPoolFactoryStructs.sol';
import './utils/LimitPoolErrors.sol';

contract LimitPoolFactory is 
    ILimitPoolFactory,
    LimitPoolFactoryStructs,
    LimitPoolFactoryEvents,
    LimitPoolFactoryErrors
{
    address immutable public owner;

    constructor(
        address _owner
    ) {
        owner = _owner;
    }

    function createLimitPool(
        address tokenIn,
        address tokenOut,
        int16  tickSpacing
    ) external override returns (address pool) {
        LimitPoolParams memory params;
        // sort tokens by address
        params.token0 = tokenIn < tokenOut ? tokenIn : tokenOut;
        params.token1 = tokenIn < tokenOut ? tokenOut : tokenIn;
        // generate key for pool
        bytes32 key = keccak256(abi.encode(params.token0, params.token1, tickSpacing));
        if (limitPools[key] != address(0)) {
            revert PoolAlreadyExists();
        }
        // check if tick spacing supported
        params.owner = owner;
        if (!ILimitPoolManager(owner).tickSpacing(tickSpacing)) revert TickSpacingNotSupported();
        params.tickSpacing = tickSpacing;

        // launch pool and save address
        pool = address(new LimitPool(params));

        limitPools[key] = pool;

        emit PoolCreated(
            pool,
            params.token0,
            params.token1,
            tickSpacing
        );
    }

    function getLimitPool(
        address tokenIn,
        address tokenOut,
        int16 tickSpacing
    ) external view override returns (address) {
        // set lexographical token address ordering
        address token0 = tokenIn < tokenOut ? tokenIn : tokenOut;
        address token1 = tokenIn < tokenOut ? tokenOut : tokenIn;

        // get pool address from mapping
        bytes32 key = keccak256(abi.encode(token0, token1, tickSpacing));

        return limitPools[key];
    }
}
