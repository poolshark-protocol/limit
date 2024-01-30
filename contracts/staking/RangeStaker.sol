// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.18;

import '../interfaces/IPool.sol';
import '../interfaces/IPositionERC1155.sol';
import '../interfaces/range/IRangePool.sol';
import '../interfaces/limit/ILimitPoolView.sol';
import '../interfaces/limit/ILimitPoolStorageView.sol';
import '../interfaces/limit/ILimitPoolFactory.sol';
import '../interfaces/limit/ILimitPoolManager.sol';
import '../base/events/RangeStakerEvents.sol';
import '../libraries/utils/SafeCast.sol';
import '../libraries/utils/SafeTransfers.sol';
import '../libraries/math/OverflowMath.sol';
import '../external/solady/LibClone.sol';
import '../external/openzeppelin/security/ReentrancyGuard.sol';

/**
 * @dev Defines the actions which can be executed by the factory admin.
 */
contract RangeStaker is RangeStakerEvents, PoolsharkStructs, ReentrancyGuard {
    address public immutable limitPoolFactory;
    uint32 public immutable startTimestamp;
    uint32 public immutable endTimestamp;
    address public feeTo;
    address public owner;
    mapping(bytes32 => RangeStake) public rangeStakes;

    using SafeCast for uint256;

    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    struct RangeStake {
        address pool;
        address owner;
        uint256 feeGrowthInside0Last;
        uint256 feeGrowthInside1Last;
        uint128 liquidity;
        uint32 positionId;
        bool isStaked;
    }

    struct RangeStakerParams {
        address limitPoolFactory;
        uint32 startTime;
        uint32 endTime;
    }

    constructor(RangeStakerParams memory params) {
        owner = msg.sender;
        feeTo = msg.sender;
        limitPoolFactory = params.limitPoolFactory;
        startTimestamp = params.startTime;
        endTimestamp = params.endTime;
    }

    struct StakeRangeLocals {
        LimitImmutables constants;
        RangeStake stake;
        address poolToken;
        bytes32 stakeKey;
        uint256 feeGrowthInside0Start;
        uint256 feeGrowthInside1Start;
        uint256 feeGrowth0Accrued;
        uint256 feeGrowth1Accrued;
        uint256 positionBalance;
        uint256 token0Balance;
        uint256 token1Balance;
        uint128 newPositionLiquidity;
        uint32 positionIdNext;
    }

    function stakeRange(StakeRangeParams memory params) external nonReentrant {
        // load pool constants
        StakeRangeLocals memory locals;
        locals.constants = ILimitPoolView(params.pool).immutables();

        // Checks: validate deterministic address
        canonicalLimitPoolsOnly(params.pool, locals.constants);

        if (params.positionId != 0) {
            // use positionId passed in
            locals.stake.positionId = params.positionId;
        } else {
            // grab positionIdNext from pool
            (, , , , locals.positionIdNext, , ) = ILimitPoolStorageView(
                params.pool
            ).globalState();
            locals.stake.positionId = locals.positionIdNext - 1;
        }

        // stake info
        locals.stake.pool = params.pool;
        locals.poolToken = locals.constants.poolToken;
        locals.stakeKey = keccak256(
            abi.encode(locals.stake.pool, locals.stake.positionId)
        );

        // load previous fee growth and staked flag
        locals.stake.isStaked = rangeStakes[locals.stakeKey].isStaked;

        // check position exists
        if (!locals.stake.isStaked) {
            (, , locals.stake.liquidity, , ) = IRangePool(params.pool)
                .positions(locals.stake.positionId);
        } else {
            locals.stake.owner = rangeStakes[locals.stakeKey].owner;
            locals.stake.liquidity = rangeStakes[locals.stakeKey].liquidity;
            if (locals.stake.owner != params.to) {
                require(false, 'RangeStake::PositionOwnerMismatch()');
            }
        }

        if (locals.stake.liquidity == 0) {
            require(false, 'RangeStake::PositionNotFound()');
        }

        // check if transfer needed
        locals.positionBalance = IPositionERC1155(locals.poolToken).balanceOf(
            address(this),
            locals.stake.positionId
        );

        if (locals.positionBalance == 0) {
            // position not staked and balance not held
            IPositionERC1155(locals.poolToken).safeTransferFrom(
                msg.sender,
                address(this),
                locals.stake.positionId,
                1
            );
        }

        // start tracking fee growth from after compound
        if (!locals.stake.isStaked) {
            // compound position to avoid including old fees accrued
            IRangePool(params.pool).burnRange(
                BurnRangeParams({
                    to: params.to,
                    positionId: locals.stake.positionId,
                    burnPercent: 0
                })
            );
            (
                locals.stake.feeGrowthInside0Last,
                locals.stake.feeGrowthInside1Last,
                ,
                ,

            ) = IRangePool(params.pool).positions(locals.stake.positionId);

            // mark position as staked
            locals.stake.isStaked = true;
            locals.stake.owner = params.to;
        } else {
            // load previous fee growth
            (locals.feeGrowthInside0Start, locals.feeGrowthInside1Start) = (
                rangeStakes[locals.stakeKey].feeGrowthInside0Last,
                rangeStakes[locals.stakeKey].feeGrowthInside1Last
            );
            // load new fee growth and liquidity
            (
                locals.stake.feeGrowthInside0Last,
                locals.stake.feeGrowthInside1Last,
                locals.newPositionLiquidity,
                ,

            ) = IRangePool(params.pool).positions(params.positionId);

            // increment fee growth accrued if inside reward period
            locals.feeGrowth0Accrued = OverflowMath.mulDiv(
                locals.stake.feeGrowthInside0Last -
                    locals.feeGrowthInside0Start,
                locals.stake.liquidity,
                Q128
            );
            locals.feeGrowth1Accrued = OverflowMath.mulDiv(
                locals.stake.feeGrowthInside1Last -
                    locals.feeGrowthInside1Start,
                locals.stake.liquidity,
                Q128
            );

            if (
                block.timestamp > startTimestamp &&
                block.timestamp <= endTimestamp
            ) {
                if (
                    locals.feeGrowth0Accrued > 0 || locals.feeGrowth1Accrued > 0
                )
                    emit StakeRangeAccrued(
                        locals.stake.pool,
                        locals.stake.positionId,
                        locals.feeGrowth0Accrued,
                        locals.feeGrowth1Accrued
                    );
            }

            // update position liquidity
            locals.stake.liquidity = locals.newPositionLiquidity;
        }

        emit StakeRange(
            locals.stake.pool,
            locals.stake.positionId,
            params.to,
            locals.stake.feeGrowthInside0Last,
            locals.stake.feeGrowthInside1Last,
            locals.stake.liquidity
        );

        // Effects: store position stake in mapping
        rangeStakes[locals.stakeKey] = locals.stake;

        // Interactions: transfer out fees accrued
        if (locals.feeGrowth0Accrued > 0)
            SafeTransfers.transferOut(
                locals.stake.owner,
                locals.constants.token0,
                locals.feeGrowth0Accrued
            );
        if (locals.feeGrowth1Accrued > 0)
            SafeTransfers.transferOut(
                locals.stake.owner,
                locals.constants.token1,
                locals.feeGrowth1Accrued
            );
    }

    function unstakeRange(UnstakeRangeParams memory params)
        external
        nonReentrant
    {
        StakeRangeLocals memory locals;

        locals.poolToken = IPool(params.pool).poolToken();
        locals.stakeKey = keccak256(abi.encode(params.pool, params.positionId));

        // load previous stake
        locals.stake = rangeStakes[locals.stakeKey];

        if (locals.stake.pool == address(0)) {
            require(false, 'RangeUnstake::StakeNotFound()');
        } else if (locals.stake.owner != msg.sender) {
            require(false, 'RangeUnstake::PositionOwnerMisMatch()');
        } else if (!locals.stake.isStaked) {
            require(false, 'RangeUnstake::PositionAlreadyUnstaked()');
        }

        (
            locals.feeGrowthInside0Start,
            locals.feeGrowthInside1Start,
            ,
            ,

        ) = IRangePool(params.pool).positions(params.positionId);

        // compound position to reward user for staked period
        IRangePool(params.pool).burnRange(
            BurnRangeParams({
                to: params.to,
                positionId: params.positionId,
                burnPercent: 0
            })
        );

        // start tracking fee growth from after compound
        (
            locals.stake.feeGrowthInside0Last,
            locals.stake.feeGrowthInside1Last,
            ,
            ,

        ) = IRangePool(params.pool).positions(params.positionId);

        if (
            block.timestamp > startTimestamp && block.timestamp <= endTimestamp
        ) {
            // increment fee growth accrued if inside reward period
            locals.feeGrowth0Accrued = OverflowMath.mulDiv(
                locals.stake.feeGrowthInside0Last -
                    locals.feeGrowthInside0Start,
                locals.stake.liquidity,
                Q128
            );
            locals.feeGrowth1Accrued = OverflowMath.mulDiv(
                locals.stake.feeGrowthInside1Last -
                    locals.feeGrowthInside1Start,
                locals.stake.liquidity,
                Q128
            );
            emit StakeRangeAccrued(
                locals.stake.pool,
                locals.stake.positionId,
                locals.feeGrowth0Accrued,
                locals.feeGrowth1Accrued
            );
        }

        // transfer position back to user
        IPositionERC1155(locals.poolToken).safeTransferFrom(
            address(this),
            params.to,
            params.positionId,
            1
        );

        // mark position unstaked
        locals.stake.isStaked = false;

        emit UnstakeRange(
            locals.stake.pool,
            locals.stake.positionId,
            params.to
        );

        // store position stake in mapping
        rangeStakes[locals.stakeKey] = locals.stake;
    }

    function burnRangeStake(address pool, BurnRangeParams memory params)
        external
        nonReentrant
    {
        StakeRangeLocals memory locals;

        locals.stakeKey = keccak256(abi.encode(pool, params.positionId));

        // load previous stake
        locals.stake = rangeStakes[locals.stakeKey];

        if (locals.stake.pool == address(0)) {
            require(false, 'BurnRangeStake::StakeNotFound()');
        } else if (locals.stake.owner != msg.sender) {
            require(false, 'BurnRangeStake::PositionOwnerMismatch()');
        } else if (!locals.stake.isStaked) {
            require(false, 'BurnRangeStake::PositionAlreadyUnstaked()');
        }

        (
            locals.feeGrowthInside0Start,
            locals.feeGrowthInside1Start,
            ,
            ,

        ) = IRangePool(pool).positions(params.positionId);

        // compound position to reward user for staked period
        IRangePool(pool).burnRange(params);

        // start tracking fee growth from after compound
        (
            locals.stake.feeGrowthInside0Last,
            locals.stake.feeGrowthInside1Last,
            locals.stake.liquidity,
            ,

        ) = IRangePool(pool).positions(params.positionId);

        if (
            block.timestamp > startTimestamp && block.timestamp <= endTimestamp
        ) {
            // increment fee growth accrued if inside reward period
            locals.feeGrowth0Accrued = OverflowMath.mulDiv(
                locals.stake.feeGrowthInside0Last -
                    locals.feeGrowthInside0Start,
                locals.stake.liquidity,
                Q128
            );
            locals.feeGrowth1Accrued = OverflowMath.mulDiv(
                locals.stake.feeGrowthInside1Last -
                    locals.feeGrowthInside1Start,
                locals.stake.liquidity,
                Q128
            );
            emit StakeRangeAccrued(
                locals.stake.pool,
                locals.stake.positionId,
                locals.feeGrowth0Accrued,
                locals.feeGrowth1Accrued
            );
        }

        if (locals.stake.liquidity == 0) {
            locals.stake.isStaked = false;
        }

        // store position stake in mapping
        rangeStakes[locals.stakeKey] = locals.stake;
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
        if (newOwner == address(0))
            require(false, 'TransferredToZeroAddress()');
        _transferOwner(newOwner);
    }

    function transferFeeTo(address newFeeTo) public virtual onlyFeeTo {
        if (newFeeTo == address(0))
            require(false, 'TransferredToZeroAddress()');
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
        if (owner != msg.sender) require(false, 'OwnerOnly()');
    }

    /**
     * @dev Throws if the sender is not the feeTo.
     */
    function _checkFeeTo() internal view {
        if (feeTo != msg.sender) require(false, 'FeeToOnly()');
    }

    function supportsInterface(bytes4 interfaceId)
        external
        pure
        returns (bool)
    {
        return
            interfaceId == 0x01ffc9a7 || // ERC-165 support
            interfaceId == 0xd9b67a26; // ERC-1155 support
    }

    function canonicalLimitPoolsOnly(
        address pool,
        PoolsharkStructs.LimitImmutables memory constants
    ) private view {
        // generate key for pool
        bytes32 key = keccak256(
            abi.encode(
                constants.poolImpl,
                constants.token0,
                constants.token1,
                constants.swapFee
            )
        );

        // compute address
        address predictedAddress = LibClone.predictDeterministicAddress(
            constants.poolImpl,
            encodeLimit(constants),
            key,
            limitPoolFactory
        );

        // revert on sender mismatch
        if (pool != predictedAddress) require(false, 'InvalidCallerAddress()');
    }

    function encodeLimit(LimitImmutables memory constants)
        private
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                constants.owner,
                constants.token0,
                constants.token1,
                constants.poolToken,
                constants.bounds.min,
                constants.bounds.max,
                constants.genesisTime,
                constants.tickSpacing,
                constants.swapFee
            );
    }
}
