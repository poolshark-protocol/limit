// SPDX-License-Identifier: GPLv3
pragma solidity ^0.8.13;

import './math/ConstantProduct.sol';
import '../interfaces/ILimitPool.sol';
import '../interfaces/ILimitPoolStructs.sol';

library TickMap {

    error TickIndexOverflow();
    error TickIndexUnderflow();
    error TickIndexBadSpacing();
    error BlockIndexOverflow();

    function init(
        ILimitPoolStructs.TickMap storage tickMap,
        int24 tick,
        int24 tickSpacing
    ) internal returns (
        bool exists
    )    
    {
        return _set(tickMap, tick, tickSpacing);
    }

    function set(
        ILimitPoolStructs.TickMap storage tickMap,
        int24 tick,
        int16 tickSpacing
    ) internal returns (
        bool exists
    )    
    {
        return _set(tickMap, tick, tickSpacing);
    }

    function unset(
        ILimitPoolStructs.TickMap storage tickMap,
        int24 tick,
        int16 tickSpacing
    ) internal {
        (
            uint256 tickIndex,
            uint256 wordIndex,
            uint256 blockIndex
        ) = getIndices(tick, tickSpacing);

        tickMap.ticks[wordIndex] &= ~(1 << (tickIndex & 0xFF));
        if (tickMap.ticks[wordIndex] == 0) {
            tickMap.words[blockIndex] &= ~(1 << (wordIndex & 0xFF));
            if (tickMap.words[blockIndex] == 0) {
                tickMap.blocks &= ~(1 << blockIndex);
            }
        }
    }

    function previous(
        ILimitPoolStructs.TickMap storage tickMap,
        int24 tick,
        int16 tickSpacing,
        bool roundedUp
    ) internal view returns (
        int24 previousTick
    ) {
        unchecked {
            // rounds up to ensure relative position
            if ((tick % (tickSpacing / 2) != 0 || roundedUp)
                 && tick < round(TickMath.MAX_TICK, tickSpacing)) tick += tickSpacing / 2;
            // rounds up to ensure relative position
            // if (tick % (tickSpacing / 2) != 0) tick += tickSpacing;
            (
              uint256 tickIndex,
              uint256 wordIndex,
              uint256 blockIndex
            ) = getIndices(tick, tickSpacing);

            uint256 word = tickMap.ticks[wordIndex] & ((1 << (tickIndex & 0xFF)) - 1);
            if (word == 0) {
                uint256 block_ = tickMap.words[blockIndex] & ((1 << (wordIndex & 0xFF)) - 1);
                if (block_ == 0) {
                    uint256 blockMap = tickMap.blocks & ((1 << blockIndex) - 1);
                    if (blockMap == 0) return tick;

                    blockIndex = _msb(blockMap);
                    block_ = tickMap.words[blockIndex];
                }
                wordIndex = (blockIndex << 8) | _msb(block_);
                word = tickMap.ticks[wordIndex];
            }
            previousTick = _tick((wordIndex << 8) | _msb(word), tickSpacing);
        }
    }

    function next(
        ILimitPoolStructs.TickMap storage tickMap,
        int24 tick,
        int16 tickSpacing
    ) internal view returns (
        int24 nextTick
    ) {
        unchecked {
            (
              uint256 tickIndex,
              uint256 wordIndex,
              uint256 blockIndex
            ) = getIndices(tick, tickSpacing);
            uint256 word;
            if ((tickIndex & 0xFF) != 255) {
                word = tickMap.ticks[wordIndex] & ~((1 << ((tickIndex & 0xFF) + 1)) - 1);
            }
            if (word == 0) {
                uint256 block_;
                if ((blockIndex & 0xFF) != 255) {
                    block_ = tickMap.words[blockIndex] & ~((1 << ((wordIndex & 0xFF) + 1)) - 1);
                }
                if (block_ == 0) {
                    uint256 blockMap = tickMap.blocks & ~((1 << blockIndex + 1) - 1);
                    if (blockMap == 0) return tick;
                    blockIndex = _lsb(blockMap);
                    block_ = tickMap.words[blockIndex];
                }
                wordIndex = (blockIndex << 8) | _lsb(block_);
                word = tickMap.ticks[wordIndex];
            }
            nextTick = _tick((wordIndex << 8) | _lsb(word), tickSpacing);
        }
    }

    function getIndices(
        int24 tick,
        int24 tickSpacing
    ) public pure returns (
            uint256 tickIndex,
            uint256 wordIndex,
            uint256 blockIndex
        )
    {
        unchecked {
            if (tick > TickMath.MAX_TICK) require(false, ' TickIndexOverflow()');
            if (tick < TickMath.MIN_TICK) require(false, 'TickIndexUnderflow()');
            if (tick % (tickSpacing / 2) != 0) tick = round(tick, tickSpacing / 2);
            tickIndex = uint256(int256((round(tick, tickSpacing / 2) 
                                        - round(TickMath.MIN_TICK, tickSpacing / 2)) 
                                        / (tickSpacing / 2)));
            wordIndex = tickIndex >> 8;   // 2^8 ticks per word
            blockIndex = tickIndex >> 16; // 2^8 words per block
            if (blockIndex > 255) require(false, 'BlockIndexOverflow()');
        }
    }

    function _set(
        ILimitPoolStructs.TickMap storage tickMap,
        int24 tick,
        int24 tickSpacing
    ) internal returns (
        bool exists
    ) {
        (
            uint256 tickIndex,
            uint256 wordIndex,
            uint256 blockIndex
        ) = getIndices(tick, tickSpacing);

        // check if bit is already set
        uint256 word = tickMap.ticks[wordIndex] | 1 << (tickIndex & 0xFF);
        if (word == tickMap.ticks[wordIndex]) {
            return true;
        }

        tickMap.ticks[wordIndex]     = word; 
        tickMap.words[blockIndex]   |= 1 << (wordIndex & 0xFF); // same as modulus 255
        tickMap.blocks              |= 1 << blockIndex;
        return false;
    }

    function _tick (
        uint256 tickIndex,
        int24 tickSpacing
    ) internal pure returns (
        int24 tick
    ) {
        unchecked {
            if (tickIndex > uint24(round(TickMath.MAX_TICK, tickSpacing) * 2) * 2) 
                require(false, 'TickIndexOverflow()');
            tick = int24(int256(tickIndex) * (tickSpacing / 2) + round(TickMath.MIN_TICK, tickSpacing / 2));
        }
    }

    function _msb(
        uint256 x
    ) internal pure returns (
        uint8 r
    ) {
        unchecked {
            assert(x > 0);
            if (x >= 0x100000000000000000000000000000000) {
                x >>= 128;
                r += 128;
            }
            if (x >= 0x10000000000000000) {
                x >>= 64;
                r += 64;
            }
            if (x >= 0x100000000) {
                x >>= 32;
                r += 32;
            }
            if (x >= 0x10000) {
                x >>= 16;
                r += 16;
            }
            if (x >= 0x100) {
                x >>= 8;
                r += 8;
            }
            if (x >= 0x10) {
                x >>= 4;
                r += 4;
            }
            if (x >= 0x4) {
                x >>= 2;
                r += 2;
            }
            if (x >= 0x2) r += 1;
        }
    }

    function _lsb(
        uint256 x
    ) internal pure returns (
        uint8 r
    ) {
        unchecked {
            assert(x > 0); // if x is 0 return 0
            r = 255;
            if (x & type(uint128).max > 0) {
                r -= 128;
            } else {
                x >>= 128;
            }
            if (x & type(uint64).max > 0) {
                r -= 64;
            } else {
                x >>= 64;
            }
            if (x & type(uint32).max > 0) {
                r -= 32;
            } else {
                x >>= 32;
            }
            if (x & type(uint16).max > 0) {
                r -= 16;
            } else {
                x >>= 16;
            }
            if (x & type(uint8).max > 0) {
                r -= 8;
            } else {
                x >>= 8;
            }
            if (x & 0xf > 0) {
                r -= 4;
            } else {
                x >>= 4;
            }
            if (x & 0x3 > 0) {
                r -= 2;
            } else {
                x >>= 2;
            }
            if (x & 0x1 > 0) r -= 1;
        }
    }

    function round(
        int24 tick,
        int24 tickSpacing
    ) internal pure returns (
        int24 roundedTick
    ) {
        return tick / tickSpacing * tickSpacing;
    }

    function roundDown(
        int24 tick,
        ILimitPoolStructs.Immutables memory constants,
        bool zeroForOne,
        uint256 price
    ) internal pure returns (
        int24 roundedTick
    ) {
        roundedTick = tick / constants.tickSpacing * constants.tickSpacing;
        if (price == ConstantProduct.getPriceAtTick(roundedTick, constants))
            return roundedTick;
        /// @dev - rounding down only needed if negative
        if (zeroForOne && roundedTick < 0)
            roundedTick -= constants.tickSpacing;
        /// @dev - rounding up only needed if positive
        else if (!zeroForOne && roundedTick > 0)
            roundedTick += constants.tickSpacing;
    }

    function roundUp(
        int24 tick,
        int24 tickSpacing,
        bool zeroForOne
    ) internal pure returns (
        int24 roundedTick
    ) {
        roundedTick = tick / tickSpacing * tickSpacing;
        if (roundedTick == tick) return tick;
        /// @dev - rounding down only needed if negative
        if (zeroForOne && roundedTick < 0)
            roundedTick -= tickSpacing;
        /// @dev - rounding up only needed if positive
        else if (!zeroForOne && roundedTick > 0)
            roundedTick += tickSpacing;
    }
}