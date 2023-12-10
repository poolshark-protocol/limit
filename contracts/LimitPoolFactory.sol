// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.18;

import './interfaces/range/IRangePool.sol';
import './interfaces/limit/ILimitPool.sol';
import './interfaces/limit/ILimitPoolView.sol';
import './interfaces/structs/LimitPoolStructs.sol';
import './interfaces/structs/RangePoolStructs.sol';
import './interfaces/limit/ILimitPoolFactory.sol';
import './interfaces/limit/ILimitPoolManager.sol';
import './base/events/LimitPoolFactoryEvents.sol';
import './external/solady/LibClone.sol';
import './libraries/utils/SafeCast.sol';
import './libraries/utils/PositionTokens.sol';
import './libraries/math/ConstantProduct.sol';

contract LimitPoolFactory is
    ILimitPoolFactory,
    LimitPoolStructs,
    RangePoolStructs,
    LimitPoolFactoryEvents
{
    using LibClone for address;
    using SafeCast for uint256;

    address public immutable owner;
    address public immutable original;

    constructor(address owner_) {
        owner = owner_;
        original = address(this);
    }

    modifier originalOnly() {
        _onlyOriginal();
        _;
    }

    function createLimitPool(LimitPoolParams memory params)
        public
        override
        originalOnly
        returns (address pool, address poolToken)
    {
        // validate token pair
        if (
            params.tokenIn == params.tokenOut ||
            params.tokenIn == address(0) ||
            params.tokenOut == address(0)
        ) {
            require(false, 'InvalidTokenAddress()');
        }

        // sort tokens by address
        LimitImmutables memory constants;
        (constants.token0, constants.token1) = params.tokenIn < params.tokenOut
            ? (params.tokenIn, params.tokenOut)
            : (params.tokenOut, params.tokenIn);

        // check if tick spacing supported
        constants.swapFee = params.swapFee;
        constants.tickSpacing = ILimitPoolManager(owner).feeTiers(
            params.swapFee
        );
        if (constants.tickSpacing == 0) require(false, 'FeeTierNotSupported()');

        // check if pool type supported
        (address poolImpl, address tokenImpl) = ILimitPoolManager(owner)
            .poolTypes(params.poolTypeId);
        if (poolImpl == address(0) || tokenImpl == address(0))
            require(false, 'PoolTypeNotSupported()');

        // generate key for pool
        bytes32 key = keccak256(
            abi.encode(
                poolImpl,
                constants.token0,
                constants.token1,
                constants.swapFee
            )
        );

        // check if pool already exists
        if (pools[key] != address(0)) require(false, 'PoolAlreadyExists()');

        // set immutables
        constants.owner = owner;
        constants.factory = original;
        constants.genesisTime = block.timestamp.toUint32();
        (constants.bounds.min, constants.bounds.max) = ILimitPoolView(poolImpl)
            .priceBounds(constants.tickSpacing);

        // take that ERC1155 contract address and pass that into pool
        // launch pool token
        constants.poolToken = tokenImpl.cloneDeterministic({
            salt: key,
            data: abi.encodePacked(
                PositionTokens.name(constants.token0, constants.token1),
                PositionTokens.symbol(constants.token0, constants.token1)
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
            constants.poolToken,
            constants.token0,
            constants.token1,
            constants.swapFee,
            constants.tickSpacing,
            params.poolTypeId
        );

        return (pool, constants.poolToken);
    }

    function getLimitPool(
        address tokenIn,
        address tokenOut,
        uint16 swapFee,
        uint16 poolTypeId
    ) public view override returns (address pool, address poolToken) {
        // set lexographical token address ordering
        address token0 = tokenIn < tokenOut ? tokenIn : tokenOut;
        address token1 = tokenIn < tokenOut ? tokenOut : tokenIn;

        // check if tick spacing supported
        int16 tickSpacing = ILimitPoolManager(owner).feeTiers(swapFee);
        if (tickSpacing == 0) require(false, 'FeeTierNotSupported()');

        // check if pool type supported
        (address poolImpl, address tokenImpl) = ILimitPoolManager(owner)
            .poolTypes(poolTypeId);
        if (poolImpl == address(0) || tokenImpl == address(0))
            require(false, 'PoolTypeNotSupported()');

        // generate key for pool
        bytes32 key = keccak256(abi.encode(poolImpl, token0, token1, swapFee));

        pool = pools[key];

        poolToken = LibClone.predictDeterministicAddress(
            tokenImpl,
            abi.encodePacked(
                PositionTokens.name(token0, token1),
                PositionTokens.symbol(token0, token1)
            ),
            key,
            address(this)
        );

        return (pool, poolToken);
    }

    function _onlyOriginal() private view {
        if (address(this) != original) require(false, 'OriginalOnly()');
    }
}
