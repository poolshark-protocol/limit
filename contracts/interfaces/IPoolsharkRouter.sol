// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.18;

import "../interfaces/structs/PoolsharkStructs.sol";
import "../interfaces/limit/ILimitPoolFactory.sol";

interface IPoolsharkRouter is PoolsharkStructs {
    function createLimitPoolAndMint(
        ILimitPoolFactory.LimitPoolParams memory params,
        MintRangeParams[] memory mintRangeParams,
        MintLimitParams[] memory mintLimitParams
    ) external payable returns (address pool, address poolToken);

    function multiMintRange(
        address[] memory pools,
        MintRangeParams[] memory params
    ) external payable;

    function multiMintLimit(
        address[] memory pools,
        MintLimitParams[] memory params
    ) external payable;

    struct MintRangeCallbackData {
        address sender;
        address recipient;
        bool wrapped;
    }

    struct MintLimitCallbackData {
        address sender;
        address recipient;
        bool wrapped;
    }
}
