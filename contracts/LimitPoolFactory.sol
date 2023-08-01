// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import './LimitPool.sol';
import './interfaces/ILimitPoolFactory.sol';
import './base/events/LimitPoolFactoryEvents.sol';
import './base/structs/PoolsharkStructs.sol';
import './utils/LimitPoolErrors.sol';
import './libraries/solady/LibClone.sol';
import './libraries/math/ConstantProduct.sol';

contract LimitPoolFactory is 
    ILimitPoolFactory,
    PoolsharkStructs,
    LimitPoolFactoryEvents,
    LimitPoolFactoryErrors
{
    using LibClone for address;

    address immutable public owner;
    address immutable public original;

    constructor(
        address owner_
    ) {
        owner = owner_;
        original = address(this);
    }

    function createLimitPool(
        bytes32 poolType,
        address tokenIn,
        address tokenOut,
        int16  tickSpacing,
        uint160 startPrice
    ) external override returns (address pool) {

        // validate token pair
        if (tokenIn == tokenOut || tokenIn == address(0) || tokenOut == address(0)) {
            revert InvalidTokenAddress();
        }

        // sort tokens by address
        Immutables memory constants;
        (constants.token0, constants.token1) = tokenIn < tokenOut ? (tokenIn,  tokenOut) 
                                                                  : (tokenOut, tokenIn);

        // check if tick spacing supported
        if (!ILimitPoolManager(owner).tickSpacings(tickSpacing)) revert TickSpacingNotSupported();

        // check if pool type supported
        address implementation = ILimitPoolManager(owner).implementations(poolType);
        if (implementation == address(0)) revert PoolTypeNotSupported();

        // generate key for pool
        bytes32 key = keccak256(abi.encode(
            implementation,
            constants.token0,
            constants.token1,
            tickSpacing
        ));

        // check if pool already exists
        if (limitPools[key] != address(0)) revert PoolAlreadyExists();

        // set immutables
        constants.owner = owner;
        constants.factory = original;
        constants.tickSpacing = tickSpacing;
        (
            constants.bounds.min,
            constants.bounds.max
        ) = ILimitPool(implementation).priceBounds(constants.tickSpacing);

        // launch pool
        pool = implementation.cloneDeterministic({
            salt: key,
            data: abi.encodePacked(
                constants.owner,
                constants.token0,
                constants.token1,
                constants.bounds.min,
                constants.bounds.max,
                constants.tickSpacing
            )
        });

        // initialize pool storage
        ILimitPool(pool).initialize(startPrice);

        // save pool in mapping
        limitPools[key] = pool;

        emit PoolCreated(
            pool,
            implementation,
            constants.token0,
            constants.token1,
            tickSpacing
        );
    }

    function getLimitPool(
        bytes32 poolType,
        address tokenIn,
        address tokenOut,
        int16 tickSpacing
    ) external view override returns (address) {
        // set lexographical token address ordering
        address token0 = tokenIn < tokenOut ? tokenIn : tokenOut;
        address token1 = tokenIn < tokenOut ? tokenOut : tokenIn;

        // check if tick spacing supported
        if (!ILimitPoolManager(owner).tickSpacings(tickSpacing)) revert TickSpacingNotSupported();

        // check if pool type supported
        address implementation = ILimitPoolManager(owner).implementations(poolType);
        if (implementation == address(0)) revert PoolTypeNotSupported();

        // generate key for pool
        bytes32 key = keccak256(abi.encode(
            implementation,
            token0,
            token1,
            tickSpacing
        ));

        return limitPools[key];
    }
}
