// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../interfaces/IPool.sol';
import '../interfaces/limit/ILimitPool.sol';
import '../interfaces/limit/ILimitPoolFactory.sol';
import '../interfaces/limit/ILimitPoolManager.sol';
import '../base/events/LimitPoolManagerEvents.sol';
import '../libraries/utils/SafeCast.sol';

/**
 * @dev Defines the actions which can be executed by the factory admin.
 */
contract LimitPoolManager is ILimitPoolManager, LimitPoolManagerEvents {
    address public owner;
    address public feeTo;
    address public factory;
    uint16  public constant MAX_PROTOCOL_SWAP_FEE = 1e4; /// @dev - max protocol swap fee of 100%
    uint16  public constant MAX_PROTOCOL_FILL_FEE = 1e2; /// @dev - max protocol fill fee of 1%
    // impl name => impl address
    bytes32[] _poolTypeNames;
    mapping(uint256 => address) internal _poolImpls;
    mapping(uint256 => address) internal _tokenImpls;
    // swap fee => tick spacing
    mapping(uint16 => int16) internal _feeTiers;

    using SafeCast for uint256;

    error InvalidSwapFee();
    error InvalidTickSpacing();
    error InvalidImplAddress();
    error TickSpacingAlreadyEnabled();
    error ImplementationAlreadyExists();
    error MaxPoolTypesCountExceeded();

    constructor() {
        owner = msg.sender;
        feeTo = msg.sender;
        emit OwnerTransfer(address(0), msg.sender);
        emit FeeToTransfer(address(0), msg.sender);

        // create initial fee tiers
        _feeTiers[1000] = 10;
        _feeTiers[3000] = 30;
        _feeTiers[10000] = 100;
        emit FeeTierEnabled(1000, 10);
        emit FeeTierEnabled(3000, 30);
        emit FeeTierEnabled(10000, 100);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    modifier onlyFeeTo() {
        _checkFeeTo();
        _;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwner(address newOwner) public virtual onlyOwner {
        if(newOwner == address(0)) require (false, 'TransferredToZeroAddress()');
        _transferOwner(newOwner);
    }

    function transferFeeTo(address newFeeTo) public virtual onlyFeeTo {
        if(newFeeTo == address(0)) require (false, 'TransferredToZeroAddress()');
        _transferFeeTo(newFeeTo);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwner(address newOwner) internal virtual {
        address oldOwner = owner;
        owner = newOwner;
        emit OwnerTransfer(oldOwner, newOwner);
    }

    /**
     * @dev Transfers fee collection to a new account (`newFeeTo`).
     * Internal function without access restriction.
     */
    function _transferFeeTo(address newFeeTo) internal virtual {
        address oldFeeTo = feeTo;
        feeTo = newFeeTo;
        emit FeeToTransfer(oldFeeTo, newFeeTo);
    }

    function enableFeeTier(
        uint16 swapFee,
        int16 tickSpacing
    ) external onlyOwner {
        if (_feeTiers[swapFee] != 0) revert TickSpacingAlreadyEnabled();
        if (tickSpacing <= 0) revert InvalidTickSpacing();
        if (tickSpacing % 2 != 0) revert InvalidTickSpacing();
        if (swapFee == 0) revert InvalidSwapFee();
        if (swapFee > 10000) revert InvalidSwapFee();
        _feeTiers[swapFee] = tickSpacing;
        emit FeeTierEnabled(swapFee, tickSpacing);
    }

    function enablePoolType(
        address poolImpl_,
        address tokenImpl_,
        bytes32 poolTypeName_
    ) external onlyOwner {
        uint8 poolTypeId_ = _poolTypeNames.length.toUint8();
        if (poolTypeId_ > type(uint8).max) revert MaxPoolTypesCountExceeded();
        if (_poolImpls[poolTypeId_] != address(0)) revert ImplementationAlreadyExists();
        if (poolImpl_ == address(0) || tokenImpl_ == address(0)) revert InvalidImplAddress();
        /// @dev - prevent same addresses since factory does not support this
        if (poolImpl_ == tokenImpl_) revert InvalidImplAddress();
        _poolImpls[poolTypeId_] = poolImpl_;
        _tokenImpls[poolTypeId_] = tokenImpl_;
        emit PoolTypeEnabled(poolTypeName_, poolTypeId_, poolImpl_, tokenImpl_);
    }

    function setFactory(
        address factory_
    ) external onlyOwner {
        if (factory != address(0)) require (false, 'FactoryAlreadySet()');
        emit FactoryChanged(factory, factory_);
        factory = factory_;
    }

    function collectProtocolFees(
        address[] calldata pools
    ) external {
        if (pools.length == 0) require (false, 'EmptyPoolsArray()');
        uint128[] memory token0FeesCollected = new uint128[](pools.length);
        uint128[] memory token1FeesCollected = new uint128[](pools.length);
        // pass empty fees params
        FeesParams memory feesParams;
        for (uint i; i < pools.length;) {
            (
                token0FeesCollected[i],
                token1FeesCollected[i]
            ) = IPool(pools[i]).fees(feesParams);
            unchecked {
                ++i;
            }
        }
        emit ProtocolFeesCollected(pools, token0FeesCollected, token1FeesCollected);
    }

    // protocol fee flags
    uint8 internal constant PROTOCOL_SWAP_FEE_0 = 2**0;
    uint8 internal constant PROTOCOL_SWAP_FEE_1 = 2**1;
    uint8 internal constant PROTOCOL_FILL_FEE_0 = 2**2;
    uint8 internal constant PROTOCOL_FILL_FEE_1 = 2**3;

    function modifyProtocolFees(
        address[] calldata pools,
        FeesParams[] calldata feesParams
    ) external onlyOwner {
        if (pools.length == 0) require (false, 'EmptyPoolsArray()');
        if (pools.length != feesParams.length) {
            require (false, 'MismatchedArrayLengths()');
        }
        uint128[] memory token0FeesCollected = new uint128[](pools.length);
        uint128[] memory token1FeesCollected = new uint128[](pools.length);
        uint16[] memory protocolSwapFees0 = new uint16[](pools.length);
        uint16[] memory protocolSwapFees1 = new uint16[](pools.length);
        uint16[] memory protocolFillFees0 = new uint16[](pools.length);
        uint16[] memory protocolFillFees1 = new uint16[](pools.length);
        for (uint i; i < pools.length;) {
            (
                token0FeesCollected[i],
                token1FeesCollected[i]
            ) = IPool(pools[i]).fees(
                feesParams[i]
            );
            if ((feesParams[i].setFeesFlags & PROTOCOL_SWAP_FEE_0) > 0) {
                protocolSwapFees0[i] = feesParams[i].protocolSwapFee0;
            }
            if ((feesParams[i].setFeesFlags & PROTOCOL_SWAP_FEE_1) > 0) {
                protocolSwapFees1[i] = feesParams[i].protocolSwapFee1;
            }
            if ((feesParams[i].setFeesFlags & PROTOCOL_FILL_FEE_0) > 0) {
                protocolFillFees0[i] = feesParams[i].protocolFillFee0;
            }
            if ((feesParams[i].setFeesFlags & PROTOCOL_FILL_FEE_1) > 0) {
                protocolFillFees1[i] = feesParams[i].protocolFillFee1;
            }
            // else values will remain zero
            unchecked {
                ++i;
            }
        }
        emit ProtocolSwapFeesModified(
            pools,
            protocolSwapFees0,
            protocolSwapFees1
        );
        emit ProtocolFillFeesModified(
            pools,
            protocolFillFees0,
            protocolFillFees1
        );
        emit ProtocolFeesCollected(
            pools,
            token0FeesCollected,
            token1FeesCollected
        );
    }

    function poolTypes(
        uint8 poolTypeId
    ) external view returns (
        address,
        address
    ) {
        return (_poolImpls[poolTypeId], _tokenImpls[poolTypeId]);
    }

    function feeTiers(
        uint16 swapFee
    ) external view returns (
        int16 tickSpacing
    ) {
        return _feeTiers[swapFee];
    }
    
    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view {
        if (owner != msg.sender) require (false, 'OwnerOnly()');
    }

    /**
     * @dev Throws if the sender is not the feeTo.
     */
    function _checkFeeTo() internal view {
        if (feeTo != msg.sender) require (false, 'FeeToOnly()');
    }
}