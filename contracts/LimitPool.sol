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
import './libraries/range/pool/MintCall.sol';
import './libraries/limit/pool/MintLimitCall.sol';
import './libraries/limit/pool/BurnLimitCall.sol';
import './libraries/math/ConstantProduct.sol';
import './libraries/solady/LibClone.sol';
import './external/openzeppelin/security/ReentrancyGuard.sol';
import 'hardhat/console.sol';


/// @notice Poolshark Limit Pool Implementation
contract LimitPool is
    ILimitPool,
    IRangePool,
    LimitPoolStorage,
    LimitPoolImmutables,
    LimitPoolFactoryStructs,
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
        nonReentrant
        factoryOnly
        canoncialOnly
    {
        console.log('initialize pool');
        // initialize state
        globalState = TicksLimit.initialize(
            limitTickMap,
            globalState,
            immutables(),
            startPrice
        );
        console.log('end of init function');
    }

    function mint(
        MintParams memory params
    ) external override
        nonReentrant
        canoncialOnly
    {
        MintCache memory cache = MintCache({
            state: globalState,
            position: positions[params.lower][params.upper],
            constants: immutables(),
            liquidityMinted: 0
        });
        cache = MintCall.perform(params, cache, rangeTickMap, ticks, samples);
        globalState = cache.state; 
        positions[params.lower][params.upper] = cache.position;
    }

    //limitSwap
    function mintLimit(
        MintLimitParams memory params
    ) external override
        nonReentrant
        canoncialOnly
    {
        MintLimitCache memory cache;
        {
            cache.state = globalState;
            cache.constants = immutables();
        }
        cache = MintLimitCall.perform(
            params.zeroForOne ? positions0 : positions1,
            ticks,
            rangeTickMap,
            limitTickMap,
            globalState,
            params,
            cache
        );
        globalState = cache.state;
    }

    function burnLimit(
        BurnLimitParams memory params
    ) external override
        nonReentrant
        canoncialOnly
    {
        if (params.to == address(0)) revert CollectToZeroAddress();
        BurnLimitCache memory cache = BurnLimitCache({
            state: globalState,
            position: params.zeroForOne ? positions0[msg.sender][params.lower][params.upper]
                                        : positions1[msg.sender][params.lower][params.upper],
            constants: immutables()
        });
        cache = BurnLimitCall.perform(
            params, 
            cache, 
            limitTickMap,
            ticks,
            params.zeroForOne ? positions0 : positions1
        );
        globalState = cache.state;
    }

    function swap(
        SwapParams memory params
    ) external override
        nonReentrant
        canoncialOnly
    returns (
        int256,
        int256
    ) 
    {
        SwapCache memory cache;
        cache.state = globalState;
        cache.constants = immutables();

        return SwapCall.perform(
            ticks,
            globalState,
            rangeTickMap,
            limitTickMap,
            params,
            cache
        );
    }

    function quote(
        QuoteParams memory params
    ) external view override canoncialOnly returns (
        uint256,
        uint256,
        uint160
    ) {
        SwapCache memory cache;
        cache.state = globalState;
        cache.constants = immutables();
        return QuoteCall.perform(
            ticks,
            rangeTickMap,
            limitTickMap,
            params,
            cache
        );
    }

    function snapshotLimit(
       SnapshotLimitParams memory params 
    ) external view override canoncialOnly returns (
        LimitPosition memory
    ) {
        return PositionsLimit.snapshot(
            params.zeroForOne ? positions0 : positions1,
            ticks,
            limitTickMap,
            globalState,
            UpdateLimitParams(
                params.owner,
                params.owner,
                params.burnPercent,
                params.lower,
                params.upper,
                params.claim,
                params.zeroForOne
            ),
            immutables()
        );
    }

    function fees(
        uint16 protocolFee0,
        uint16 protocolFee1,
        bool setFees
    ) external override
        ownerOnly
        nonReentrant
        canoncialOnly 
    returns (
        uint128 token0Fees,
        uint128 token1Fees
    ) {

        if (setFees) {
            if (protocolFee0 > 10000 || protocolFee1 > 10000)
                revert ProtocolFeeCeilingExceeded();
            globalState.pool1.protocolFee = protocolFee0;
            globalState.pool0.protocolFee = protocolFee1;
        }
        address feeTo = ILimitPoolManager(owner()).feeTo();
        token0Fees = globalState.pool1.protocolFees;
        token1Fees = globalState.pool0.protocolFees;
        globalState.pool0.protocolFees = 0;
        globalState.pool1.protocolFees = 0;
        if (token0Fees > 0)
            SafeTransfers.transferOut(feeTo, token0(), token0Fees);
        if (token1Fees > 0)
            SafeTransfers.transferOut(feeTo, token1(), token1Fees);
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
            0,
            tickSpacing()
        );
    }

    function priceBounds(int16 tickSpacing) external pure returns (uint160, uint160) {
        return ConstantProduct.priceBounds(tickSpacing);
    }

    function _onlyOwner() private view {
        if (msg.sender != owner()) revert OwnerOnly();
    }

    function _onlyCanoncialClones() private view {
        // compute pool key
        bytes32 key = keccak256(abi.encode(original, token0(), token1(), tickSpacing()));
        
        // compute canonical pool address
        address predictedAddress = LibClone.predictDeterministicAddress(
            original,
            abi.encodePacked(
                owner(),
                token0(),
                token1(),
                minPrice(),
                maxPrice(),
                tickSpacing()
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
