// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.21;

/// @title Safe casting methods
/// @notice Contains methods for safely casting between types
library SafeCast {
    /// @notice Cast a uint256 to a uint128, revert on overflow
    /// @param y The uint256 to be downcasted
    /// @return z The downcasted integer, now type uint128
    function toUint128(uint256 y) internal pure returns (uint128 z) {
        if ((z = uint128(y)) != y)
            require(false, 'Uint256ToUint128:Overflow()');
    }

    /// @notice Cast a uint256 to a uint128, revert on overflow
    /// @param y The uint256 to be downcasted
    /// @return z The downcasted integer, now type uint128
    function toUint128(int128 y) internal pure returns (uint128 z) {
        if (y < 0) require(false, 'Int128ToUint128:Underflow()');
        z = uint128(y);
    }

    /// @notice Cast a uint256 to a uint160, revert on overflow
    /// @param y The uint256 to be downcasted
    /// @return z The downcasted integer, now type uint160
    function toUint160(uint256 y) internal pure returns (uint160 z) {
        if ((z = uint160(y)) != y)
            require(false, 'Uint256ToUint160:Overflow()');
    }

    /// @notice Cast a uint256 to a uint160, revert on overflow
    /// @param y The uint256 to be downcasted
    /// @return z The downcasted integer, now type uint160
    function toUint32(uint256 y) internal pure returns (uint32 z) {
        if ((z = uint32(y)) != y) require(false, 'Uint256ToUint32:Overflow()');
    }

    /// @notice Cast a int256 to a int128, revert on overflow or underflow
    /// @param y The int256 to be downcasted
    /// @return z The downcasted integer, now type int128
    function toInt128(int256 y) internal pure returns (int128 z) {
        if ((z = int128(y)) != y) require(false, 'Int256ToInt128:Overflow()');
    }

    /// @notice Cast a int256 to a int128, revert on overflow or underflow
    /// @param y The int256 to be downcasted
    /// @return z The downcasted integer, now type int128
    function toInt128(uint128 y) internal pure returns (int128 z) {
        if (y > uint128(type(int128).max))
            require(false, 'Uint128ToInt128:Overflow()');
        z = int128(y);
    }

    /// @notice Cast a uint256 to a int256, revert on overflow
    /// @param y The uint256 to be casted
    /// @return z The casted integer, now type int256
    function toInt256(uint256 y) internal pure returns (int256 z) {
        if (y > uint256(type(int256).max))
            require(false, 'Uint256ToInt256:Overflow()');
        z = int256(y);
    }

    /// @notice Cast a uint256 to a uint128, revert on overflow
    /// @param y The uint256 to be downcasted
    /// @return z The downcasted integer, now type uint128
    function toUint256(int256 y) internal pure returns (uint256 z) {
        if (y < 0) require(false, 'Int256ToUint256:Underflow()');
        z = uint256(y);
    }

    /// @notice Cast a uint256 to a uint16, revert on overflow
    /// @param y The uint256 to be downcasted
    /// @return z The downcasted integer, now type uint128
    function toUint16(uint256 y) internal pure returns (uint16 z) {
        if ((z = uint16(y)) != y) require(false, 'Uint256ToUint16:Overflow()');
    }

    function safeMinusInt56(
        int56 valueA,
        int56 valueB
    ) internal pure returns (int56) {
        if (valueB >= 0) {
            // check for underflow if valueB gt 0
            if (valueA < type(int56).min + valueB) {
                return type(int56).min;
            }
        } else {
            // check for overflow if valueB lt 0
            if (valueA > type(int56).max + valueB) {
                return type(int56).max;
            }
        }
        return valueA - valueB;
    }

    function safeMinusUint160(
        uint160 valueA,
        uint160 valueB
    ) internal pure returns (uint160) {
        // check for underflow
        if (valueA >= valueB) {
            return valueA - valueB;
        }
        return 0;
    }

    function safeMinusUint256(
        uint256 valueA,
        uint256 valueB
    ) internal pure returns (uint256) {
        // check for underflow
        if (valueA >= valueB) {
            return valueA - valueB;
        }
        return 0;
    }

    function safeMinusFees0(
        uint200 valueA,
        uint200 valueB
    ) internal pure returns (uint200 valueC) {
        if (valueA >= valueB) {
            return valueA - valueB;
        }
        require (false, 'FeeGrowthGlobal0Underflow()');
    }

    function safeMinusFees1(
        uint200 valueA,
        uint200 valueB
    ) internal pure returns (uint200 valueC) {
        if (valueA >= valueB) {
            return valueA - valueB;
        }
        require (false, 'FeeGrowthGlobal1Underflow()');
    }
}
