// SPDX-License-Identifier: SSPL-1.0
pragma solidity 0.8.18;

import '../interfaces/limit/ILimitPoolView.sol';
import '../interfaces/limit/ILimitPoolStorageView.sol';
import '../interfaces/structs/PoolsharkStructs.sol';
import '../libraries/math/ConstantProduct.sol';
import '../external/solady/LibClone.sol';

/*@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%#%@@@@%@@@@%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%@@@@@@@@%%%%%%@@%==========+++**#@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@%%@@@@@@@@@@@@@@@%%##%%%@@%%%@@%%*-=====+++**#**+*#*#*#@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@=+===========+#@@@@@%#@%%%%%%*#%%%%%##%@@@@@@@@#****++#%#**#%=%@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@+-==+++***++++=++@@%%%%%%%%*****#%#*#@%@@@@@@@@@@@@@%#+#%#*##*=#@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@+=+*******+++%%##%%####++++++**@@%%@@@@@@@@@@@@@@@###*#%#+==@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@%=**##**+#%###########+====*@%@@%%@@@@@@@@@@@@@%###%@+%=+=*@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@#%%####*##*##*#**#**+=+=-=*%%%###%@@@@@@@@@@@####@#=====+*@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@#%#***#***#*****=*+=+==--=@@%#**###@@@@@@@@@@@###@@%=+++=++#@@@@*@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@##*********+***##++*+#%@*%@@@@@####@@@@#=%@@@@@@@@@@@+==++=+=%%#+*@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@##*****+**+*********++=%%%@@@@@@@@@*@@@%===@@@@@@@@@*===++=+++**#%#@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@#**++++*+++++===+***+==#%%#@@@@@@@@*##@*===+%@@@@%+==+=+++++++*%@%%@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@**++++++++====----+++====+###@@@@@@@%#%%*==++*+#+===+++++++++++*%%@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@%###*++++++====---=*@@@@+===-%@**%@@@@@@@#%%%===*+****+++*++++*+*+*#@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@*+++*+++++===--=-*@@@@@@@@=--=@@@#%@@@@@@@@#%%*++++**#+++*++**++***#*@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@%===+++++=+++===*@@@@@@@@@@=-=%@@@@@%#@@@@@@@*===*++=++*++++****+**#%+@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@*=+@@#==+==+=-=@@@%%@@@@@@@@@@@@#***%%@@@@%+===+++*+*******+**++*#%*#@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@======-==#***%#@@@@@@@@@@@##%%%%%%@#====****+*****#**###*+++#*@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@%-===*=++**###@@@@@@@@@@@@@+#%%%%@*======+*********###+++++++++%@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@%-=+#%%+*###%@@@@@@@@@@@@@@@#%#@%++=+++===**#*#****#%=====+++++++%@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@-=#****####@@@@@@@@@@@@@@@@#%@*++*#++++=+#*#####*#%%==============*@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@*=#**+*###@@@@@@@@@@@@@@@@@#%+**###**+++######%%#+-==--=-=------======#@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@++#++++*##%@@@@@@@@@@@@@@@%+*#%%######*##%#+=-=#@@@@@*----------------*@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@%+#*+++==+***#@@@@@@@@@@@%#%%####%%#*+#*++%@@@@@@@@@@@@@%+=======*@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@*+**+========------=-=%@#%%%%%%%%%%%%#%#%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@#=====-==-------=#@@@@########%%%%%%##++#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@%%##%%@@@@@@@@@@@@%#######%%#*+=++@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%#*####++++=@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%##**+=#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@***%@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*/

/**
 * @title TickQuoter
 * @notice A contract to query tick data
 * @author Poolshark
 * @author @alphak3y
 */
contract TickQuoter is PoolsharkStructs {
    address public immutable limitPoolFactory;

    struct TickData {
        /**
         * @custom:field tick
         * @notice The index of the tick
         */
        int24 tick;

        /**
         * @custom:field liquidityDelta
         * @notice The +/- liquidity change at the tick
         * @notice Delta applied for upward crosses
         * @notice Opposite delta applied for downward crosses
         */
        int128 liquidityDelta;

        /**
         * @custom:field liquidityAbsolute
         * @notice The absolute value of liquidity at the tick
         */
        uint128 liquidityAbsolute;
    }

    constructor(
        address limitPoolFactory_
    ) {
        limitPoolFactory = limitPoolFactory_;
    }

    function getTickDataInWord(address pool, int16 tickBitmapIndex)
        public
        view
        returns (TickData[] memory populatedTicks)
    {
        // read constants from pool
        LimitImmutables memory constants = ILimitPoolView(pool).immutables();
        
        // validate address is a canonical limit pool
        canonicalLimitPoolsOnly(pool, constants);

        int16 tickSpacing = constants.tickSpacing;
        int24 startTick = (int24(tickBitmapIndex) << 8) * (tickSpacing / 2);
        uint8 ticksCount;

        // array for tick data found; max size of 256
        TickData[] memory foundTicks = new TickData[](256);

        for (int24 i = 0; i < 256;) {
            // offset currentTick from startTick 
            int24 currentTick = startTick + i * (tickSpacing / 2);

            // read tick from storage
            RangeTick memory rangeTick;
            LimitTick memory limitTick;
            (rangeTick, limitTick) = ILimitPoolStorageView(pool).ticks(
                currentTick
            );
            
            // check for non-zero liquidity
            if (rangeTick.liquidityAbsolute + limitTick.liquidityAbsolute > 0) {
                // push active tick to array
                foundTicks[ticksCount] = TickData({
                    tick: currentTick,
                    liquidityDelta: rangeTick.liquidityDelta +
                        limitTick.liquidityDelta,
                    liquidityAbsolute: rangeTick.liquidityAbsolute +
                        limitTick.liquidityAbsolute
                });
                unchecked {
                    // count number of active ticks
                    ++ticksCount;
                }
            }
            unchecked {
                ++i;
            }
        }

        // resize array based on ticksCount
        populatedTicks = new TickData[](ticksCount);

        // push tick data to returned array
        for (uint256 i; i < ticksCount; ) {
            populatedTicks[i] = foundTicks[ticksCount - i - 1];
            unchecked {
                ++i;
            }
        }
    }

    function canonicalLimitPoolsOnly(
        address pool,
        PoolsharkStructs.LimitImmutables memory constants
    ) private view {
        // generate key for pool
        bytes32 key = keccak256(
            abi.encode(
                constants.poolImpl,
                constants.token0,
                constants.token1,
                constants.swapFee
            )
        );

        // compute address
        address predictedAddress = LibClone.predictDeterministicAddress(
            constants.poolImpl,
            encodeLimit(constants),
            key,
            limitPoolFactory
        );

        // revert on sender mismatch
        if (pool != predictedAddress)
            require(false, 'InvalidPoolAddress()');
    }

    function encodeLimit(LimitImmutables memory constants)
        private
        pure
        returns (bytes memory)
    {
        return
            abi.encodePacked(
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
} 