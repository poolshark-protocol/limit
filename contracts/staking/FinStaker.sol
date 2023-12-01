// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../interfaces/IPool.sol';
import '../interfaces/IPositionERC1155.sol';
import '../interfaces/limit/ILimitPoolView.sol';
import '../interfaces/limit/ILimitPoolStorageView.sol';
import '../interfaces/limit/ILimitPoolFactory.sol';
import '../interfaces/limit/ILimitPoolManager.sol';
import '../base/events/FinStakerEvents.sol';
import '../libraries/utils/SafeCast.sol';
import '../libraries/utils/SafeTransfers.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/**
 * @dev Defines the actions which can be executed by the factory admin.
 */
contract FinStaker is FinStakerEvents, PoolsharkStructs {
    IERC20 public immutable FIN;
    address public feeTo;
    address public owner;
    mapping(address => FinStake) public finStakes;

    using SafeCast for uint256;

    uint256 internal constant Q128 = 0x100000000000000000000000000000000;
    uint128 internal constant SECONDS_PER_YEAR = 31536000;

    struct FinStake {
        uint128 amount;
        uint128 multiplierPoints;
        uint32 lastTimestamp;
    }

    constructor(
        address finToken
    ) {
        owner = msg.sender;
        feeTo = msg.sender;
        FIN = IERC20(finToken);
    }

    struct StakeFinLocals {
        FinStake stake;
    }

    function stakeFin(StakeFinParams memory params) external {

        // load pool constants
        StakeFinLocals memory locals;

        // stake info
        locals.stake = finStakes[params.to];

        // check position exists
        if (locals.stake.amount > 0) {
            locals.stake.multiplierPoints += uint128(block.timestamp - locals.stake.lastTimestamp) 
                                                * locals.stake.amount
                                                / SECONDS_PER_YEAR;
            if (locals.stake.multiplierPoints > locals.stake.amount)
                // multiplier points capped at 100% of staked amount
                locals.stake.multiplierPoints = locals.stake.amount;
            emit StakeFinAccrued(
                params.to,
                locals.stake.multiplierPoints
            );
        }
        if (block.timestamp > type(uint32).max) require(false, 'MaxTimestampExceeded()');
        locals.stake.lastTimestamp = uint32(block.timestamp);

        if (params.amount > 0) {
            FIN.transferFrom(
                msg.sender,
                address(this),
                params.amount
            );
            locals.stake.amount += params.amount;
        }

        emit StakeFin(
            params.to,
            params.amount
        );
    }

    function unstakeFin(StakeFinParams memory params) external {

        // load pool constants
        StakeFinLocals memory locals;

        // stake info
        locals.stake = finStakes[msg.sender];

        // check position exists
        if (locals.stake.amount > 0) {
            locals.stake.multiplierPoints += uint128(block.timestamp - locals.stake.lastTimestamp) 
                                                * locals.stake.amount
                                                / SECONDS_PER_YEAR;
            if (locals.stake.multiplierPoints > locals.stake.amount)
                // multiplier points capped at 100% of staked amount
                locals.stake.multiplierPoints = locals.stake.amount;
            emit StakeFinAccrued(
                params.to,
                locals.stake.multiplierPoints
            );
        }
        if (block.timestamp > type(uint32).max) require(false, 'MaxTimestampExceeded()');
        locals.stake.lastTimestamp = uint32(block.timestamp);

        if (params.amount > 0) {
            // Checks: ensure user does not overwithdraw
            if (params.amount > locals.stake.amount)
                require(false, 'UnstakeFin::LowFinBalance()');

            // Effects: proportionally reduce multiplier points
            locals.stake.multiplierPoints -= locals.stake.multiplierPoints * params.amount / locals.stake.amount;
            
            // Effects: reduce staked amount
            locals.stake.amount -= params.amount;
            
            // Interactions: transfer out FIN
            SafeTransfers.transferOut(
                params.to,
                address(FIN),
                params.amount
            );
        }

        emit StakeFin(
            params.to,
            params.amount
        );
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