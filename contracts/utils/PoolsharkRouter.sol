// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.18;

import '../interfaces/IPool.sol';
import '../interfaces/staking/IRangeStaker.sol';
import '../interfaces/IWETH9.sol';
import '../interfaces/range/IRangePool.sol';
import '../interfaces/limit/ILimitPool.sol';
import '../interfaces/limit/ILimitPoolView.sol';
import '../interfaces/cover/ICoverPool.sol';
import '../interfaces/cover/ICoverPoolFactory.sol';
import '../interfaces/limit/ILimitPoolFactory.sol';
import '../interfaces/callbacks/ILimitPoolCallback.sol';
import '../interfaces/callbacks/ICoverPoolCallback.sol';
import '../libraries/utils/SafeTransfers.sol';
import '../libraries/utils/SafeCast.sol';
import '../interfaces/structs/PoolsharkStructs.sol';
import '../external/solady/LibClone.sol';

/**
 * @title PoolsharkRouter
 * @notice The router for all limit and cover pools
 * @author Poolshark
 * @author @alphak3y
 */
contract PoolsharkRouter is
    PoolsharkStructs,
    ILimitPoolMintRangeCallback,
    ILimitPoolMintLimitCallback,
    ILimitPoolSwapCallback,
    ICoverPoolSwapCallback,
    ICoverPoolMintCallback
{
    using SafeCast for uint256;
    using SafeCast for int256;

    address public constant ethAddress = address(0);
    address public immutable wethAddress;
    address public immutable limitPoolFactory;
    address public immutable coverPoolFactory;

    event RouterDeployed(
        address router,
        address limitPoolFactory,
        address coverPoolFactory
    );

    struct MintRangeInputData {
        address staker;
    }

    struct MintRangeCallbackData {
        address sender;
        address recipient;
        bool wrapped;
    }

    struct MintLimitCallbackData {
        address sender;
        bool wrapped;
    }

    struct MintCoverCallbackData {
        address sender;
        bool wrapped;
    }

    struct SwapCallbackData {
        address sender;
        address recipient;
        bool wrapped;
    }

    constructor(
        address limitPoolFactory_,
        address coverPoolFactory_,
        address wethAddress_
    ) {
        limitPoolFactory = limitPoolFactory_;
        coverPoolFactory = coverPoolFactory_;
        wethAddress = wethAddress_;
        emit RouterDeployed(address(this), limitPoolFactory, coverPoolFactory);
    }

    receive() external payable {
        if (msg.sender != wethAddress) {
            require(false, 'PoolsharkRouter::ReceiveInvalid()');
        }
    }

    /// @inheritdoc ILimitPoolSwapCallback
    function limitPoolSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        PoolsharkStructs.LimitImmutables memory constants = ILimitPoolView(
            msg.sender
        ).immutables();

        // validate sender is a canonical limit pool
        canonicalLimitPoolsOnly(constants);

        // decode original msg.sender
        SwapCallbackData memory _data = abi.decode(data, (SwapCallbackData));

        // transfer from swap caller
        if (amount0Delta < 0) {
            if (constants.token0 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount0Delta));
            } else {
                SafeTransfers.transferInto(
                    constants.token0,
                    _data.sender,
                    uint256(-amount0Delta)
                );
            }
        }
        if (amount1Delta < 0) {
            if (constants.token1 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount1Delta));
            } else {
                SafeTransfers.transferInto(
                    constants.token1,
                    _data.sender,
                    uint256(-amount1Delta)
                );
            }
        }
        // transfer to swap caller
        if (amount0Delta > 0) {
            if (constants.token0 == wethAddress && _data.wrapped) {
                // unwrap WETH and send to recipient
                unwrapEth(_data.recipient, uint256(amount0Delta));
            }
        }
        if (amount1Delta > 0) {
            if (constants.token1 == wethAddress && _data.wrapped) {
                // unwrap WETH and send to recipient
                unwrapEth(_data.recipient, uint256(amount1Delta));
            }
        }
    }

    /// @inheritdoc ICoverPoolSwapCallback
    function coverPoolSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        PoolsharkStructs.CoverImmutables memory constants = ICoverPool(
            msg.sender
        ).immutables();

        // validate sender is a canonical cover pool
        canonicalCoverPoolsOnly(constants);

        // decode original sender
        SwapCallbackData memory _data = abi.decode(data, (SwapCallbackData));

        // transfer from swap caller
        if (amount0Delta < 0) {
            if (constants.token0 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount0Delta));
            } else {
                SafeTransfers.transferInto(
                    constants.token0,
                    _data.sender,
                    uint256(-amount0Delta)
                );
            }
        }
        if (amount1Delta < 0) {
            if (constants.token1 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount1Delta));
            } else {
                SafeTransfers.transferInto(
                    constants.token1,
                    _data.sender,
                    uint256(-amount1Delta)
                );
            }
        }
        if (amount0Delta > 0) {
            if (constants.token0 == wethAddress && _data.wrapped) {
                // unwrap WETH and send to recipient
                unwrapEth(_data.recipient, uint256(amount0Delta));
            }
        }
        if (amount1Delta > 0) {
            if (constants.token1 == wethAddress && _data.wrapped) {
                // unwrap WETH and send to recipient
                unwrapEth(_data.recipient, uint256(amount1Delta));
            }
        }
    }

    /// @inheritdoc ILimitPoolMintRangeCallback
    function limitPoolMintRangeCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        PoolsharkStructs.LimitImmutables memory constants = ILimitPoolView(
            msg.sender
        ).immutables();

        // validate sender is a canonical limit pool
        canonicalLimitPoolsOnly(constants);

        // decode original sender
        MintRangeCallbackData memory _data = abi.decode(
            data,
            (MintRangeCallbackData)
        );

        // transfer from swap caller
        if (amount0Delta < 0) {
            if (constants.token0 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount0Delta));
            } else {
                SafeTransfers.transferInto(
                    constants.token0,
                    _data.sender,
                    uint256(-amount0Delta)
                );
            }
        }
        if (amount1Delta < 0) {
            if (constants.token1 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount1Delta));
            } else {
                SafeTransfers.transferInto(
                    constants.token1,
                    _data.sender,
                    uint256(-amount1Delta)
                );
            }
        }
    }

    /// @inheritdoc ILimitPoolMintLimitCallback
    function limitPoolMintLimitCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        PoolsharkStructs.LimitImmutables memory constants = ILimitPoolView(
            msg.sender
        ).immutables();

        // validate sender is a canonical limit pool
        canonicalLimitPoolsOnly(constants);

        // decode original sender
        MintLimitCallbackData memory _data = abi.decode(
            data,
            (MintLimitCallbackData)
        );

        // transfer from swap caller
        if (amount0Delta < 0) {
            if (constants.token0 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount0Delta));
            } else {
                SafeTransfers.transferInto(
                    constants.token0,
                    _data.sender,
                    uint256(-amount0Delta)
                );
            }
        }
        if (amount1Delta < 0) {
            if (constants.token1 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount1Delta));
            } else {
                SafeTransfers.transferInto(
                    constants.token1,
                    _data.sender,
                    uint256(-amount1Delta)
                );
            }
        }
    }

    /// @inheritdoc ICoverPoolMintCallback
    function coverPoolMintCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        PoolsharkStructs.CoverImmutables memory constants = ICoverPool(
            msg.sender
        ).immutables();

        // validate sender is a canonical cover pool
        canonicalCoverPoolsOnly(constants);

        // decode original sender
        MintCoverCallbackData memory _data = abi.decode(
            data,
            (MintCoverCallbackData)
        );

        // transfer from swap caller
        if (amount0Delta < 0) {
            if (constants.token0 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount0Delta));
            } else {
                SafeTransfers.transferInto(
                    constants.token0,
                    _data.sender,
                    uint256(-amount0Delta)
                );
            }
        }
        if (amount1Delta < 0) {
            if (constants.token1 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount1Delta));
            } else {
                SafeTransfers.transferInto(
                    constants.token1,
                    _data.sender,
                    uint256(-amount1Delta)
                );
            }
        }
    }

    function multiMintLimit(
        address[] memory pools,
        MintLimitParams[] memory params
    ) external payable {
        if (pools.length != params.length)
            require(false, 'InputArrayLengthsMismatch()');
        for (uint256 i = 0; i < pools.length; ) {
            params[i].callbackData = abi.encode(
                MintLimitCallbackData({
                    sender: msg.sender,
                    wrapped: msg.value > 0
                })
            );
            ILimitPool(pools[i]).mintLimit(params[i]);
            unchecked {
                ++i;
            }
        }
        refundEth();
    }

    function multiMintRange(
        address[] memory pools,
        MintRangeParams[] memory params
    ) external payable {
        if (pools.length != params.length)
            require(false, 'InputArrayLengthsMismatch()');
        for (uint256 i = 0; i < pools.length; ) {
            address staker;
            {
                MintRangeCallbackData
                    memory callbackData = MintRangeCallbackData({
                        sender: msg.sender,
                        recipient: params[i].to,
                        wrapped: msg.value > 0
                    });
                staker = abi
                    .decode(params[i].callbackData, (MintRangeInputData))
                    .staker;
                if (staker != address(0)) {
                    params[i].to = staker;
                }
                params[i].callbackData = abi.encode(callbackData);
            }
            IRangePool(pools[i]).mintRange(params[i]);
            if (staker != address(0)) {
                IRangeStaker(staker).stakeRange(
                    StakeRangeParams({
                        to: abi
                            .decode(
                                params[i].callbackData,
                                (MintRangeCallbackData)
                            )
                            .recipient,
                        pool: pools[i],
                        positionId: params[i].positionId
                    })
                );
            }
            // call to staking contract using positionId returned from mintRange
            // fees and staked position will go to params.to
            unchecked {
                ++i;
            }
        }
        refundEth();
    }

    function multiMintCover(
        address[] memory pools,
        PoolsharkStructs.MintCoverParams[] memory params
    ) external payable {
        if (pools.length != params.length)
            require(false, 'InputArrayLengthsMismatch()');
        for (uint256 i = 0; i < pools.length; ) {
            params[i].callbackData = abi.encode(
                MintCoverCallbackData({
                    sender: msg.sender,
                    wrapped: msg.value > 0
                })
            );
            try ICoverPool(pools[i]).mint(params[i]) {} catch {}
            unchecked {
                ++i;
            }
        }
        refundEth();
    }

    function multiQuote(
        address[] memory pools,
        QuoteParams[] memory params,
        bool sortResults
    ) external view returns (QuoteResults[] memory results) {
        if (pools.length != params.length)
            require(false, 'InputArrayLengthsMismatch()');
        if (sortResults) {
            // if sorting results check for matching params
            for (uint256 i = 0; i < pools.length; ) {
                if (i > 0) {
                    if (params[i].zeroForOne != params[0].zeroForOne)
                        require(false, 'ZeroForOneParamMismatch()');
                    if (params[i].exactIn != params[0].exactIn)
                        require(false, 'ExactInParamMismatch()');
                    /// @dev - amount and priceLimit values are allowed to be different
                }
                unchecked {
                    ++i;
                }
            }
        }
        results = new QuoteResults[](pools.length);
        for (uint256 i = 0; i < pools.length; ) {
            results[i].pool = pools[i];
            (
                results[i].amountIn,
                results[i].amountOut,
                results[i].priceAfter
            ) = IPool(pools[i]).quote(params[i]);
            unchecked {
                ++i;
            }
        }
        // sort if true
        if (sortResults) {
            results = sortQuoteResults(params, results);
        }
    }

    function multiSwapSplit(
        address[] memory pools,
        SwapParams memory params
        // uint128 amountRequired,
        // uint32 deadline
    )
        external
        payable
    {
        // checkDeadline(deadline);
        uint128 amountTotal;
        for (uint256 i = 0; i < pools.length && params.amount > 0; ) {
            // if msg.value > 0 we either need to wrap or unwrap the native gas token
            params.callbackData = abi.encode(
                SwapCallbackData({
                    sender: msg.sender,
                    recipient: params.to,
                    wrapped: msg.value > 0
                })
            );
            if (msg.value > 0) {
                IPool pool = IPool(pools[i]);
                address tokenIn = params.zeroForOne
                    ? pool.token0()
                    : pool.token1();
                address tokenOut = params.zeroForOne
                    ? pool.token1()
                    : pool.token0();
                if (tokenOut == wethAddress) {
                    // send weth to router for unwrapping
                    params.to = address(this);
                } else if (tokenIn != wethAddress) {
                    require(false, 'NonNativeTokenPair()');
                }
            }
            (int256 amount0Delta, int256 amount1Delta) = IPool(pools[i]).swap(
                params
            );
            // if there is another pool to swap against
            if ((i + 1) < pools.length) {
                // calculate amount left and set for next call
                if (params.zeroForOne) {
                    if (params.exactIn) {
                        // tokenIn / token0 spent
                        params.amount -= (-amount0Delta).toUint256().toUint128();
                        // tokenOut / token1 received
                        amountTotal += (amount1Delta).toUint256().toUint128();
                    } else {
                        // tokenOut / token1 received
                        params.amount -= (amount1Delta).toUint256().toUint128();
                        // tokenIn / token1 spent
                        amountTotal += (-amount0Delta).toUint256().toUint128();
                    }
                } else {
                    if (params.exactIn) {
                        // tokenIn / token1 spent
                        params.amount -= (-amount1Delta).toUint256().toUint128();
                        // tokenOut / token0 received
                        amountTotal += (amount0Delta).toUint256().toUint128();
                    } else {
                        // tokenOut / token0 received
                        params.amount -= (amount0Delta).toUint256().toUint128();
                        // tokenIn / token1 spent
                        amountTotal += (-amount1Delta).toUint256().toUint128();
                    }
                }
            }
            unchecked {
                ++i;
            }
        }
        // if (params.exactIn) {
        //     if (amountTotal < amountRequired) {
        //         require(false, 'PoolsharkRouter::AmountOutBelowRequired()');
        //     }
        // } else {
        //     if (amountTotal > amountRequired) {
        //         require(false, 'PoolsharkRouter::AmountInAboveRequired()');
        //     }
        // }
        refundEth();
    }

    function multiSnapshotLimit(
        address[] memory pools,
        SnapshotLimitParams[] memory params
    )
        external
        view
        returns (uint128[] memory amountIns, uint128[] memory amountOuts)
    {
        amountIns = new uint128[](pools.length);
        amountOuts = new uint128[](pools.length);
        for (uint256 i = 0; i < pools.length; ) {
            if (pools[i] == address(0)) require(false, 'PoolsharkRouter::InvalidPoolAddress()');
            (amountIns[i], amountOuts[i]) = ILimitPoolView(pools[i])
                .snapshotLimit(params[i]);
            unchecked {
                ++i;
            }
        }
    }

    function createLimitPoolAndMint(
        ILimitPoolFactory.LimitPoolParams memory params,
        MintRangeParams[] memory mintRangeParams,
        MintLimitParams[] memory mintLimitParams
    ) external payable returns (address pool, address poolToken) {
        // check if pool exists
        (pool, poolToken) = ILimitPoolFactory(limitPoolFactory).getLimitPool(
            params.tokenIn,
            params.tokenOut,
            params.swapFee,
            params.poolTypeId
        );
        // create if pool doesn't exist
        if (pool == address(0)) {
            (pool, poolToken) = ILimitPoolFactory(limitPoolFactory)
                .createLimitPool(params);
        }
        // mint initial range positions
        for (uint256 i = 0; i < mintRangeParams.length; ) {
            address staker;
            {
                mintRangeParams[i].positionId = 0;
                MintRangeCallbackData
                    memory callbackData = MintRangeCallbackData({
                        sender: msg.sender,
                        recipient: mintRangeParams[i].to,
                        wrapped: msg.value > 0
                    });
                staker = abi
                    .decode(
                        mintRangeParams[i].callbackData,
                        (MintRangeInputData)
                    )
                    .staker;
                if (staker != address(0)) {
                    mintRangeParams[i].to = staker;
                }
                mintRangeParams[i].callbackData = abi.encode(callbackData);
            }
            try IRangePool(pool).mintRange(mintRangeParams[i]) {} catch {}
            if (staker != address(0)) {
                IRangeStaker(staker).stakeRange(
                    StakeRangeParams({
                        to: abi
                            .decode(
                                mintRangeParams[i].callbackData,
                                (MintRangeCallbackData)
                            )
                            .recipient,
                        pool: pool,
                        positionId: 0
                    })
                );
            }
            unchecked {
                ++i;
            }
        }
        // mint initial limit positions
        for (uint256 i = 0; i < mintLimitParams.length; ) {
            mintLimitParams[i].positionId = 0;
            mintLimitParams[i].callbackData = abi.encode(
                MintLimitCallbackData({
                    sender: msg.sender,
                    wrapped: msg.value > 0
                })
            );
            ILimitPool(pool).mintLimit(mintLimitParams[i]);
            unchecked {
                ++i;
            }
        }
        refundEth();
    }

    function createCoverPoolAndMint(
        ICoverPoolFactory.CoverPoolParams memory params,
        MintCoverParams[] memory mintCoverParams
    ) external payable returns (address pool, address poolToken) {
        // check if pool exists
        (pool, poolToken) = ICoverPoolFactory(coverPoolFactory).getCoverPool(
            params
        );
        // create if pool doesn't exist
        if (pool == address(0)) {
            (pool, poolToken) = ICoverPoolFactory(coverPoolFactory)
                .createCoverPool(params);
        }
        // mint initial cover positions
        for (uint256 i = 0; i < mintCoverParams.length; ) {
            mintCoverParams[i].positionId = 0;
            mintCoverParams[i].callbackData = abi.encode(
                MintCoverCallbackData({
                    sender: msg.sender,
                    wrapped: msg.value > 0
                })
            );
            try ICoverPool(pool).mint(mintCoverParams[i]) {} catch {}
            unchecked {
                ++i;
            }
        }
        refundEth();
    }

    struct SortQuoteResultsLocals {
        QuoteResults[] sortedResults;
        QuoteResults[] prunedResults;
        bool[] sortedFlags;
        uint256 emptyResults;
        int256 sortAmount;
        uint256 sortIndex;
        uint256 prunedIndex;
    }

    function sortQuoteResults(
        QuoteParams[] memory params,
        QuoteResults[] memory results
    ) internal pure returns (QuoteResults[] memory) {
        SortQuoteResultsLocals memory locals;
        locals.sortedResults = new QuoteResults[](results.length);
        locals.sortedFlags = new bool[](results.length);
        locals.emptyResults = 0;
        for (uint256 sorted = 0; sorted < results.length; ) {
            // if exactIn, sort by most output
            // if exactOut, sort by most output then least input
            locals.sortAmount = params[0].exactIn
                ? int256(0)
                : type(int256).max;
            locals.sortIndex = type(uint256).max;
            for (uint256 index = 0; index < results.length; ) {
                // check if result already sorted
                if (!locals.sortedFlags[index]) {
                    if (params[0].exactIn) {
                        if (
                            results[index].amountOut > 0 &&
                            results[index].amountOut >= locals.sortAmount
                        ) {
                            locals.sortIndex = index;
                            locals.sortAmount = results[index].amountOut;
                        }
                    } else {
                        if (
                            results[index].amountIn > 0 &&
                            results[index].amountIn <= locals.sortAmount
                        ) {
                            locals.sortIndex = index;
                            locals.sortAmount = results[index].amountIn;
                        }
                    }
                }
                // continue finding nth element
                unchecked {
                    ++index;
                }
            }
            if (locals.sortIndex != type(uint256).max) {
                // add the sorted result
                locals.sortedResults[sorted].pool = results[locals.sortIndex]
                    .pool;
                locals.sortedResults[sorted].amountIn = results[
                    locals.sortIndex
                ].amountIn;
                locals.sortedResults[sorted].amountOut = results[
                    locals.sortIndex
                ].amountOut;
                locals.sortedResults[sorted].priceAfter = results[
                    locals.sortIndex
                ].priceAfter;

                // indicate this result was already sorted
                locals.sortedFlags[locals.sortIndex] = true;
            } else {
                ++locals.emptyResults;
            }
            // find next sorted element
            unchecked {
                ++sorted;
            }
        }
        // if any results were empty, prune them
        if (locals.emptyResults > 0) {
            locals.prunedResults = new QuoteResults[](
                results.length - locals.emptyResults
            );
            locals.prunedIndex = 0;
            for (uint256 sorted = 0; sorted < results.length; ) {
                // empty results are omitted
                if (locals.sortedResults[sorted].pool != address(0)) {
                    locals.prunedResults[locals.prunedIndex] = locals
                        .sortedResults[sorted];
                    unchecked {
                        ++locals.prunedIndex;
                    }
                }
                unchecked {
                    ++sorted;
                }
            }
        } else {
            locals.prunedResults = locals.sortedResults;
        }
        return locals.prunedResults;
    }

    function multiCall(address[] memory pools, SwapParams[] memory params)
        external
    {
        if (pools.length != params.length)
            require(false, 'InputArrayLengthsMismatch()');
        for (uint256 i = 0; i < pools.length; ) {
            params[i].callbackData = abi.encode(
                SwapCallbackData({
                    sender: msg.sender,
                    recipient: params[i].to,
                    wrapped: true
                })
            );
            ICoverPool(pools[i]).swap(params[i]);
            unchecked {
                ++i;
            }
        }
    }

    function deployTge(address tgePool, address staker) external {
        // read pool price
        RangePoolState memory tgePoolState;
        (tgePoolState, , , , , , ) = IPool(tgePool).globalState();
        uint160 expectedPoolPrice = 2172618421097231267834892073346;
        if (tgePoolState.price < expectedPoolPrice) {
            // move pool price up if below
            SwapParams memory swapParams = SwapParams({
                to: msg.sender,
                priceLimit: expectedPoolPrice,
                amount: 1000e18,
                exactIn: true,
                zeroForOne: false,
                callbackData: abi.encode(
                    SwapCallbackData({
                        sender: msg.sender,
                        recipient: msg.sender,
                        wrapped: false
                    })
                )
            });
            IPool(tgePool).swap(swapParams);
        } else if (tgePoolState.price > expectedPoolPrice) {
            // move pool price down if above
            SwapParams memory swapParams = SwapParams({
                to: msg.sender,
                priceLimit: expectedPoolPrice,
                amount: 1e18,
                exactIn: true,
                zeroForOne: true,
                callbackData: abi.encode(
                    SwapCallbackData({
                        sender: msg.sender,
                        recipient: msg.sender,
                        wrapped: false
                    })
                )
            });
            IPool(tgePool).swap(swapParams);
        }
        // read pool price
        (tgePoolState, , , , , , ) = IPool(tgePool).globalState();
        if (tgePoolState.price != expectedPoolPrice)
            require(false, 'PoolPriceMismatch()');
        MintRangeCallbackData memory callbackData = MintRangeCallbackData({
            sender: msg.sender,
            recipient: staker != address(0) ? staker : msg.sender,
            wrapped: false
        });
        MintRangeParams memory mintRangeParams = MintRangeParams({
            to: staker,
            lower: 54000,
            upper: 77040,
            positionId: 0,
            amount0: 39168000000000000000,
            amount1: 33000000000000000000000,
            callbackData: abi.encode(callbackData)
        });
        IRangePool(tgePool).mintRange(mintRangeParams);
        if (staker != address(0)) {
            IRangeStaker(staker).stakeRange(
                StakeRangeParams({to: msg.sender, pool: tgePool, positionId: 0})
            );
        }
    }

    function canonicalLimitPoolsOnly(
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
        if (msg.sender != predictedAddress)
            require(false, 'InvalidCallerAddress()');
    }

    function checkDeadline(
        uint32 deadline
    ) private view {
        if (block.timestamp > deadline) {
            require(false, 'PoolsharkRouter::DeadlineExpired()');
        }
    }

    function canonicalCoverPoolsOnly(
        PoolsharkStructs.CoverImmutables memory constants
    ) private view {
        // generate key for pool
        bytes32 key = keccak256(
            abi.encode(
                constants.token0,
                constants.token1,
                constants.source,
                constants.inputPool,
                constants.tickSpread,
                constants.twapLength
            )
        );

        // compute address
        address predictedAddress = LibClone.predictDeterministicAddress(
            constants.poolImpl,
            encodeCover(constants),
            key,
            coverPoolFactory
        );

        // revert on sender mismatch
        if (msg.sender != predictedAddress)
            require(false, 'InvalidCallerAddress()');
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

    function encodeCover(CoverImmutables memory constants)
        private
        pure
        returns (bytes memory)
    {
        bytes memory value1 = abi.encodePacked(
            constants.owner,
            constants.token0,
            constants.token1,
            constants.source,
            constants.poolToken,
            constants.inputPool,
            constants.bounds.min,
            constants.bounds.max
        );
        bytes memory value2 = abi.encodePacked(
            constants.minAmountPerAuction,
            constants.genesisTime,
            constants.minPositionWidth,
            constants.tickSpread,
            constants.twapLength,
            constants.auctionLength
        );
        bytes memory value3 = abi.encodePacked(
            constants.sampleInterval,
            constants.token0Decimals,
            constants.token1Decimals,
            constants.minAmountLowerPriced
        );
        return abi.encodePacked(value1, value2, value3);
    }

    function wrapEth(uint256 amount) private {
        // wrap necessary amount of WETH
        IWETH9 weth = IWETH9(wethAddress);
        if (amount > address(this).balance)
            require(false, 'WrapEth::LowEthBalance()');
        weth.deposit{value: amount}();
        // transfer weth into pool
        SafeTransfers.transferOut(msg.sender, wethAddress, amount);
    }

    function unwrapEth(address recipient, uint256 amount) private {
        IWETH9 weth = IWETH9(wethAddress);
        // unwrap WETH and send to recipient
        weth.withdraw(amount);
        // send balance to recipient
        SafeTransfers.transferOut(recipient, ethAddress, amount);
    }

    function refundEth() private {
        if (address(this).balance > 0) {
            if (address(this).balance >= msg.value) {
                SafeTransfers.transferOut(msg.sender, ethAddress, msg.value);
            } else {
                SafeTransfers.transferOut(
                    msg.sender,
                    ethAddress,
                    address(this).balance
                );
            }
        }
    }
}
