// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import '../interfaces/IPool.sol';
import '../interfaces/callbacks/IPoolsharkSwapCallback.sol';
import '../libraries/utils/SafeTransfers.sol';
import '../base/structs/PoolsharkStructs.sol';
import '../libraries/solady/LibClone.sol';

contract PoolRouter is
    IPoolsharkSwapCallback,
    PoolsharkStructs
{
    address public immutable factory;
    address public immutable implementation;

    struct SwapCallbackData {
        address sender;
    }

    constructor(
        address factory_,
        address implementation_
    ) {
        factory = factory_;
        implementation = implementation_;
    }

    /// @inheritdoc IPoolsharkSwapCallback
    function poolsharkSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        PoolsharkStructs.Immutables memory constants = IPool(msg.sender).immutables();
        // generate key for pool
        bytes32 key = keccak256(abi.encode(
            implementation,
            constants.token0,
            constants.token1,
            constants.tickSpacing
        ));

        // compute address
        address predictedAddress = LibClone.predictDeterministicAddress(
            implementation,
            abi.encodePacked(
                constants.owner,
                constants.token0,
                constants.token1,
                constants.bounds.min,
                constants.bounds.max,
                constants.tickSpacing
            ),
            key,
            factory
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

    function multiCall(
        address[] memory pools,
        SwapParams[] memory params 
    ) external {
        if (pools.length != params.length) require(false, 'InputArrayLengthsMismatch()');
        for (uint i = 0; i < pools.length;) {
            params[i].callbackData = abi.encode(SwapCallbackData({sender: msg.sender}));
            IPool(pools[i]).swap(params[i]);
            unchecked {
                ++i;
            }
        }
    }
}