// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../interfaces/IPool.sol';
import '../interfaces/limit/ILimitPool.sol';
import '../interfaces/limit/ILimitPoolFactory.sol';
import '../interfaces/limit/ILimitPoolManager.sol';
import '../base/events/LimitPoolManagerEvents.sol';

/**
 * @dev Defines the actions which can be executed by the factory admin.
 */
contract LimitPoolManager is ILimitPoolManager, LimitPoolManagerEvents {
    address public owner;
    address public feeTo;
    address public factory;
    uint16  public constant MAX_PROTOCOL_FEE = 1e4; /// @dev - max protocol fee of 1%
    // tickSpacing => enabled
    mapping(bytes32 => address) internal _poolImpls;
    mapping(bytes32 => address) internal _tokenImpls;
    mapping(uint16 => int16) internal _feeTiers;

    error InvalidSwapFee();
    error InvalidTickSpacing();
    error TickSpacingAlreadyEnabled();
    error ImplementationAlreadyExists();

    constructor() {
        owner = msg.sender;
        feeTo = msg.sender;
        emit OwnerTransfer(address(0), msg.sender);

        // create initial fee tiers
        _feeTiers[500] = 10;
        _feeTiers[10000] = 100;
        emit FeeTierEnabled(500, 10);
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
        emit OwnerTransfer(oldFeeTo, newFeeTo);
    }

    function enableTickSpacing(
        int16 tickSpacing,
        uint16 swapFee
    ) external onlyOwner {
        if (_feeTiers[swapFee] != 0) revert TickSpacingAlreadyEnabled();
        if (tickSpacing <= 0) revert InvalidTickSpacing();
        if (tickSpacing % 2 != 0) revert InvalidTickSpacing();
        if (swapFee == 0) revert InvalidSwapFee();
        if (swapFee > 10000) revert InvalidSwapFee();
        _feeTiers[swapFee] = tickSpacing;
        emit FeeTierEnabled(swapFee, tickSpacing);
    }

    function enableImplementation(
        bytes32 poolType_,
        address poolImpl_,
        address tokenImpl_
    ) external onlyOwner {
        if (_poolImpls[poolType_] != address(0)) revert ImplementationAlreadyExists();
        _poolImpls[poolType_] = poolImpl_;
        _tokenImpls[poolType_] = tokenImpl_;
        emit ImplementationEnabled(poolType_, poolImpl_, tokenImpl_);
    }

    function setFactory(
        address factory_
    ) external onlyOwner {
        if (factory != address(0)) require (false, 'FactoryAlreadySet()');
        emit FactoryChanged(factory, factory_);
        factory = factory_;
    }

    function collectProtocolFees(
        address[] calldata collectPools
    ) external {
        if (collectPools.length == 0) require (false, 'EmptyPoolsArray()');
        uint128[] memory token0Fees = new uint128[](collectPools.length);
        uint128[] memory token1Fees = new uint128[](collectPools.length);
        for (uint i; i < collectPools.length;) {
            (token0Fees[i], token1Fees[i]) = IPool(collectPools[i]).fees(0,0,false);
            unchecked {
                ++i;
            }
        }
        emit ProtocolFeesCollected(collectPools, token0Fees, token1Fees);
    }

    function modifyProtocolFees(
        address[] calldata modifyPools,
        uint16[] calldata syncFees,
        uint16[] calldata fillFees,
        bool[] calldata setFees
    ) external onlyOwner {
        if (modifyPools.length == 0) require (false, 'EmptyPoolsArray()');
        if (modifyPools.length != syncFees.length
            || syncFees.length != fillFees.length
            || fillFees.length != setFees.length) {
            require (false, 'MismatchedArrayLengths()');
        }
        uint128[] memory token0Fees = new uint128[](modifyPools.length);
        uint128[] memory token1Fees = new uint128[](modifyPools.length);
        for (uint i; i < modifyPools.length;) {
            if (syncFees[i] > MAX_PROTOCOL_FEE) require (false, 'ProtocolFeeCeilingExceeded()');
            if (fillFees[i] > MAX_PROTOCOL_FEE) require (false, 'ProtocolFeeCeilingExceeded()');
            (
                token0Fees[i],
                token1Fees[i]
            ) = IPool(modifyPools[i]).fees(
                syncFees[i],
                fillFees[i],
                setFees[i]
            );
            unchecked {
                ++i;
            }
        }
        emit ProtocolFeesModified(modifyPools, syncFees, fillFees, setFees, token0Fees, token1Fees);
    }

    function implementations(
        bytes32 key
    ) external view returns (
        address,
        address
    ) {
        return (_poolImpls[key], _tokenImpls[key]);
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