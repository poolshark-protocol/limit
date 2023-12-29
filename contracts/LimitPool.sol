// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

import './interfaces/IPool.sol';
import './interfaces/range/IRangePool.sol';
import './interfaces/limit/ILimitPool.sol';
import './interfaces/limit/ILimitPoolView.sol';
import './interfaces/limit/ILimitPoolManager.sol';
import './base/storage/LimitPoolStorage.sol';
import './base/storage/LimitPoolImmutables.sol';
import './libraries/pool/SwapCall.sol';
import './libraries/pool/QuoteCall.sol';
import './libraries/pool/FeesCall.sol';
import './libraries/pool/SampleCall.sol';
import './libraries/range/pool/MintRangeCall.sol';
import './libraries/range/pool/BurnRangeCall.sol';
import './libraries/range/pool/SnapshotRangeCall.sol';
import './libraries/limit/pool/MintLimitCall.sol';
import './libraries/limit/pool/BurnLimitCall.sol';
import './libraries/limit/pool/SnapshotLimitCall.sol';
import './libraries/math/ConstantProduct.sol';
import './external/solady/LibClone.sol';
import './external/openzeppelin/security/LimitReentrancyGuard.sol';

/**
 * @title Limit Pool - Constant Product
 * @author Poolshark
 * @author @alphak3y
 */
contract LimitPool is
    ILimitPool,
    ILimitPoolView,
    LimitPoolStorage,
    LimitPoolImmutables,
    LimitReentrancyGuard
{
    /// @notice This modifier only allows `owner` to call a function
    modifier ownerOnly() {
        _onlyOwner();
        _;
    }

    /// @notice This modifier only allows `factory` to call a function
    modifier factoryOnly() {
        _onlyFactory();
        _;
    }

    /// @notice This modifier checks for canoncial limit pools
    modifier canonicalOnly() {
        _onlyCanoncialClones();
        _;
    }

    /// @notice The original address of the deployed contract
    address public immutable original;
    /// @notice The factory address for the `initialize()` call
    address public immutable factory;

    constructor(address factory_) {
        original = address(this);
        factory = factory_;
    }

    /// @notice Initializes the LimitPool contract storage
    /// @param startPrice the Q64.96 sqrt price to start the pool from
    function initialize(uint160 startPrice)
        external
        nonReentrant(globalState)
        factoryOnly
        canonicalOnly
    {
        // initialize state
        globalState = Ticks.initialize(
            rangeTickMap,
            limitTickMap,
            samples,
            globalState,
            immutables(),
            startPrice
        );
    }

    /// @notice Adds bidirectional liquidity (RangePosition)
    /// @param params the params for minting the position
    /// @dev See PoolsharkStructs.sol for struct data
    function mintRange(MintRangeParams memory params)
        external
        nonReentrant(globalState)
        canonicalOnly
        returns (int256, int256)
    {
        MintRangeCache memory cache;
        cache.constants = immutables();
        return
            MintRangeCall.perform(
                positions,
                ticks,
                rangeTickMap,
                samples,
                globalState,
                cache,
                params
            );
    }

    /// @notice Removes bidirectional liquidity (RangePosition)
    /// @param params the params for burning the position
    /// @dev See PoolsharkStructs.sol for struct data
    function burnRange(BurnRangeParams memory params)
        external
        nonReentrant(globalState)
        canonicalOnly
        returns (int256, int256)
    {
        BurnRangeCache memory cache;
        cache.constants = immutables();
        return
            BurnRangeCall.perform(
                positions,
                ticks,
                rangeTickMap,
                samples,
                globalState,
                cache,
                params
            );
    }

    /// @notice Adds directional liquidity (LimitPosition)
    /// @param params the params for minting the position
    /// @dev See PoolsharkStructs.sol for struct data
    function mintLimit(MintLimitParams memory params)
        external
        nonReentrant(globalState)
        canonicalOnly
        returns (int256, int256)
    {
        MintLimitCache memory cache;
        cache.constants = immutables();
        return
            MintLimitCall.perform(
                params.zeroForOne ? positions0 : positions1,
                ticks,
                samples,
                rangeTickMap,
                limitTickMap,
                globalState,
                params,
                cache
            );
    }

    /// @notice Removes directional liquidity (LimitPosition)
    /// @param params the params for burning the position
    /// @dev See PoolsharkStructs.sol for struct data
    function burnLimit(BurnLimitParams memory params)
        external
        nonReentrant(globalState)
        canonicalOnly
        returns (int256, int256)
    {
        BurnLimitCache memory cache;
        cache.constants = immutables();
        return
            BurnLimitCall.perform(
                params.zeroForOne ? positions0 : positions1,
                ticks,
                limitTickMap,
                globalState,
                params,
                cache
            );
    }

    /// @notice Swaps tokens with the liquidity pool
    /// @param params the params for executing the swap
    /// @dev See PoolsharkStructs.sol for struct data
    function swap(SwapParams memory params)
        external
        nonReentrant(globalState)
        canonicalOnly
        returns (int256, int256)
    {
        SwapCache memory cache;
        cache.constants = immutables();
        return
            SwapCall.perform(
                ticks,
                samples,
                rangeTickMap,
                limitTickMap,
                globalState,
                params,
                cache
            );
    }

    /// @notice Increase the max sample count for oracle data
    /// @param newSampleCountMax the new max sample count
    function increaseSampleCount(uint16 newSampleCountMax)
        external
        nonReentrant(globalState)
        canonicalOnly
    {
        Samples.expand(samples, globalState.pool, newSampleCountMax);
    }

    /// @notice Modify or collect protocol fees
    /// @param params the params for modifying fees
    /// @dev See PoolsharkStructs.sol for struct data
    function fees(FeesParams memory params)
        external
        ownerOnly
        nonReentrant(globalState)
        canonicalOnly
        returns (uint128 token0Fees, uint128 token1Fees)
    {
        return FeesCall.perform(globalState, params, immutables());
    }

    /// @notice Receive a swap quote for tokenIn and tokenOut amounts
    /// @param params the params for executing the quote
    /// @dev See PoolsharkStructs.sol for struct data
    function quote(QuoteParams memory params)
        external
        view
        returns (
            uint256,
            uint256,
            uint160
        )
    {
        SwapCache memory cache;
        cache.constants = immutables();
        return
            QuoteCall.perform(
                ticks,
                rangeTickMap,
                limitTickMap,
                globalState,
                params,
                cache
            );
    }

    /// @notice Receive oracle samples
    /// @param secondsAgo an array of seconds in the past to receive samples for
    function sample(uint32[] memory secondsAgo)
        external
        view
        override
        returns (
            int56[] memory tickSecondsAccum,
            uint160[] memory secondsPerLiquidityAccum,
            uint160 averagePrice,
            uint128 averageLiquidity,
            int24 averageTick
        )
    {
        return SampleCall.perform(globalState, immutables(), secondsAgo);
    }

    /// @notice Snapshot token amounts for a RangePosition
    /// @param positionId the position id to snapshot values for
    function snapshotRange(uint32 positionId)
        external
        view
        returns (
            int56 tickSecondsAccum,
            uint160 secondsPerLiquidityAccum,
            uint128 feesOwed0,
            uint128 feesOwed1
        )
    {
        return
            SnapshotRangeCall.perform(
                positions,
                ticks,
                globalState,
                immutables(),
                positionId
            );
    }

    /// @notice Snapshot token amounts for a LimitPosition
    /// @param params the params to snapshot values for
    /// @dev See PoolsharkStructs.sol for struct data
    function snapshotLimit(SnapshotLimitParams memory params)
        external
        view
        returns (uint128, uint128)
    {
        return
            SnapshotLimitCall.perform(
                params.zeroForOne ? positions0 : positions1,
                ticks,
                limitTickMap,
                globalState,
                immutables(),
                params
            );
    }

    /// @notice Immutable values embedded directly in the contract bytecode
    /// @dev See PoolsharkStructs.sol for struct data
    function immutables() public view returns (LimitImmutables memory) {
        return
            LimitImmutables(
                owner(),
                original,
                factory,
                PriceBounds(minPrice(), maxPrice()),
                token0(),
                token1(),
                poolToken(),
                genesisTime(),
                tickSpacing(),
                swapFee()
            );
    }

    /// @notice The price bounds for the given curve math
    function priceBounds(int16 tickSpacing)
        external
        pure
        returns (uint160, uint160)
    {
        return ConstantProduct.priceBounds(tickSpacing);
    }

    function _onlyOwner() private view {
        if (msg.sender != owner()) require(false, 'OwnerOnly()');
    }

    function _onlyCanoncialClones() private view {
        // compute pool key
        bytes32 key = keccak256(
            abi.encode(original, token0(), token1(), swapFee())
        );

        // compute canonical pool address
        address predictedAddress = LibClone.predictDeterministicAddress(
            original,
            abi.encodePacked(
                owner(),
                token0(),
                token1(),
                poolToken(),
                minPrice(),
                maxPrice(),
                genesisTime(),
                tickSpacing(),
                swapFee()
            ),
            key,
            factory
        );
        // only allow delegateCall from canonical clones
        if (address(this) != predictedAddress)
            require(false, 'NoDelegateCall()');
    }

    function _onlyFactory() private view {
        if (msg.sender != factory) require(false, 'FactoryOnly()');
    }
}
