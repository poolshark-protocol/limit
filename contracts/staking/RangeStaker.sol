// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../interfaces/IPool.sol';
import '../interfaces/IPositionERC1155.sol';
import '../interfaces/range/IRangePool.sol';
import '../interfaces/limit/ILimitPool.sol';
import '../interfaces/limit/ILimitPoolFactory.sol';
import '../interfaces/limit/ILimitPoolManager.sol';
import '../base/events/LimitPoolManagerEvents.sol';
import '../libraries/utils/SafeCast.sol';

/**
 * @dev Defines the actions which can be executed by the factory admin.
 */
contract RangeStaker is LimitPoolManagerEvents {
    address public immutable limitPoolFactory;
    uint32 public immutable startTimestamp;
    uint32 public immutable endTimestamp;
    address public feeTo;
    address public owner;
    mapping(bytes32 => RangeStake) public rangeStakes;

    using SafeCast for uint256;

    struct RangeStake {
        address pool;
        uint256 feeGrowthInside0Last;
        uint256 feeGrowthInside1Last;
        uint256 feeGrowthInside0Accrued;
        uint256 feeGrowthInside1Accrued;
        uint32 positionId;
    }

    struct RangeStakingParams {
        address factory;
        uint32 startTime;
        uint32 endTime;
    }

    constructor(
        RangeStakingParams memory params
    ) {
        owner = msg.sender;
        feeTo = msg.sender;
        limitPoolFactory = params.factory;
        startTimestamp = params.startTime;
        endTimestamp = params.endTime;
    }

    struct StakeRangeParams {
        address pool;
        uint32 positionId;
    }

    struct StakeRangeLocals {
        RangeStake stake;
        address poolToken;
        bytes32 stakeKey;
        uint256 feeGrowthInside0Start;
        uint256 feeGrowthInside1Start;
        uint128 positionLiquidity;
    }

    function stakeRange(StakeRangeParams memory params) external {

        if (block.timestamp < startTimestamp || block.timestamp >= endTimestamp) {
            // early return if outside reward period
            return;
        }

        StakeRangeLocals memory locals;
        (
            ,,
            locals.positionLiquidity,,
        ) = IPool(params.pool).positions(params.positionId);

        if (locals.positionLiquidity == 0) {
            // range position has 0 liquidity or does not exist
            require(false, "RangeStake::PositionNotFound()");
        }
        
        locals.stake.pool = params.pool;
        locals.stake.positionId = params.positionId;
        locals.poolToken = IPool(params.pool).poolToken();
        locals.stakeKey = keccak256(abi.encode(
            msg.sender,
            locals.stake.pool,
            locals.stake.positionId
        ));

        // load previous fee growth in case user unstakes and restakes
        locals.stake.feeGrowthInside0Accrued = rangeStakes[locals.stakeKey].feeGrowthInside0Accrued;
        locals.stake.feeGrowthInside1Accrued = rangeStakes[locals.stakeKey].feeGrowthInside1Accrued;

        // transfer will fail if user does not hold position
        IPositionERC1155(locals.poolToken).safeTransferFrom(
            msg.sender,
            address(this),
            params.positionId,
            1
        );

        // compound position to avoid including old fees accrued
        IRangePool(params.pool).burnRange(BurnRangeParams({
            to: msg.sender,
            positionId: params.positionId,
            burnPercent: 0
        }));

        // start tracking fee growth from after compound
        (
            locals.stake.feeGrowthInside0Last,
            locals.stake.feeGrowthInside1Last,
            ,,
        ) = IPool(params.pool).positions(params.positionId);

        // store position stake in mapping
        rangeStakes[locals.stakeKey] = locals.stake;
    }

    struct UnstakeRangeParams {
        address to;
        address pool;
        uint32 positionId;
    }

    function unstakeRange(UnstakeRangeParams memory params) external {
        
        if (block.timestamp < startTimestamp || block.timestamp >= endTimestamp) {
            // early return if outside reward period
            return;
        }

        StakeRangeLocals memory locals;

        locals.poolToken = IPool(params.pool).poolToken();
        locals.stakeKey = keccak256(abi.encode(
            msg.sender,
            locals.stake.pool,
            locals.stake.positionId
        ));

        // load previous stake
        locals.stake = rangeStakes[locals.stakeKey];

        if (locals.stake.pool == address(0)) {
            // range stake does not exist
            require(false, "RangeUnstake::StakeNotFound()");
        }

        // check position token is held by staking contract
        if (IPositionERC1155(locals.poolToken).balanceOf(address(this), params.positionId) != 1) {
            require(false, "RangeUnstake::StakingContractNotPositionOwner()");
        }

        (
            locals.feeGrowthInside0Start,
            locals.feeGrowthInside1Start,
            ,,
        ) = IPool(params.pool).positions(params.positionId);

        // compound position to reward user for staked period
        IRangePool(params.pool).burnRange(BurnRangeParams({
            to: params.to,
            positionId: params.positionId,
            burnPercent: 0
        }));

        // start tracking fee growth from after compound
        (
            locals.stake.feeGrowthInside0Last,
            locals.stake.feeGrowthInside1Last,
            ,,
        ) = IPool(params.pool).positions(params.positionId);

        // increment fee growth accrued
        locals.stake.feeGrowthInside0Accrued += locals.stake.feeGrowthInside0Last - locals.feeGrowthInside0Start;
        locals.stake.feeGrowthInside1Accrued += locals.stake.feeGrowthInside1Last - locals.feeGrowthInside1Start;

        // transfer position back to user
        IPositionERC1155(locals.poolToken).safeTransferFrom(
            address(this),
            params.to,
            params.positionId,
            1
        );

        // store position stake in mapping
        rangeStakes[locals.stakeKey] = locals.stake;
    }

    // mint and stake

    // burn (does not unstake)

    // compound

    // collect

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

    //TODO: implement 1155 receive hook
}