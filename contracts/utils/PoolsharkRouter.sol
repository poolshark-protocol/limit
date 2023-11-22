// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../interfaces/IPool.sol';
import '../interfaces/IWETH9.sol';
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

    address public constant ethAddress = address(0);
    address public immutable wethAddress;
    address public immutable limitPoolFactory;
    address public immutable coverPoolFactory;

    event RouterDeployed(
        address router,
        address limitPoolFactory,
        address coverPoolFactory
    );

    struct MintCallbackData {
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
        emit RouterDeployed(
            address(this),
            limitPoolFactory,
            coverPoolFactory
        );
    }

    receive() external payable {}

    /// @inheritdoc ILimitPoolSwapCallback
    function limitPoolSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        PoolsharkStructs.LimitImmutables memory constants = ILimitPool(msg.sender).immutables();

        // validate sender is a canonical limit pool
        canonicalLimitPoolsOnly(constants);

        // decode original msg.sender
        SwapCallbackData memory _data = abi.decode(data, (SwapCallbackData));
        
        // transfer from swap caller
        if (amount0Delta < 0) {
            if (constants.token0 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount0Delta));
            } else {
                SafeTransfers.transferInto(constants.token0, _data.sender, uint256(-amount0Delta));   
            }
        }
        if (amount1Delta < 0) {
            if (constants.token1 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount1Delta));
            } else {
                SafeTransfers.transferInto(constants.token1, _data.sender, uint256(-amount1Delta));
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
        PoolsharkStructs.CoverImmutables memory constants = ICoverPool(msg.sender).immutables();

        // validate sender is a canonical cover pool
        canonicalCoverPoolsOnly(constants);

        // decode original sender
        SwapCallbackData memory _data = abi.decode(data, (SwapCallbackData));
        
        // transfer from swap caller
        if (amount0Delta < 0) {
            if (constants.token0 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount0Delta));
            } else {
                SafeTransfers.transferInto(constants.token0, _data.sender, uint256(-amount0Delta));   
            }
        }
        if (amount1Delta < 0) {
            if (constants.token1 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount1Delta));
            } else {
                SafeTransfers.transferInto(constants.token1, _data.sender, uint256(-amount1Delta));
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
            if (constants.token0 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount0Delta));
            } else {
                SafeTransfers.transferInto(constants.token0, _data.sender, uint256(-amount0Delta));   
            }
        }
        if (amount1Delta < 0) {
            if (constants.token1 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount1Delta));
            } else {
                SafeTransfers.transferInto(constants.token1, _data.sender, uint256(-amount1Delta));
            }
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
            if (constants.token0 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount0Delta));
            } else {
                SafeTransfers.transferInto(constants.token0, _data.sender, uint256(-amount0Delta));   
            }
        }
        if (amount1Delta < 0) {
            if (constants.token1 == wethAddress && _data.wrapped) {
                wrapEth(uint256(-amount1Delta));
            } else {
                SafeTransfers.transferInto(constants.token1, _data.sender, uint256(-amount1Delta));
            }
        }
    }

    function multiMintLimit(
        address[] memory pools,
        MintLimitParams[] memory params
    ) external payable {
        if (pools.length != params.length) require(false, 'InputArrayLengthsMismatch()');
        for (uint i = 0; i < pools.length;) {
            params[i].callbackData = abi.encode(MintCallbackData({
                sender: msg.sender,
                wrapped: msg.value > 0
            }));
            ILimitPool(pools[i]).mintLimit(params[i]);
            unchecked {
                ++i;
            }
        }
        if (address(this).balance > 0) {
            // return eth balance to msg.sender
            SafeTransfers.transferOut(msg.sender, ethAddress, address(this).balance);
        }
    }

    function multiMintRange(
        address[] memory pools,
        MintRangeParams[] memory params
    ) external payable {
        if (pools.length != params.length) require(false, 'InputArrayLengthsMismatch()');
        for (uint i = 0; i < pools.length;) {
            params[i].callbackData = abi.encode(MintCallbackData({
                sender: msg.sender,
                wrapped: msg.value > 0
            }));
            IRangePool(pools[i]).mintRange(params[i]);
            unchecked {
                ++i;
            }
        }
        if (address(this).balance > 0) {
            // return eth balance to msg.sender
            SafeTransfers.transferOut(msg.sender, ethAddress, address(this).balance);
        }
    }

    function multiMintCover(
        address[] memory pools,
        PoolsharkStructs.MintCoverParams[] memory params
    ) external payable {
        if (pools.length != params.length) require(false, 'InputArrayLengthsMismatch()');
        for (uint i = 0; i < pools.length;) {
            params[i].callbackData = abi.encode(MintCallbackData({
                sender: msg.sender,
                wrapped: msg.value > 0
            }));
            ICoverPool(pools[i]).mint(params[i]);
            unchecked {
                ++i;
            }
        }
        if (address(this).balance > 0) {
            // return eth balance to msg.sender
            SafeTransfers.transferOut(msg.sender, ethAddress, address(this).balance);
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
    ) external payable {
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
            // if msg.value > 0 we either need to wrap or unwrap the native gas token
            params[i].callbackData = abi.encode(SwapCallbackData({
                sender: msg.sender,
                recipient: params[i].to,
                wrapped: msg.value > 0
            }));
            if (msg.value > 0) {
                IPool pool = IPool(pools[i]);
                address tokenIn = params[i].zeroForOne ? pool.token0() : pool.token1();
                address tokenOut = params[i].zeroForOne ? pool.token1() : pool.token0();
                if (tokenOut == wethAddress) {
                    // send weth to router for unwrapping
                    params[i].to = address(this);
                } else if (tokenIn != wethAddress) {
                    require (false, "NonNativeTokenPair()");
                }
            }
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
        if (address(this).balance > 0) {
            // return eth balance to msg.sender
            SafeTransfers.transferOut(msg.sender, ethAddress, address(this).balance);
        }
    }

    function multiSnapshotLimit(
        address[] memory pools,
        SnapshotLimitParams[] memory params 
    ) external view returns(
        uint128[] memory amountIns,
        uint128[] memory amountOuts
    ) {
        amountIns = new uint128[](pools.length);
        amountOuts = new uint128[](pools.length);
        for (uint i = 0; i < pools.length;) {
            if (pools[i] == address(0)) require(false, "InvalidPoolAddress()");
            (amountIns[i], amountOuts[i]) = ILimitPool(pools[i]).snapshotLimit(params[i]);
            unchecked {
                ++i;
            }
        }
    }

    function createLimitPoolAndMint(
        ILimitPoolFactory.LimitPoolParams memory params,
        MintRangeParams[] memory mintRangeParams,
        MintLimitParams[] memory mintLimitParams
    ) external payable returns (
        address pool,
        address poolToken 
    ) {
        // check if pool exists
        (
            pool,
            poolToken
        ) = ILimitPoolFactory(limitPoolFactory).getLimitPool(
            params.tokenIn,
            params.tokenOut,
            params.swapFee,
            params.poolTypeId
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
            mintRangeParams[i].positionId = 0;
            mintRangeParams[i].callbackData = abi.encode(MintCallbackData({
                sender: msg.sender,
                wrapped: msg.value > 0
            }));
            try IRangePool(pool).mintRange(mintRangeParams[i]){
            } catch {}
            unchecked {
                ++i;
            }
        }
        // mint initial limit positions
        for (uint i = 0; i < mintLimitParams.length;) {
            mintLimitParams[i].positionId = 0;
            mintLimitParams[i].callbackData = abi.encode(MintCallbackData({
                sender: msg.sender,
                wrapped: msg.value > 0
            }));
            try ILimitPool(pool).mintLimit(mintLimitParams[i]) {
            } catch {}
            unchecked {
                ++i;
            }
        }
        if (address(this).balance > 0) {
            // send remaining eth to msg.sender
            SafeTransfers.transferOut(msg.sender, ethAddress, address(this).balance);
        }
    }

    function createCoverPoolAndMint(
        ICoverPoolFactory.CoverPoolParams memory params,
        MintCoverParams[] memory mintCoverParams
    ) external payable returns (
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
            mintCoverParams[i].positionId = 0;
            mintCoverParams[i].callbackData = abi.encode(MintCallbackData({
                sender: msg.sender,
                wrapped: msg.value > 0
            }));
            try ICoverPool(pool).mint(mintCoverParams[i]){
            } catch {}
            unchecked {
                ++i;
            }
        }
        if (address(this).balance > 0) {
            // send remaining eth to msg.sender
            SafeTransfers.transferOut(msg.sender, ethAddress, address(this).balance);
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
            // if exactOut, sort by most output then least input
            locals.sortAmount = params[0].exactIn ? int256(0) : type(int256).max;
            locals.sortIndex = type(uint256).max;
            for (uint index = 0; index < results.length;) {
                // check if result already sorted
                if (!locals.sortedFlags[index]) {
                    if (params[0].exactIn) {
                        if (results[index].amountOut > 0 && results[index].amountOut >= locals.sortAmount) {
                            locals.sortIndex = index;
                            locals.sortAmount = results[index].amountOut;
                        }
                    } else {
                        if (results[index].amountIn > 0 && results[index].amountIn <= locals.sortAmount) {
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

    function multiCall(
        address[] memory pools,
        SwapParams[] memory params 
    ) external {
        if (pools.length != params.length) require(false, 'InputArrayLengthsMismatch()');
        for (uint i = 0; i < pools.length;) {
            params[i].callbackData = abi.encode(SwapCallbackData({sender: msg.sender, recipient: params[i].to, wrapped: true}));
            ICoverPool(pools[i]).swap(params[i]);
            unchecked {
                ++i;
            }
        }
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

    function wrapEth(uint256 amount) private {
        // wrap necessary amount of WETH
        IWETH9 weth = IWETH9(wethAddress);
        console.log('wrapping eth:', amount, address(this).balance);
        if (amount > address(this).balance) require(false, 'WrapEth::LowEthBalance()');
        weth.deposit{value: amount}();
        console.log('eth wrapped');
        // transfer weth into pool
        SafeTransfers.transferOut(msg.sender, wethAddress, amount);
        console.log('weth transferred in');
    }

    function unwrapEth(address recipient, uint256 amount) private {
        IWETH9 weth = IWETH9(wethAddress);
        // unwrap WETH and send to recipient
        weth.withdraw(amount);
        // send balance to recipient
        SafeTransfers.transferOut(recipient, ethAddress, amount);
    }
}