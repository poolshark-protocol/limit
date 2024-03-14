// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.21;

import '../interfaces/IPool.sol';
import '../interfaces/IPositionERC1155.sol';
import '../interfaces/limit/ILimitPool.sol';
import '../interfaces/limit/ILimitPoolView.sol';
import '../interfaces/limit/ILimitPoolStorageView.sol';
import '../interfaces/limit/ILimitPoolFactory.sol';
import '../interfaces/limit/ILimitPoolManager.sol';
import '../base/events/LimitStakerEvents.sol';
import '../libraries/utils/SafeCast.sol';
import '../libraries/utils/SafeTransfers.sol';
import '../libraries/math/OverflowMath.sol';
import '../external/solady/LibClone.sol';
import '../external/openzeppelin/security/ReentrancyGuard.sol';

/**
 * @dev Defines the actions which can be executed by the factory admin.
 */
contract LimitStaker is LimitStakerEvents, PoolsharkStructs, ReentrancyGuard {
    address public immutable limitPoolFactory;
    uint32 public immutable startTimestamp;
    uint32 public immutable endTimestamp;
    address public feeTo;
    address public owner;
    mapping(bytes32 => LimitStake) public limitStakes;

    using SafeCast for uint256;
    using SafeCast for int256;

    uint256 internal constant Q128 = 0x100000000000000000000000000000000;

    struct LimitStake {
        address pool;
        address owner;
        uint128 liquidity;
        uint32 positionId;
        bool zeroForOne;
        bool isStaked;
    }

    struct LimitStakerParams {
        address limitPoolFactory;
        uint32 startTime;
        uint32 endTime;
    }

    constructor(LimitStakerParams memory params) {
        owner = msg.sender;
        feeTo = msg.sender;
        limitPoolFactory = params.limitPoolFactory;
        startTimestamp = params.startTime;
        endTimestamp = params.endTime;
    }

    struct StakeLimitLocals {
        LimitImmutables constants;
        LimitStake stake;
        address poolToken;
        bytes32 stakeKey;
        uint256 positionBalance;
        uint256 token0Balance;
        uint256 token1Balance;
        int256 token0Accrued;
        int256 token1Accrued;
        uint128 newPositionLiquidity;
        uint32 positionIdNext;
        int24 lower;
        int24 upper;
    }

    function stakeLimit(StakeLimitParams memory params) external nonReentrant {
        // load pool constants
        StakeLimitLocals memory locals;
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
        locals.stake.isStaked = limitStakes[locals.stakeKey].isStaked;

        // check position exists
        if (!locals.stake.isStaked) {
            (locals.stake.liquidity,,locals.lower,locals.upper,) = params.zeroForOne 
                ? ILimitPoolStorageView(params.pool).positions0(locals.stake.positionId)
                : ILimitPoolStorageView(params.pool).positions1(locals.stake.positionId);
            locals.stake.owner = params.to;
            locals.stake.zeroForOne = params.zeroForOne;
        } else {
            locals.stake.owner = limitStakes[locals.stakeKey].owner;
            locals.stake.liquidity = limitStakes[locals.stakeKey].liquidity;
            locals.stake.zeroForOne = limitStakes[locals.stakeKey].zeroForOne;
            if (locals.stake.owner != params.to) {
                require(false, 'LimitStake::PositionOwnerMismatch()');
            }
        }

        if (locals.stake.liquidity == 0) {
            require(false, 'LimitStake::PositionNotFound()');
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
            // update position to exclude previous fills
            ILimitPool(params.pool).burnLimit(
                BurnLimitParams({
                    to: locals.stake.owner,
                    positionId: locals.stake.positionId,
                    burnPercent: 0,
                    claim: params.zeroForOne ? locals.lower 
                                             : locals.upper,
                    zeroForOne: params.zeroForOne
                })
            );
        }

        (
            locals.newPositionLiquidity,
            ,,,
        ) = locals.stake.zeroForOne
            ? ILimitPoolStorageView(params.pool).positions0(locals.stake.positionId)
            : ILimitPoolStorageView(params.pool).positions1(locals.stake.positionId);
        
        if (locals.newPositionLiquidity == 0) {
            // position already 100% filled; early return
            return;
        }

        // update position liquidity
        locals.stake.liquidity = locals.newPositionLiquidity;

        if (locals.stake.liquidity > 0) {
            locals.stake.isStaked = true;
        }

        emit StakeLimit(
            locals.stake.pool,
            locals.stake.positionId,
            params.to,
            locals.stake.liquidity,
            locals.stake.zeroForOne
        );

        // Effects: store position stake in mapping
        limitStakes[locals.stakeKey] = locals.stake;
    }

    function unstakeLimit(UnstakeLimitParams memory params)
        external
        nonReentrant
    {
        StakeLimitLocals memory locals;

        locals.poolToken = IPool(params.pool).poolToken();
        locals.stakeKey = keccak256(abi.encode(params.pool, params.positionId));

        // load previous stake
        locals.stake = limitStakes[locals.stakeKey];

        if (locals.stake.pool == address(0)) {
            require(false, 'LimitUnstake::StakeNotFound()');
        } else if (locals.stake.owner != msg.sender) {
            require(false, 'LimitUnstake::PositionOwnerMisMatch()');
        } else if (!locals.stake.isStaked) {
            require(false, 'LimitUnstake::PositionAlreadyUnstaked()');
        }

        // compound position to reward user for staked period
        (
            locals.token0Accrued,
            locals.token1Accrued
        ) = ILimitPool(params.pool).burnLimit(
            BurnLimitParams({
                to: params.to,
                positionId: params.positionId,
                burnPercent: 0,
                claim: params.claim,
                zeroForOne: params.zeroForOne
            })
        );

        // check if position still exists
        if (
            block.timestamp > startTimestamp && block.timestamp <= endTimestamp
        ) {
            uint256 tokenAccrued = locals.stake.zeroForOne ? locals.token0Accrued.toUint256()
                                                           : locals.token1Accrued.toUint256();
            emit StakeLimitAccrued(
                locals.stake.pool,
                locals.stake.positionId,
                tokenAccrued.toUint128(),
                locals.stake.zeroForOne
            );
        }

        (
            locals.newPositionLiquidity,
            ,,,
        ) = locals.stake.zeroForOne
            ? ILimitPoolStorageView(params.pool).positions0(locals.stake.positionId)
            : ILimitPoolStorageView(params.pool).positions1(locals.stake.positionId);

        // transfer position back to user
        if (locals.newPositionLiquidity > 0) {
            IPositionERC1155(locals.poolToken).safeTransferFrom(
                address(this),
                params.to,
                params.positionId,
                1
            );
        }


        // mark position unstaked
        locals.stake.liquidity = 0;
        locals.stake.isStaked = false;

        emit UnstakeLimit(
            locals.stake.pool,
            locals.stake.positionId,
            params.to
        );

        // store position stake in mapping
        delete limitStakes[locals.stakeKey];
    }

    function burnLimitStake(address pool, BurnLimitParams memory params)
        external
        nonReentrant
    {
        StakeLimitLocals memory locals;

        locals.stakeKey = keccak256(abi.encode(pool, params.positionId));

        // load previous stake
        locals.stake = limitStakes[locals.stakeKey];

        if (locals.stake.pool == address(0)) {
            require(false, 'BurnLimitStake::StakeNotFound()');
        } else if (locals.stake.owner != msg.sender) {
            require(false, 'BurnLimitStake::PositionOwnerMismatch()');
        } else if (!locals.stake.isStaked) {
            require(false, 'BurnLimitStake::PositionAlreadyUnstaked()');
        }

        // burn 0 to reward user for filled amounts
        (
            locals.token0Accrued,
            locals.token1Accrued
        ) = ILimitPool(pool).burnLimit(params);

        // start tracking fee growth from after compound
        (locals.stake.liquidity,,,,) = params.zeroForOne 
            ? ILimitPoolStorageView(pool).positions0(locals.stake.positionId)
            : ILimitPoolStorageView(pool).positions1(locals.stake.positionId);

        if (
            block.timestamp > startTimestamp && block.timestamp <= endTimestamp
        ) {
            uint256 tokenAccrued = locals.stake.zeroForOne ? locals.token0Accrued.toUint256()
                                                           : locals.token1Accrued.toUint256();
            emit StakeLimitAccrued(
                locals.stake.pool,
                locals.stake.positionId,
                tokenAccrued.toUint128(),
                locals.stake.zeroForOne
            );
        }

        if (locals.stake.liquidity == 0) {
            locals.stake.isStaked = false;
        }

        // store position stake in mapping
        limitStakes[locals.stakeKey] = locals.stake;
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
