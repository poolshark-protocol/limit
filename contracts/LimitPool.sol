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
import './libraries/range/pool/BurnCall.sol';
import './libraries/limit/pool/MintLimitCall.sol';
import './libraries/limit/pool/BurnLimitCall.sol';
import './libraries/math/ConstantProduct.sol';
import './libraries/solady/LibClone.sol';
import './external/openzeppelin/security/ReentrancyGuard.sol';


/// @notice Poolshark Limit Pool Implementation
contract LimitPool is
    ILimitPool,
    IRangePool,
    LimitPoolStorage,
    LimitPoolImmutables,
    LimitPoolFactoryStructs,
    ReentrancyGuard
{

    event SimulateMint(bytes b);
    event SimulateMint(bytes4 b);
    event SimulateMint(bool b);

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

    function burn(
        BurnParams memory params
    ) external override
        nonReentrant(globalState)
        canoncialOnly
    {
        BurnCache memory cache = BurnCache({
            state: globalState,
            position: positions[params.lower][params.upper],
            constants: immutables(),
            amount0: 0,
            amount1: 0,
            tokenBurned: 0
        });
        cache = BurnCall.perform(params, cache, rangeTickMap, ticks, samples);
        globalState = cache.state;
        positions[params.lower][params.upper] = cache.position;
    }

    //limitSwap
    function mintLimit(
        MintLimitParams memory params
    ) external override
        nonReentrant(globalState)
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
            samples,
            rangeTickMap,
            limitTickMap,
            globalState,
            params,
            cache
        );

        globalState = cache.state;
    }

    function getResizedTicksForMint(
        MintLimitParams memory params
    ) external returns (int24 lower, int24 upper, bool positionCreated){
        MintLimitCache memory cache;
        {
            cache.state = globalState;
            cache.constants = immutables();
        }

        try MintLimitCall.getResizedTicks(
            params.zeroForOne ? positions0 : positions1,
            ticks,
            samples,
            rangeTickMap,
            limitTickMap,
            globalState,
            params,
            cache
        ) {
        } catch (bytes memory data) {
            emit SimulateMint(data);
            bytes4 sig;
            assembly {
                sig := mload(add(data, 0x20))
            }
            
            // SimulateMint error
            if (sig == hex"5cc1f67b") {
                (, lower, upper, positionCreated) = abi.decode(abi.encodePacked(bytes28(0), data),(bytes32,int24,int24,bool));
            }
            else {
                lower = -8388608;
                upper = -8388608;
                positionCreated = false;
            }
        }
    }

    function burnLimit(
        BurnLimitParams memory params
    ) external override
        nonReentrant(globalState)
        canoncialOnly
    {
        if (params.to == address(0)) revert CollectToZeroAddress();
        BurnLimitCache memory cache = BurnLimitCache({
            state: globalState,
            position: params.zeroForOne ? positions0[params.to][params.lower][params.upper]
                                        : positions1[params.to][params.lower][params.upper],
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

    function getResizedTicksForBurn(
        BurnLimitParams memory params
    ) external returns (int24 lower, int24 upper, bool positionExists){
        if (params.to == address(0)) revert CollectToZeroAddress();
        BurnLimitCache memory cache = BurnLimitCache({
            state: globalState,
            position: params.zeroForOne ? positions0[params.to][params.lower][params.upper]
                                        : positions1[params.to][params.lower][params.upper],
            constants: immutables()
        });

        try BurnLimitCall.getResizedTicks(
            params, 
            cache, 
            limitTickMap,
            ticks,
            params.zeroForOne ? positions0 : positions1
        ) {
        } catch (bytes memory data) {
            bytes4 sig;
            assembly {
                sig := mload(add(data, 0x20))
            }
            // SimulateBurn error
            if (sig == hex"97dd6e0a") {
                (, lower, upper, positionExists) = abi.decode(abi.encodePacked(bytes28(0), data),(bytes32,int24,int24,bool));
            }
             else {
                lower = -8388608;
                upper = -8388608;
                positionExists = false;
            }
        }
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
        cache.state = globalState;
        cache.constants = immutables();

        return SwapCall.perform(
            ticks,
            globalState,
            samples,
            rangeTickMap,
            limitTickMap,
            params,
            cache
        );
    }

    function quote(
        QuoteParams memory params
    ) external override canoncialOnly returns (
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

    function increaseSampleLength(
        uint16 sampleLengthNext
    ) external override
        nonReentrant(globalState)
        canoncialOnly 
    {
        globalState.pool = Samples.expand(
            samples,
            globalState.pool,
            sampleLengthNext
        );
    }

    function fees(
        uint16 protocolFee0,
        uint16 protocolFee1,
        bool setFees
    ) external override
        ownerOnly
        nonReentrant(globalState)
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
            poolToken(),
            tickSpacing(),
            swapFee()
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
                tickSpacing(),
                swapFee()
            ),
            key,
            factory
        );
        // only allow delegateCall from canonical clones
        // if (address(this) != predictedAddress) require(false, 'NoDelegateCall()');
    }

    function _onlyFactory() private view {
        if (msg.sender != factory) revert FactoryOnly();
    }
}
