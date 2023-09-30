// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../interfaces/IPool.sol';
import '../interfaces/range/IRangePool.sol';
import '../interfaces/limit/ILimitPool.sol';
import '../interfaces/cover/ICoverPool.sol';
import '../interfaces/cover/ICoverPoolFactory.sol';
import '../interfaces/limit/ILimitPoolFactory.sol';
import '../interfaces/callbacks/ILimitPoolCallback.sol';
import '../interfaces/callbacks/ICoverPoolCallback.sol';
import '../libraries/utils/SafeTransfers.sol';
import '../libraries/utils/SafeCast.sol';
import '../interfaces/structs/PoolsharkStructs.sol';
import '../external/solady/LibClone.sol';

contract PoolsharkRouter is
    PoolsharkStructs,
    ILimitPoolMintCallback,
    ILimitPoolSwapCallback,
    ICoverPoolSwapCallback,
    ICoverPoolMintCallback
{
    using SafeCast for uint256;
    using SafeCast for int256;

    address public immutable limitPoolFactory;
    address public immutable coverPoolFactory;

    event RouterDeployed(
        address router,
        address limitPoolFactory,
        address coverPoolFactory
    );

    struct MintCallbackData {
        address sender;
    }

    struct SwapCallbackData {
        address sender;
    }

    constructor(
        address limitPoolFactory_,
        address coverPoolFactory_
    ) {
        limitPoolFactory = limitPoolFactory_;
        coverPoolFactory = coverPoolFactory_;
        emit RouterDeployed(
            address(this),
            limitPoolFactory,
            coverPoolFactory
        );
    }

    /// @inheritdoc ILimitPoolSwapCallback
    function limitPoolSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        PoolsharkStructs.LimitImmutables memory constants = ILimitPool(msg.sender).immutables();

        // validate sender is a canonical limit pool
        canonicalLimitPoolsOnly(constants);

        // decode original sender
        SwapCallbackData memory _data = abi.decode(data, (SwapCallbackData));
        
        // transfer from swap caller
        if (amount0Delta < 0) {
            SafeTransfers.transferInto(constants.token0, _data.sender, uint256(-amount0Delta));
        }
        if (amount1Delta < 0) {
            SafeTransfers.transferInto(constants.token1, _data.sender, uint256(-amount1Delta));
        }
    }

    /// @inheritdoc ICoverPoolSwapCallback
    function coverPoolSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        PoolsharkStructs.CoverImmutables memory constants = ICoverPool(msg.sender).immutables();

        // validate sender is a canonical cover pool
        canonicalCoverPoolsOnly(constants);

        // decode original sender
        SwapCallbackData memory _data = abi.decode(data, (SwapCallbackData));
        
        // transfer from swap caller
        if (amount0Delta < 0) {
            SafeTransfers.transferInto(constants.token0, _data.sender, uint256(-amount0Delta));
        }
        if (amount1Delta < 0) {
            SafeTransfers.transferInto(constants.token1, _data.sender, uint256(-amount1Delta));
        }
    }

    /// @inheritdoc ILimitPoolMintCallback
    function limitPoolMintCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        PoolsharkStructs.LimitImmutables memory constants = ILimitPool(msg.sender).immutables();

        // validate sender is a canonical limit pool
        canonicalLimitPoolsOnly(constants);

        // decode original sender
        MintCallbackData memory _data = abi.decode(data, (MintCallbackData));
        
        // transfer from swap caller
        if (amount0Delta < 0) {
            SafeTransfers.transferInto(constants.token0, _data.sender, uint256(-amount0Delta));
        }
        if (amount1Delta < 0) {
            SafeTransfers.transferInto(constants.token1, _data.sender, uint256(-amount1Delta));
        }
    }

    /// @inheritdoc ICoverPoolMintCallback
    function coverPoolMintCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        PoolsharkStructs.CoverImmutables memory constants = ICoverPool(msg.sender).immutables();

        // validate sender is a canonical cover pool
        canonicalCoverPoolsOnly(constants);

        // decode original sender
        MintCallbackData memory _data = abi.decode(data, (MintCallbackData));

        // transfer from swap caller
        if (amount0Delta < 0) {
            SafeTransfers.transferInto(constants.token0, _data.sender, uint256(-amount0Delta));
        }
        if (amount1Delta < 0) {
            SafeTransfers.transferInto(constants.token1, _data.sender, uint256(-amount1Delta));
        }
    }

    function multiMintLimit(
        address[] memory pools,
        MintLimitParams[] memory params
    ) external {
        if (pools.length != params.length) require(false, 'InputArrayLengthsMismatch()');
        for (uint i = 0; i < pools.length;) {
            params[i].callbackData = abi.encode(MintCallbackData({sender: msg.sender}));
            ILimitPool(pools[i]).mintLimit(params[i]);
            unchecked {
                ++i;
            }
        }
    }

    function multiMintRange(
        address[] memory pools,
        MintRangeParams[] memory params
    ) external {
        if (pools.length != params.length) require(false, 'InputArrayLengthsMismatch()');
        for (uint i = 0; i < pools.length;) {
            params[i].callbackData = abi.encode(MintCallbackData({sender: msg.sender}));
            IRangePool(pools[i]).mintRange(params[i]);
            unchecked {
                ++i;
            }
        }
    }

    function multiMintCover(
        address[] memory pools,
        PoolsharkStructs.MintCoverParams[] memory params
    ) external {
        if (pools.length != params.length) require(false, 'InputArrayLengthsMismatch()');
        for (uint i = 0; i < pools.length;) {
            params[i].callbackData = abi.encode(MintCallbackData({sender: msg.sender}));
            ICoverPool(pools[i]).mint(params[i]);
            unchecked {
                ++i;
            }
        }
    }

    function multiQuote(
        address[] memory pools,
        QuoteParams[] memory params,
        bool sortResults 
    ) external view returns (
        QuoteResults[] memory results
    )
    {
        if (pools.length != params.length) require(false, 'InputArrayLengthsMismatch()');
        if (sortResults) {
            // if sorting results check for matching params
            for (uint i = 0; i < pools.length;) {
                if (i > 0) {
                    if (params[i].zeroForOne != params[0].zeroForOne) require (false, 'ZeroForOneParamMismatch()');
                    if (params[i].exactIn != params[0].exactIn) require(false, 'ExactInParamMismatch()');
                    /// @dev - amount and priceLimit values are allowed to be different
                }
                unchecked {
                    ++i;
                }
            }
        }
        results = new QuoteResults[](pools.length);
        for (uint i = 0; i < pools.length;) {
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
        SwapParams[] memory params 
    ) external {
        if (pools.length != params.length) require(false, 'InputArrayLengthsMismatch()');
        for (uint i = 0; i < pools.length;) {
            if (i > 0) {
                if (params[i].zeroForOne != params[0].zeroForOne) require (false, 'ZeroForOneParamMismatch()');
                if (params[i].exactIn != params[0].exactIn) require(false, 'ExactInParamMismatch()');
                if (params[i].amount != params[0].amount) require(false, 'AmountParamMisMatch()');
            }
            unchecked {
                ++i;
            }
        }
        for (uint i = 0; i < pools.length && params[0].amount > 0;) {
            params[i].callbackData = abi.encode(SwapCallbackData({sender: msg.sender}));
            (
                int256 amount0Delta,
                int256 amount1Delta
            ) = IPool(pools[i]).swap(params[i]);
            // if there is another pool to swap against
            if ((i + 1) < pools.length) {
                // calculate amount left and set for next call
                if (params[0].zeroForOne && params[0].exactIn) {
                    params[0].amount -= (-amount0Delta).toUint256().toUint128();
                } else if (params[0].zeroForOne && !params[0].exactIn) {
                    params[0].amount -= (amount1Delta).toUint256().toUint128();
                } else if (!params[0].zeroForOne && !params[0].exactIn) {
                    params[0].amount -= (amount0Delta).toUint256().toUint128();
                } else if (!params[0].zeroForOne && params[0].exactIn) {
                    params[0].amount -= (-amount1Delta).toUint256().toUint128();
                }
                params[i+1].amount = params[0].amount;
            }
            unchecked {
                ++i;
            }
        }
    }

    function createLimitPoolAndMint(
        ILimitPoolFactory.LimitPoolParams memory params,
        MintRangeParams[] memory mintRangeParams,
        MintLimitParams[] memory mintLimitParams
    ) external returns (
        address pool,
        address poolToken 
    ) {
        // check if pool exists
        (
            pool,
            poolToken
        ) = ILimitPoolFactory(limitPoolFactory).getLimitPool(
            params.poolType,
            params.tokenIn,
            params.tokenOut,
            params.swapFee
        );
        // create if pool doesn't exist
        if (pool == address(0)) {
            (
                pool,
                poolToken
            ) = ILimitPoolFactory(limitPoolFactory).createLimitPool(
                params
            );
        }
        // mint initial range positions
        for (uint i = 0; i < mintRangeParams.length;) {
            IRangePool(pool).mintRange(mintRangeParams[i]);
            unchecked {
                ++i;
            }
        }
        // mint initial limit positions
        for (uint i = 0; i < mintLimitParams.length;) {
            ILimitPool(pool).mintLimit(mintLimitParams[i]);
            unchecked {
                ++i;
            }
        }
    }

    function createCoverPoolAndMint(
        ICoverPoolFactory.CoverPoolParams memory params,
        MintCoverParams[] memory mintCoverParams
    ) external returns (
        address pool,
        address poolToken 
    ) {
        // check if pool exists
        (
            pool,
            poolToken
        ) = ICoverPoolFactory(coverPoolFactory).getCoverPool(
            params
        );
        // create if pool doesn't exist
        if (pool == address(0)) {
            (
                pool,
                poolToken
            ) = ICoverPoolFactory(coverPoolFactory).createCoverPool(
                params
            );
        }
        // mint initial cover positions
        for (uint i = 0; i < mintCoverParams.length;) {
            ICoverPool(pool).mint(mintCoverParams[i]);
            unchecked {
                ++i;
            }
        }
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
    ) internal pure returns (
        QuoteResults[] memory
    ) {
        SortQuoteResultsLocals memory locals;
        locals.sortedResults = new QuoteResults[](results.length);
        locals.sortedFlags = new bool[](results.length);
        locals.emptyResults = 0;
        for (uint sorted = 0; sorted < results.length;) {
            // if exactIn, sort by most output
            // if exactOut, sort by least input
            locals.sortAmount = params[0].exactIn ? int256(0) : type(int256).max;
            locals.sortIndex = type(uint256).max;
            for (uint index = 0; index < results.length;) {
                // check if result already sorted
                if (!locals.sortedFlags[index]) {
                    if (params[0].exactIn) {
                        if (results[index].amountOut >= locals.sortAmount) {
                            locals.sortIndex = index;
                            locals.sortAmount = results[index].amountOut;
                        }
                    } else {
                        if (results[index].amountIn <= locals.sortAmount) {
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
                locals.sortedResults[sorted].pool = results[locals.sortIndex].pool;
                locals.sortedResults[sorted].amountIn = results[locals.sortIndex].amountIn;
                locals.sortedResults[sorted].amountOut = results[locals.sortIndex].amountOut;
                locals.sortedResults[sorted].priceAfter = results[locals.sortIndex].priceAfter;

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
            locals.prunedResults = new QuoteResults[](results.length - locals.emptyResults);
            locals.prunedIndex = 0;
            for (uint sorted = 0; sorted < results.length;) {
                // empty results are omitted
                if (locals.sortedResults[sorted].pool != address(0)) {
                    locals.prunedResults[locals.prunedIndex] = locals.sortedResults[sorted];
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

    function canonicalLimitPoolsOnly(
        PoolsharkStructs.LimitImmutables memory constants
    ) private view {
        // generate key for pool
        bytes32 key = keccak256(abi.encode(
            constants.poolImpl,
            constants.token0,
            constants.token1,
            constants.swapFee
        ));

        // compute address
        address predictedAddress = LibClone.predictDeterministicAddress(
            constants.poolImpl,
            encodeLimit(constants),
            key,
            limitPoolFactory
        );

        // revert on sender mismatch
        if (msg.sender != predictedAddress) require(false, 'InvalidCallerAddress()');
    }

    function canonicalCoverPoolsOnly(
        PoolsharkStructs.CoverImmutables memory constants
    ) private view {
        // generate key for pool
        bytes32 key = keccak256(abi.encode(
            constants.token0,
            constants.token1,
            constants.source,
            constants.inputPool,
            constants.tickSpread,
            constants.twapLength
        ));

        // compute address
        address predictedAddress = LibClone.predictDeterministicAddress(
            constants.poolImpl,
            encodeCover(constants),
            key,
            coverPoolFactory
        );

        // revert on sender mismatch
        if (msg.sender != predictedAddress) require(false, 'InvalidCallerAddress()');
    }

    function encodeLimit(
        LimitImmutables memory constants
    ) private pure returns (bytes memory) {
        return abi.encodePacked(
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

    function encodeCover(
        CoverImmutables memory constants
    ) private pure returns (bytes memory) {
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
}