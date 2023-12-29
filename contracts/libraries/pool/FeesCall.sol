// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import '../../interfaces/IPositionERC1155.sol';
import '../../interfaces/structs/PoolsharkStructs.sol';
import '../../interfaces/limit/ILimitPoolManager.sol';
import '../utils/SafeTransfers.sol';

library FeesCall {
    // protocol fee ceilings
    uint16 public constant MAX_PROTOCOL_SWAP_FEE = 1e4; // max protocol swap fee of 100%
    uint16 public constant MAX_PROTOCOL_FILL_FEE = 1e2; // max protocol fill fee of 1%

    // protocol fee flags
    uint8 internal constant PROTOCOL_SWAP_FEE_0 = 2**0;
    uint8 internal constant PROTOCOL_SWAP_FEE_1 = 2**1;
    uint8 internal constant PROTOCOL_FILL_FEE_0 = 2**2;
    uint8 internal constant PROTOCOL_FILL_FEE_1 = 2**3;

    // eth address for safe withdrawal
    address public constant ethAddress = address(0);

    function perform(
        PoolsharkStructs.GlobalState storage globalState,
        PoolsharkStructs.FeesParams memory params,
        PoolsharkStructs.LimitImmutables memory constants
    ) external returns (uint128 token0Fees, uint128 token1Fees) {
        // swap fee token0
        if ((params.setFeesFlags & PROTOCOL_SWAP_FEE_0) > 0) {
            if (params.protocolSwapFee0 > MAX_PROTOCOL_SWAP_FEE)
                require(false, 'ProtocolSwapFeeCeilingExceeded()');
            globalState.pool.protocolSwapFee0 = params.protocolSwapFee0;
        }
        // swap fee token1
        if ((params.setFeesFlags & PROTOCOL_SWAP_FEE_1) > 0) {
            if (params.protocolSwapFee1 > MAX_PROTOCOL_SWAP_FEE)
                require(false, 'ProtocolSwapFeeCeilingExceeded()');
            globalState.pool.protocolSwapFee1 = params.protocolSwapFee1;
        }
        // fill fee token0
        if ((params.setFeesFlags & PROTOCOL_FILL_FEE_0) > 0) {
            if (params.protocolFillFee0 > MAX_PROTOCOL_FILL_FEE)
                require(false, 'ProtocolFillFeeCeilingExceeded()');
            globalState.pool1.protocolFillFee = params.protocolFillFee0;
        }
        // fill fee token1
        if ((params.setFeesFlags & PROTOCOL_FILL_FEE_1) > 0) {
            if (params.protocolFillFee1 > MAX_PROTOCOL_FILL_FEE)
                require(false, 'ProtocolFillFeeCeilingExceeded()');
            globalState.pool0.protocolFillFee = params.protocolFillFee1;
        }
        address feeTo = ILimitPoolManager(constants.owner).feeTo();

        // token0 fees stored on pool1 for swaps and fills
        token0Fees = globalState.pool1.protocolFees;
        // token1 fees stored on pool0 for swaps and fills
        token1Fees = globalState.pool0.protocolFees;
        globalState.pool0.protocolFees = 0;
        globalState.pool1.protocolFees = 0;

        if (token0Fees > 0)
            SafeTransfers.transferOut(feeTo, constants.token0, token0Fees);
        if (token1Fees > 0)
            SafeTransfers.transferOut(feeTo, constants.token1, token1Fees);

        // withdraw errantly received ETH from pool
        if (address(this).balance > 0) {
            // send eth balance to feeTo
            SafeTransfers.transferOut(feeTo, ethAddress, address(this).balance);
        }

        // withdraw errantly received ETH from pool token
        if (address(constants.poolToken).balance > 0) {
            // send eth balance to feeTo
            IPositionERC1155(constants.poolToken).withdrawEth(feeTo, constants);
        }

        return (token0Fees, token1Fees);
    }
}
