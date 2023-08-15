// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import './LimitPool.sol';
import './interfaces/limit/ILimitPoolFactory.sol';
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
        uint16  swapFee,
        uint160 startPrice
    ) external override returns (
        address pool,
        address poolToken
    ) {

        // validate token pair
        if (tokenIn == tokenOut || tokenIn == address(0) || tokenOut == address(0)) {
            revert InvalidTokenAddress();
        }

        // sort tokens by address
        Immutables memory constants;
        (constants.token0, constants.token1) = tokenIn < tokenOut ? (tokenIn,  tokenOut) 
                                                                  : (tokenOut, tokenIn);

        // check if tick spacing supported
        constants.swapFee = swapFee;
        constants.tickSpacing = ILimitPoolManager(owner).feeTiers(swapFee);
        if (constants.tickSpacing == 0) revert FeeTierNotSupported();

        // check if pool type supported
        (
            address poolImpl,
            address tokenImpl
         ) = ILimitPoolManager(owner).implementations(poolType);
        if (poolImpl == address(0) || tokenImpl == address(0)) revert PoolTypeNotSupported();

        // generate key for pool
        bytes32 key = keccak256(abi.encode(
            poolImpl,
            constants.token0,
            constants.token1,
            constants.swapFee
        ));

        // check if pool already exists
        if (limitPools[key] != address(0)) revert PoolAlreadyExists();

        // set immutables
        constants.owner = owner;
        constants.factory = original;
        constants.genesisTime = uint32(block.timestamp);
        (
            constants.bounds.min,
            constants.bounds.max
        ) = ILimitPool(poolImpl).priceBounds(constants.tickSpacing);

        // calculate token address

        // pass this address into a clone of RangePoolERC1155

        // take that ERC1155 contract address and pass that into pool
        // launch pool token
        constants.poolToken = tokenImpl.cloneDeterministic({
            salt: key,
            data: abi.encodePacked(
                poolImpl
            )
        });

        // launch pool
        pool = poolImpl.cloneDeterministic({
            salt: key,
            data: abi.encodePacked(
                constants.owner,
                constants.token0,
                constants.token1,
                constants.poolToken,
                constants.bounds.min,
                constants.bounds.max,
                constants.genesisTime,
                constants.tickSpacing,
                constants.swapFee
            )
        });

        // initialize pool storage
        ILimitPool(pool).initialize(startPrice);

        // save pool in mapping
        limitPools[key] = pool;

        emit PoolCreated(
            pool,
            poolToken,
            poolImpl,
            tokenImpl,
            constants.token0,
            constants.token1,
            constants.swapFee,
            constants.tickSpacing
        );

        return (pool, constants.poolToken);
    }

    function getLimitPool(
        bytes32 poolType,
        address tokenIn,
        address tokenOut,
        uint16 swapFee
    ) external view override returns (
        address pool,
        address poolToken
    ) {
        // set lexographical token address ordering
        address token0 = tokenIn < tokenOut ? tokenIn : tokenOut;
        address token1 = tokenIn < tokenOut ? tokenOut : tokenIn;

        // check if tick spacing supported
        int16 tickSpacing = ILimitPoolManager(owner).feeTiers(swapFee);
        if (tickSpacing == 0) revert FeeTierNotSupported();

        // check if pool type supported
        (
            address poolImpl,
            address tokenImpl
         ) = ILimitPoolManager(owner).implementations(poolType);
        if (poolImpl == address(0) || tokenImpl == address(0)) revert PoolTypeNotSupported();

        // generate key for pool
        bytes32 key = keccak256(abi.encode(
            poolImpl,
            token0,
            token1,
            swapFee
        ));

        pool = limitPools[key];

        poolToken = LibClone.predictDeterministicAddress(
            tokenImpl,
            abi.encodePacked(
                poolImpl
            ),
            key,
            address(this)
        );

        return (pool, poolToken);
    }
}
