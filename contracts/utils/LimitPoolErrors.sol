// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

abstract contract LimitPoolErrors {
    error Locked();
    error OwnerOnly();
    error InvalidToken();
    error InvalidPosition();
    error InvalidSwapFee();
    error InvalidTokenDecimals();
    error InvalidTickSpread();
    error LiquidityOverflow();
    error Token0Missing();
    error Token1Missing();
    error InvalidTick();
    error FactoryOnly();
    error LowerNotEvenTick();
    error UpperNotOddTick();
    error MaxTickLiquidity();
    error CollectToZeroAddress();
    error ProtocolFeeCeilingExceeded();
    error Overflow();
    error PoolAlreadyInitialized();
    error NotEnoughOutputLiquidity();
    error WaitUntilEnoughObservations();
}

abstract contract PositionERC1155Errors {
    error SpenderNotApproved(address owner, address spender);
    error TransferFromOrToAddress0();
    error MintToAddress0();
    error BurnFromAddress0();
    error BurnExceedsBalance(address from, uint256 id, uint256 amount);
    error LengthMismatch(uint256 accountsLength, uint256 idsLength);
    error SelfApproval(address owner);
    error TransferExceedsBalance(address from, uint256 id, uint256 amount);
    error TransferToSelf();
    error ERC1155NotSupported();
}

abstract contract LimitPoolFactoryErrors {
    error OwnerOnly();
    error InvalidTokenAddress();
    error PoolAlreadyExists();
    error FeeTierNotSupported();
    error PoolTypeNotSupported();
}