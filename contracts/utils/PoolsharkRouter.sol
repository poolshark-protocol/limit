// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../interfaces/IPool.sol';
import '../interfaces/limit/ILimitPool.sol';
import '../interfaces/cover/ICoverPool.sol';
import '../interfaces/callbacks/ILimitPoolSwapCallback.sol';
import '../interfaces/callbacks/ICoverPoolSwapCallback.sol';
import '../libraries/utils/SafeTransfers.sol';
import '../libraries/utils/SafeCast.sol';
import '../interfaces/structs/PoolsharkStructs.sol';
import '../external/solady/LibClone.sol';

contract PoolsharkRouter is
    PoolsharkStructs,
    ILimitPoolSwapCallback,
    ICoverPoolSwapCallback
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

        // decode original sender
        SwapCallbackData memory _data = abi.decode(data, (SwapCallbackData));
        
        // transfer from swap caller
        if (amount0Delta < 0) {
            SafeTransfers.transferInto(constants.token0, _data.sender, uint256(-amount0Delta));
        } else {
            SafeTransfers.transferInto(constants.token1, _data.sender, uint256(-amount1Delta));
        }
    }

    function coverPoolSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        PoolsharkStructs.CoverImmutables memory constants = ICoverPool(msg.sender).immutables();

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

        // decode original sender
        SwapCallbackData memory _data = abi.decode(data, (SwapCallbackData));
        
        // transfer from swap caller
        if (amount0Delta < 0) {
            SafeTransfers.transferInto(constants.token0, _data.sender, uint256(-amount0Delta));
        } else {
            SafeTransfers.transferInto(constants.token1, _data.sender, uint256(-amount1Delta));
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
                    if (params[i].amount != params[0].amount) require(false, 'AmountParamMisMatch()');
                    /// @dev - priceLimit values are allowed to be different
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

    function sortQuoteResults(
        QuoteParams[] memory params,
        QuoteResults[] memory results
    ) internal pure returns (
        QuoteResults[] memory sortedResults
    ) {
            sortedResults = new QuoteResults[](results.length);
            for (uint sorted = 0; sorted < results.length;) {
                // if exactIn, sort by most output
                // if exactOut, sort by least input
                int256 sortAmount = params[0].exactIn ? int256(0) : type(int256).max;
                uint256 sortIndex = type(uint256).max;
                for (uint index = 0; index < (results.length - sorted);) {
                    // check if result already sorted
                    if (results[index].priceAfter > 0) {
                        if (params[0].exactIn) {
                            if (results[index].amountOut >= sortAmount) {
                                sortIndex = index;
                                sortAmount = results[index].amountOut;
                            }
                        } else {
                           if (results[index].amountIn <= sortAmount) {
                                sortIndex = index;
                                sortAmount = results[index].amountIn;
                            }
                        }
                    }
                    if (sortIndex != type(uint256).max) {
                        // add the sorted result
                        sortedResults[sorted] = results[sortIndex];

                        // indicate this result was already sorted
                        results[sortIndex].priceAfter = 0;
                    }
                    // continue finding nth element
                    unchecked {
                        ++index;
                    }
                }
                // find next sorted element
                unchecked {
                    ++sorted;
                }
            }
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
            constants.inputPool,
            constants.bounds.min,
            constants.bounds.max,
            constants.minAmountPerAuction,
            constants.genesisTime,
            constants.minPositionWidth,
            constants.tickSpread,
            constants.twapLength,
            constants.auctionLength
        );
        bytes memory value2 = abi.encodePacked(
            constants.blockTime,
            constants.token0Decimals,
            constants.token1Decimals,
            constants.minAmountLowerPriced
        );
        return abi.encodePacked(value1, value2);
    }
}