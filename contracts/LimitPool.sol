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

        // set price boundaries
        (minPrice, maxPrice) = ConstantProduct.priceBounds(params.tickSpacing);
    }

    // limitSwap
    function mint(
        MintParams memory params
    ) external override lock {
        MintCache memory cache = MintCache({
            state: globalState,
            position: params.zeroForOne ? positions0[params.to][params.lower][params.upper]
                                        : positions1[params.to][params.lower][params.upper],
            constants: _immutables(),
            liquidityMinted: 0,
            pool: params.zeroForOne ? pool0 : pool1,
            amountIn: 0,
            amountOut: 0
        });
        // check if pool price in range
        (cache.amountIn, cache.amountOut,) = swap(SwapParams({
            to: params.to,
            refundTo: params.refundTo,
            priceLimit: params.zeroForOne ? ConstantProduct.getPriceAtTick(params.lower, cache.constants)
                                          : ConstantProduct.getPriceAtTick(params.upper, cache.constants),
            amountIn: params.amount,
            zeroForOne: params.zeroForOne
        }));
        cache = MintCall.perform(
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

    function burn(
        BurnParams memory params
    ) external override lock {
        if (params.to == address(0)) revert CollectToZeroAddress();
        BurnCache memory cache = BurnCache({
            state: globalState,
            position: params.zeroForOne ? positions0[msg.sender][params.lower][params.upper]
                                        : positions1[msg.sender][params.lower][params.upper],
            constants: _immutables(),
            pool0: pool0,
            pool1: pool1
        });
        cache = BurnCall.perform(
            params, 
            cache, 
            tickMap,
            params.zeroForOne ? ticks0 : ticks1,
            params.zeroForOne ? positions0 : positions1
        );
        pool0 = cache.pool0;
        pool1 = cache.pool1;
        globalState = cache.state;
    }

    function swap(
        SwapParams memory params
    ) public override lock returns (
        int256 inAmount,
        uint256 outAmount,
        uint256 priceAfter
    ) 
    {
        SwapCache memory cache;
        cache.pool = params.zeroForOne ? pool1 : pool0;
        cache.state = globalState;
        cache.constants = _immutables();

        cache.pool = SwapCall.perform(
            params,
            cache,
            tickMap,
            params.zeroForOne ? ticks1 : ticks0
        );
        globalState = cache.state;

        if (params.zeroForOne) {
            pool1 = cache.pool;
            return (
                int128(params.amountIn) - int256(cache.input),
                cache.output,
                cache.price 
            );
        } else {
            pool0 = cache.pool;
            return (
                int128(params.amountIn) - int256(cache.input),
                cache.output,
                cache.price 
            );
        }
    }

    function quote(
        QuoteParams memory params
    ) external view override returns (
        int256 inAmount,
        uint256 outAmount,
        uint256 priceAfter
    ) {
        SwapCache memory cache;
        cache.pool = params.zeroForOne ? pool1 : pool0;
        cache.state = globalState;
        cache.constants = _immutables();
        (cache.pool, cache) = QuoteCall.perform(
            params,
            cache,
            tickMap,
            params.zeroForOne ? ticks1 : ticks0
        );
        if (params.zeroForOne) {
            return (
                int128(params.amountIn) - int256(cache.input),
                cache.output,
                cache.price 
            );
        } else {
            return (
                int128(params.amountIn) - int256(cache.input),
                cache.output,
                cache.price 
            );
        }
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
        uint16 syncFee,
        uint16 fillFee,
        bool setFees
    ) external override ownerOnly returns (
        uint128 token0Fees,
        uint128 token1Fees
    ) {
        if (setFees) {
            globalState.syncFee = syncFee;
            globalState.fillFee = fillFee;
        }
        token0Fees = globalState.protocolFees.token0;
        token1Fees = globalState.protocolFees.token1;
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
        if (globalState.unlocked == 0) {
            globalState = Ticks.initialize(tickMap, pool0, pool1, globalState, _immutables());
        }
        if (globalState.unlocked == 0) revert WaitUntilEnoughObservations();
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
