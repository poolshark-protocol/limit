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

abstract contract CoverTicksErrors {
    error WrongTickLowerRange();
    error WrongTickUpperRange();
    error WrongTickLowerOrder();
    error WrongTickUpperOrder();
    error WrongTickClaimedAt();
}

abstract contract CoverMiscErrors {
    // to be removed before production
    error NotImplementedYet();
}

abstract contract CoverPositionErrors {
    error NotEnoughPositionLiquidity();
    error InvalidClaimTick();
}

abstract contract LimitPoolFactoryErrors {
    error OwnerOnly();
    error InvalidTokenAddress();
    error PoolAlreadyExists();
    error FeeTierNotSupported();
    error TickSpacingNotSupported();
    error PoolTypeNotSupported();
}

abstract contract CoverTransferErrors {
    error TransferFailed(address from, address dest);
}
