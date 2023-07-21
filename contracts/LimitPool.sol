// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.13;

import './interfaces/ILimitPool.sol';
import './interfaces/ILimitPoolManager.sol';
import './base/storage/LimitPoolStorage.sol';
import './base/structs/LimitPoolFactoryStructs.sol';
import './utils/LimitPoolErrors.sol';
import './libraries/pool/SwapCall.sol';
import './libraries/pool/QuoteCall.sol';
import './libraries/pool/MintCall.sol';
import './libraries/pool/BurnCall.sol';
import './libraries/math/ConstantProduct.sol';


/// @notice Poolshark Cover Pool Implementation
contract LimitPool is
    ILimitPool,
    LimitPoolFactoryStructs,
    LimitPoolStorage
{
    address public immutable owner;
    address public immutable token0;
    address public immutable token1;
    uint160 public immutable minPrice;
    uint160 public immutable maxPrice;
    int16   public immutable tickSpacing;

    modifier ownerOnly() {
        _onlyOwner();
        _;
    }

    modifier lock() {
        _prelock();
        _;
        _postlock();
    }

    constructor(
        LimitPoolParams memory params
    ) {
        // set addresses
        owner      = params.owner;
        token0     = params.token0;
        token1     = params.token1;

        // set other immutables
        tickSpacing    = params.tickSpacing;

        // initialize state
        (
            globalState,
            minPrice,
            maxPrice
        ) = Ticks.initialize(tickMap, pool0, pool1, globalState, params);
    }

    // limitSwap
    function mint(
        MintParams memory params
    ) external override lock {
        MintCache memory cache;
        {
            SwapCache memory swapCache;
            cache = MintCache({
                state: globalState,
                position: Position(0,0,0,0,0),
                constants: _immutables(),
                liquidityMinted: 0,
                pool: params.zeroForOne ? pool0 : pool1,
                swapPool: params.zeroForOne ? pool1 : pool0,
                swapCache: swapCache,
                priceLower: 0,
                priceUpper: 0,
                priceLimit: 0,
                tickLimit: 0,
                amountIn: 0,
                amountOut: 0
            });
        }
        // getNewPrice by consuming half the input and use that priceLimit
        // check if pool price in range
        cache = MintCall.perform(
            params,
            cache,
            tickMap,
            params.zeroForOne ? pool0 : pool1,
            params.zeroForOne ? pool1 : pool0,
            params.zeroForOne ? ticks0 : ticks1,
            params.zeroForOne ? ticks1 : ticks0,
            params.zeroForOne ? positions0 : positions1
        );
        globalState = cache.state;
    }

    function burn(
        BurnParams memory params
    ) external override lock {
        if (params.to == address(0)) revert CollectToZeroAddress();
        BurnCache memory cache = BurnCache({
            state: globalState,
            position: params.zeroForOne ? positions0[msg.sender][params.lower][params.upper]
                                        : positions1[msg.sender][params.lower][params.upper],
            constants: _immutables(),
            pool: params.zeroForOne ? pool0 : pool1
        });
        cache = BurnCall.perform(
            params, 
            cache, 
            tickMap,
            params.zeroForOne ? ticks0 : ticks1,
            params.zeroForOne ? positions0 : positions1
        );
        if (params.zeroForOne) {
            pool0 = cache.pool;
        } else {
            pool1 = cache.pool;
        }
        globalState = cache.state;
    }

    function swap(
        SwapParams memory params
    ) public override lock returns (
        int256,
        int256
    ) 
    {
        SwapCache memory cache;
        cache.pool = params.zeroForOne ? pool1 : pool0;
        cache.state = globalState;
        cache.constants = _immutables();

        return SwapCall.perform(
            params,
            cache,
            tickMap,
            params.zeroForOne ? pool1 : pool0,
            params.zeroForOne ? ticks1 : ticks0
        );
    }

    function quote(
        QuoteParams memory params
    ) external view override returns (
        uint256 inAmount,
        uint256 outAmount,
        uint256 priceAfter
    ) {
        SwapCache memory cache;
        cache.pool = params.zeroForOne ? pool1 : pool0;
        cache.state = globalState;
        cache.constants = _immutables();
        return QuoteCall.perform(
            params,
            cache,
            tickMap,
            params.zeroForOne ? ticks1 : ticks0
        );
    }

    function snapshot(
       SnapshotParams memory params 
    ) external view override returns (
        Position memory
    ) {
        return Positions.snapshot(
            params.zeroForOne ? positions0 : positions1,
            params.zeroForOne ? ticks0 : ticks1,
            tickMap,
            globalState,
            params.zeroForOne ? pool0 : pool1,
            UpdateParams(
                params.owner,
                params.owner,
                params.burnPercent,
                params.lower,
                params.upper,
                params.claim,
                params.zeroForOne
            ),
            _immutables()
        );
    }

    function fees(
        uint16 protocolFee0,
        uint16 protocolFee1,
        bool setFees
    ) external override ownerOnly returns (
        uint128 token0Fees,
        uint128 token1Fees
    ) {
        if (setFees) {
            globalState.protocolFee = protocolFee0;
            globalState.protocolFee = protocolFee1;
        }
        address feeTo = ILimitPoolManager(owner).feeTo();
        globalState.protocolFees.token0 = 0;
        globalState.protocolFees.token1 = 0;
        SafeTransfers.transferOut(feeTo, token0, token0Fees);
        SafeTransfers.transferOut(feeTo, token1, token1Fees);
    }

    function _immutables() private view returns (
        Immutables memory
    ) {
        return Immutables(
            ITickMath.PriceBounds(minPrice, maxPrice),
            token0,
            token1,
            tickSpacing
        );
    }

    function _prelock() private {
        if (globalState.unlocked == 2) revert Locked();
        globalState.unlocked = 2;
    }

    function _postlock() private {
        globalState.unlocked = 1;
    }

    function _onlyOwner() private view {
        if (msg.sender != owner) revert OwnerOnly();
    }
}
