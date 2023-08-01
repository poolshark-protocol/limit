// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import './interfaces/ILimitPool.sol';
import './interfaces/ILimitPoolManager.sol';
import './base/storage/LimitPoolStorage.sol';
import './base/storage/LimitPoolImmutables.sol';
import './base/structs/LimitPoolFactoryStructs.sol';
import './utils/LimitPoolErrors.sol';
import './libraries/pool/SwapCall.sol';
import './libraries/pool/QuoteCall.sol';
import './libraries/pool/MintCall.sol';
import './libraries/pool/BurnCall.sol';
import './libraries/math/ConstantProduct.sol';
import './libraries/solady/LibClone.sol';
import './external/openzeppelin/security/ReentrancyGuard.sol';


/// @notice Poolshark Cover Pool Implementation
contract LimitPool is
    ILimitPool,
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
        // initialize state
        globalState = Ticks.initialize(
            tickMap,
            pool0,
            pool1,
            globalState,
            immutables(),
            startPrice
        );
    }

    // limitSwap
    function mint(
        MintParams memory params
    ) external override
        nonReentrant
        canoncialOnly
    {
        MintCache memory cache;
        {
            cache.state = globalState;
            cache.constants = immutables();
            cache.pool = params.zeroForOne ? pool0 : pool1;
            cache.swapPool = params.zeroForOne ? pool1 : pool0;
        }
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
    ) external override 
        nonReentrant
        canoncialOnly
    {
        if (params.to == address(0)) revert CollectToZeroAddress();
        BurnCache memory cache = BurnCache({
            state: globalState,
            position: params.zeroForOne ? positions0[msg.sender][params.lower][params.upper]
                                        : positions1[msg.sender][params.lower][params.upper],
            constants: immutables(),
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
    ) public override
        nonReentrant
        canoncialOnly
    returns (
        int256,
        int256
    ) 
    {
        SwapCache memory cache;
        cache.pool = params.zeroForOne ? pool1 : pool0;
        cache.state = globalState;
        cache.constants = immutables();

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
    ) external view override canoncialOnly returns (
        uint256 inAmount,
        uint256 outAmount,
        uint256 priceAfter
    ) {
        SwapCache memory cache;
        cache.pool = params.zeroForOne ? pool1 : pool0;
        cache.state = globalState;
        cache.constants = immutables();
        return QuoteCall.perform(
            params,
            cache,
            tickMap,
            params.zeroForOne ? ticks1 : ticks0
        );
    }

    function snapshot(
       SnapshotParams memory params 
    ) external view override canoncialOnly returns (
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
            pool1.protocolFee = protocolFee0;
            pool0.protocolFee = protocolFee1;
        }
        address feeTo = ILimitPoolManager(owner()).feeTo();
        token0Fees = pool1.protocolFees;
        token1Fees = pool0.protocolFees;
        pool0.protocolFees = 0;
        pool1.protocolFees = 0;
        if (token0Fees > 0)
            SafeTransfers.transferOut(feeTo, token0(), token0Fees);
        if (token1Fees > 0)
            SafeTransfers.transferOut(feeTo, token1(), token1Fees);
    }

    function immutables() public view returns (
        Immutables memory
    ) {
        return Immutables(
            owner(),
            factory,
            ConstantProduct.PriceBounds(minPrice(), maxPrice()),
            token0(),
            token1(),
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
        
        // computer canonical pool address
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
