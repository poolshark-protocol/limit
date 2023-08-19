// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../base/structs/PoolsharkStructs.sol';
import '../../interfaces/limit/ILimitPoolManager.sol';
import '../utils/SafeTransfers.sol';

library FeesCall {

    // protocol fee flags
    uint8 internal constant PROTOCOL_SWAP_FEE_0 = 2**0;
    uint8 internal constant PROTOCOL_SWAP_FEE_1 = 2**1;
    uint8 internal constant PROTOCOL_FILL_FEE_0 = 2**2;
    uint8 internal constant PROTOCOL_FILL_FEE_1 = 2**3;

    function perform(
        PoolsharkStructs.GlobalState storage globalState,
        PoolsharkStructs.FeesParams memory params,
        PoolsharkStructs.Immutables memory constants
    ) external returns (
        uint128 token0Fees,
        uint128 token1Fees
    ) {
        // swap fee token0
        if ((params.setFeesFlag & PROTOCOL_SWAP_FEE_0) > 0) {
            if (params.protocolSwapFee0 > 10000)
                require(false, 'ProtocolSwapFeeCeilingExceeded()');
            globalState.pool.protocolSwapFee0 = params.protocolSwapFee0;
        }
        // swap fee token1
        if ((params.setFeesFlag & PROTOCOL_SWAP_FEE_1) > 0) {
            if (params.protocolSwapFee1 > 10000)
                require(false, 'ProtocolSwapFeeCeilingExceeded()');
            globalState.pool.protocolSwapFee1 = params.protocolSwapFee1;
        }
        // fill fee token0
        if ((params.setFeesFlag & PROTOCOL_FILL_FEE_0) > 0) {
            if (params.protocolFillFee0 > 10000)
                require(false, 'ProtocolFillFeeCeilingExceeded()');
            globalState.pool1.protocolFillFee = params.protocolFillFee0;
        }
        // fill fee token1
        if ((params.setFeesFlag & PROTOCOL_FILL_FEE_1) > 0) {
            if (params.protocolFillFee1 > 10000)
                require(false, 'ProtocolFillFeeCeilingExceeded()');
            globalState.pool0.protocolFillFee = params.protocolFillFee1;
        }
        address feeTo = ILimitPoolManager(constants.owner).feeTo();

        token0Fees = globalState.pool1.protocolFees;
        token1Fees = globalState.pool0.protocolFees;
        globalState.pool0.protocolFees = 0;
        globalState.pool1.protocolFees = 0;

        if (token0Fees > 0)
            SafeTransfers.transferOut(feeTo, constants.token0, token0Fees);
        if (token1Fees > 0)
            SafeTransfers.transferOut(feeTo, constants.token1, token1Fees);

        return (token0Fees, token1Fees);
    }
}
