// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import './interfaces/range/IRangePool.sol';
import './interfaces/limit/ILimitPool.sol';
import './interfaces/structs/LimitPoolStructs.sol';
import './interfaces/structs/RangePoolStructs.sol';
import './interfaces/limit/ILimitPoolFactory.sol';
import './interfaces/limit/ILimitPoolManager.sol';
import './base/events/LimitPoolFactoryEvents.sol';
import './utils/LimitPoolErrors.sol';
import './external/solady/LibClone.sol';
import './libraries/utils/SafeCast.sol';
import './libraries/math/ConstantProduct.sol';

contract LimitPoolFactory is 
    ILimitPoolFactory,
    LimitPoolStructs,
    RangePoolStructs,
    LimitPoolFactoryEvents,
    LimitPoolFactoryErrors
{
    using LibClone for address;
    using SafeCast for uint256;

    address immutable public owner;
    address immutable public original;

    constructor(
        address owner_
    ) {
        owner = owner_;
        original = address(this);
    }

    function createLimitPool(
        LimitPoolParams memory params
    ) public override returns (
        address pool,
        address poolToken
    ) {

        // validate token pair
        if (params.tokenIn == params.tokenOut || params.tokenIn == address(0) || params.tokenOut == address(0)) {
            revert InvalidTokenAddress();
        }

        // sort tokens by address
        LimitImmutables memory constants;
        (constants.token0, constants.token1) = params.tokenIn < params.tokenOut ? (params.tokenIn,  params.tokenOut) 
                                                                                : (params.tokenOut, params.tokenIn);

        // check if tick spacing supported
        constants.swapFee = params.swapFee;
        constants.tickSpacing = ILimitPoolManager(owner).feeTiers(params.swapFee);
        if (constants.tickSpacing == 0) revert FeeTierNotSupported();

        // check if pool type supported
        (
            address poolImpl,
            address tokenImpl
         ) = ILimitPoolManager(owner).implementations(params.poolType);
        if (poolImpl == address(0) || tokenImpl == address(0)) revert PoolTypeNotSupported();

        // generate key for pool
        bytes32 key = keccak256(abi.encode(
            poolImpl,
            constants.token0,
            constants.token1,
            constants.swapFee
        ));

        // check if pool already exists
        if (pools[key] != address(0)) revert PoolAlreadyExists();

        // set immutables
        constants.owner = owner;
        constants.factory = original;
        constants.genesisTime = block.timestamp.toUint32();
        (
            constants.bounds.min,
            constants.bounds.max
        ) = ILimitPool(poolImpl).priceBounds(constants.tickSpacing);

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
        ILimitPool(pool).initialize(params.startPrice);

        // save pool in mapping
        pools[key] = pool;

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

    function createLimitPoolAndMint(
        LimitPoolParams memory params,
        MintRangeParams[] memory mintRangeParams,
        MintLimitParams[] memory mintLimitParams
    ) external returns (
        address pool,
        address poolToken
    ) {
        // check if pool exists
        (
            pool,
            poolToken
        ) = getLimitPool(
            params.poolType,
            params.tokenIn,
            params.tokenOut,
            params.swapFee
        );
        // create if pool doesn't exist
        if (pool == address(0)) {
            (
                pool,
                poolToken
            ) = createLimitPool(
                params
            );
        }
        // mint initial range positions
        for (uint i = 0; i < mintRangeParams.length;) {
            IRangePool(pool).mintRange(mintRangeParams[i]);
            unchecked {
                ++i;
            }
        }
        // mint initial limit positions
        for (uint i = 0; i < mintLimitParams.length;) {
            ILimitPool(pool).mintLimit(mintLimitParams[i]);
            unchecked {
                ++i;
            }
        }
    } 

    function getLimitPool(
        bytes32 poolType,
        address tokenIn,
        address tokenOut,
        uint16 swapFee
    ) public view override returns (
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

        pool = pools[key];

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
