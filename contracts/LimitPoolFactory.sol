// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import './LimitPool.sol';
import './LimitPoolClone.sol';
import './interfaces/ILimitPoolFactory.sol';
import './base/events/LimitPoolFactoryEvents.sol';
import './base/structs/LimitPoolFactoryStructs.sol';
import './utils/LimitPoolErrors.sol';
import './libraries/solady/LibClone.sol';
import './libraries/math/ConstantProduct.sol';

contract LimitPoolFactory is 
    ILimitPoolFactory,
    LimitPoolFactoryStructs,
    LimitPoolFactoryEvents,
    LimitPoolFactoryErrors
{
    using LibClone for address;

    address immutable public owner;
    LimitPool public implementation;

    constructor(
        address owner_,
        LimitPool implementation_
    ) {
        owner = owner_;
        implementation = implementation_;
    }

    function createLimitPool(
        address tokenIn,
        address tokenOut,
        int16  tickSpacing,
        uint160 startPrice
    ) external override returns (address pool) {
        LimitPoolParams memory params;
        // validate token pair
        if (tokenIn == tokenOut || tokenIn == address(0) || tokenOut == address(0)) {
            revert InvalidTokenAddress();
        }
        // sort tokens by address
        (params.token0, params.token1) = tokenIn < tokenOut ? (tokenIn, tokenOut) : (tokenOut, tokenIn);
        // generate key for pool
        bytes32 key = keccak256(abi.encode(params.token0, params.token1, tickSpacing));
        if (limitPools[key] != address(0)) {
            revert PoolAlreadyExists();
        }
        // check if tick spacing supported
        params.owner = owner;
        if (!ILimitPoolManager(owner).tickSpacings(tickSpacing)) revert TickSpacingNotSupported();
        params.tickSpacing = tickSpacing;
        params.startPrice = startPrice;
        params.minPrice = ConstantProduct.minPrice(params.tickSpacing);
        params.maxPrice = ConstantProduct.maxPrice(params.tickSpacing);

        // generate salt
        bytes32 salt = keccak256(abi.encodePacked(tokenIn, tokenOut, tickSpacing));
        
        // launch pool
        pool = address(implementation).cloneDeterministic({
            salt: salt,
            data: abi.encodePacked(
                params.owner,
                params.token0,
                params.token1,
                params.minPrice,
                params.maxPrice,
                params.tickSpacing
            )
        });

        // initialize pool storage
        ILimitPool(pool).initialize(params);

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
