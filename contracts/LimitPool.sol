// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import './interfaces/range/IRangePool.sol';
import './interfaces/limit/ILimitPool.sol';
import './interfaces/IPool.sol';
import './interfaces/limit/ILimitPoolManager.sol';
import './base/storage/LimitPoolStorage.sol';
import './base/storage/LimitPoolImmutables.sol';
import './base/structs/LimitPoolFactoryStructs.sol';
import './utils/LimitPoolErrors.sol';
import './libraries/pool/SwapCall.sol';
import './libraries/pool/QuoteCall.sol';
import './libraries/pool/FeesCall.sol';
import './libraries/pool/SampleCall.sol';
import './libraries/range/pool/MintRangeCall.sol';
import './libraries/range/pool/BurnRangeCall.sol';
import './libraries/range/pool/SnapshotCall.sol';
import './libraries/limit/pool/MintLimitCall.sol';
import './libraries/limit/pool/BurnLimitCall.sol';
import './libraries/limit/pool/SnapshotLimitCall.sol';
import './libraries/math/ConstantProduct.sol';
import './libraries/solady/LibClone.sol';
import './external/openzeppelin/security/ReentrancyGuard.sol';


/// @notice Poolshark Limit Pool Implementation
contract LimitPool is
    ILimitPool,
    IRangePool,
    LimitPoolStorage,
    LimitPoolImmutables,
    ReentrancyGuard
{

    modifier ownerOnly() {
        _onlyOwner();
        _;
    }

    modifier factoryOnly() {
        _onlyFactory();
        _;
    }

    modifier canoncialOnly() {
        _onlyCanoncialClones();
        _;
    }

    address public immutable original;
    address public immutable factory;

    constructor(
        address factory_
    ) {
        original = address(this);
        factory = factory_;
    }

    function initialize(
        uint160 startPrice
    ) external override 
        nonReentrant(globalState)
        factoryOnly
        canoncialOnly
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

    function mint(
        MintParams memory params
    ) external override
        nonReentrant(globalState)
        canoncialOnly
    {
        MintCache memory cache;
        cache.constants = immutables();
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

    function burn(
        BurnParams memory params
    ) external override
        nonReentrant(globalState)
        canoncialOnly
    {
        BurnCache memory cache;
        cache.constants = immutables();
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

    //limitSwap
    function mintLimit(
        MintLimitParams memory params
    ) external override
        nonReentrant(globalState)
        canoncialOnly
    {
        MintLimitCache memory cache;
        cache.constants = immutables();
        cache.state = globalState;
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

    function burnLimit(
        BurnLimitParams memory params
    ) external override
        nonReentrant(globalState)
        canoncialOnly
    {
        BurnLimitCache memory cache;
        cache.constants = immutables();
        BurnLimitCall.perform(
            params.zeroForOne ? positions0 : positions1,
            ticks,
            limitTickMap,
            globalState,
            params, 
            cache
        );
    }

    function swap(
        SwapParams memory params
    ) external override
        nonReentrant(globalState)
        canoncialOnly
    returns (
        int256,
        int256
    ) 
    {
        SwapCache memory cache;
        cache.constants = immutables();
        return SwapCall.perform(
            ticks,
            samples,
            rangeTickMap,
            limitTickMap,
            globalState,
            params,
            cache
        );
    }

    function increaseSampleLength(
        uint16 sampleLengthNext
    ) external override
        nonReentrant(globalState)
        canoncialOnly 
    {
        Samples.expand(
            samples,
            globalState.pool,
            sampleLengthNext
        );
    }

    function fees(
        FeesParams memory params
    ) external override
        ownerOnly
        nonReentrant(globalState)
        canoncialOnly 
    returns (
        uint128 token0Fees,
        uint128 token1Fees
    ) {
        return FeesCall.perform(
            globalState,
            params,
            immutables()
        );
    }

    function quote(
        QuoteParams memory params
    ) external view override
    returns (
        uint256,
        uint256,
        uint160
    ) {
        SwapCache memory cache;
        cache.constants = immutables();
        return QuoteCall.perform(
            ticks,
            rangeTickMap,
            limitTickMap,
            globalState,
            params,
            cache
        );
    }

    function sample(
        uint32[] memory secondsAgo
    ) external view
    returns(
        int56[]   memory tickSecondsAccum,
        uint160[] memory secondsPerLiquidityAccum,
        uint160 averagePrice,
        uint128 averageLiquidity,
        int24 averageTick
    ) 
    {
        return SampleCall.perform(
            globalState,
            immutables(),
            secondsAgo
        );
    }

    function snapshot(
        uint32 positionId 
    ) external view override returns (
        int56   tickSecondsAccum,
        uint160 secondsPerLiquidityAccum,
        uint128 feesOwed0,
        uint128 feesOwed1
    ) {
        return SnapshotCall.perform(
            positions,
            ticks,
            globalState,
            immutables(),
            positionId
        );
    }

    function snapshotLimit(
        BurnLimitParams memory params
    ) external view override returns(
        uint128,
        uint128
    ) {
        return SnapshotLimitCall.perform(
            params.zeroForOne ? positions0 : positions1,
            ticks,
            limitTickMap,
            globalState,
            params
        );
    }

    function immutables() public view returns (
        PoolsharkStructs.Immutables memory
    ) {
        return Immutables(
            owner(),
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

    function priceBounds(
        int16 tickSpacing
    ) external pure returns (uint160, uint160) {
        return ConstantProduct.priceBounds(tickSpacing);
    }

    function _onlyOwner() private view {
        if (msg.sender != owner()) revert OwnerOnly();
    }

    function _onlyCanoncialClones() private view {
        // compute pool key
        bytes32 key = keccak256(abi.encode(original, token0(), token1(), swapFee()));
        
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
        if (address(this) != predictedAddress) require(false, 'NoDelegateCall()');
    }

    function _onlyFactory() private view {
        if (msg.sender != factory) revert FactoryOnly();
    }
}
