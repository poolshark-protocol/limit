// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.18;

/// @notice Events emitted by the LimitPool contract(s)
abstract contract LimitPoolEvents {
    /// @notice Event emitted when pool is initialized by the factory
    event Initialize(
        int24 minTick,
        int24 maxTick,
        uint160 startPrice,
        int24 startTick
    );

    /// @notice Event emitted when a swap is successful
    event Swap(
        address indexed recipient,
        uint256 amountIn,
        uint256 amountOut,
        uint200 feeGrowthGlobal0,
        uint200 feeGrowthGlobal1,
        uint160 price,
        uint128 liquidity,
        uint128 feeAmount,
        int24 tickAtPrice,
        bool indexed zeroForOne,
        bool indexed exactIn
    );

    /// @notice Event emitted when liquidity added to RangePosition
    event MintRange(
        address indexed recipient,
        int24 lower,
        int24 upper,
        uint32 indexed positionId,
        uint128 liquidityMinted,
        int128 amount0Delta,
        int128 amount1Delta
    );

    /// @notice Event emitted when liquidity removed from RangePosition
    event BurnRange(
        address indexed recipient,
        uint256 indexed positionId,
        uint128 liquidityBurned,
        int128 amount0,
        int128 amount1
    );

    /// @notice Event emitted when liquidity is added as a result of calling `burnRange`
    event CompoundRange(uint32 indexed positionId, uint128 liquidityCompounded);

    /// @notice Event emitted when token0 is collected from the pool
    event CollectRange0(uint128 amount0);

    /// @notice Event emitted when token1 is collected from the pool
    event CollectRange1(uint128 amount1);

    /// @notice Event emitted when a RangeTick is updated
    event SyncRangeTick(
        uint200 feeGrowthOutside0,
        uint200 feeGrowthOutside1,
        int24 tick
    );

    /// @notice Event emitted when liquidity is added to a LimitPosition
    event MintLimit(
        address indexed to,
        int24 lower,
        int24 upper,
        bool zeroForOne,
        uint32 positionId,
        uint32 epochLast,
        uint128 amountIn,
        uint128 liquidityMinted
    );

    /// @notice Event emitted when liquidity is removed from a LimitPosition
    event BurnLimit(
        address indexed to,
        uint32 positionId,
        int24 lower,
        int24 upper,
        int24 oldClaim,
        int24 newClaim,
        bool zeroForOne,
        uint128 liquidityBurned,
        uint128 tokenInClaimed,
        uint128 tokenOutBurned
    );

    /// @notice Event emitted when a LimitPosition undercuts pool0 or pool1
    event SyncLimitPool(
        uint160 price,
        uint128 liquidity,
        uint32 epoch,
        int24 tickAtPrice,
        bool isPool0
    );

    /// @notice Event emitted when a LimitTick is created via undercutting
    event SyncLimitLiquidity(
        uint128 liquidityAdded,
        int24 tick,
        bool zeroForOne
    );

    /// @notice Event emitted when a LimitTick is crossed or initialized
    event SyncLimitTick(uint32 epoch, int24 tick, bool zeroForOne);

    /// @notice Event emitted when an oracle sample is recorded
    event SampleRecorded(
        int56 tickSecondsAccum,
        uint160 secondsPerLiquidityAccum
    );

    /// @notice Event emitted when max sample count is increased
    event SampleCountIncreased(uint16 newSampleCountMax);
}
