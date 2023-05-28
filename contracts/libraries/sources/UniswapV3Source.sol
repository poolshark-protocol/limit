// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../../interfaces/external/IUniswapV3Factory.sol';
import '../../interfaces/external/IUniswapV3Pool.sol';
import '../../interfaces/ILimitPoolStructs.sol';
import '../../interfaces/modules/sources/ITwapSource.sol';
import '../math/ConstantProduct.sol';

contract UniswapV3Source is ITwapSource {
    error WaitUntilBelowMaxTick();
    error WaitUntilAboveMinTick();

    address public immutable uniV3Factory;
    /// @dev - set for Arbitrum mainnet
    uint32 public constant oneSecond = 1000;

    constructor(
        address _uniV3Factory
    ) {
        uniV3Factory = _uniV3Factory;
    }

    function initialize(
        ILimitPoolStructs.Immutables memory constants
    ) external returns (
        uint8 initializable,
        int24 startingTick
    )
    {
        // get the number of blocks covered by the twapLength
        uint32 blockCount = uint32(constants.twapLength) * oneSecond / constants.blockTime;
        (
            bool observationsCountEnough,
            bool observationsLengthEnough
        ) = _isPoolObservationsEnough(
                constants.inputPool,
                blockCount
        );
        if (!observationsLengthEnough) {
            _increaseV3Observations(constants.inputPool, blockCount);
            return (0, 0);
        } else if (!observationsCountEnough) {
            return (0, 0);
        }
        return (1, _calculateAverageTick(constants));
    }

    function factory() external view returns (address) {
        return uniV3Factory;
    }

    function feeTierTickSpacing(
        uint16 feeTier
    ) external view returns (
        int24
    )
    {
        return IUniswapV3Factory(uniV3Factory).feeTierTickSpacing(feeTier);
    }

    function getPool(
        address token0,
        address token1,
        uint16 feeTier
    ) external view returns(
        address pool
    ) {
        return IUniswapV3Factory(uniV3Factory).getPool(token0, token1, feeTier);
    }

    function calculateAverageTick(
        ILimitPoolStructs.Immutables memory constants
    ) external view returns (
        int24 averageTick
    )
    {
        return _calculateAverageTick(constants);
    }

    function _calculateAverageTick(
        ILimitPoolStructs.Immutables memory constants
    ) internal view returns (
        int24 averageTick
    )
    {
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = 0;
        secondsAgos[1] = constants.twapLength;
        (int56[] memory tickCumulatives, ) = IUniswapV3Pool(constants.inputPool).observe(secondsAgos);
        averageTick = int24(((tickCumulatives[0] - tickCumulatives[1]) / (int32(secondsAgos[1]))));
        int24 maxAverageTick = ConstantProduct.maxTick(constants.tickSpread) - constants.tickSpread;
        if (averageTick > maxAverageTick) return maxAverageTick;
        int24 minAverageTick = ConstantProduct.minTick(constants.tickSpread) + constants.tickSpread;
        if (averageTick < minAverageTick) return minAverageTick;
    }

    function _isPoolObservationsEnough(
        address pool,
        uint32 blockCount
    ) internal view returns (
        bool,
        bool
    )
    {
        (, , , uint16 observationsCount, uint16 observationsLength, , ) = IUniswapV3Pool(pool).slot0();
        return (observationsCount >= blockCount, observationsLength >= blockCount);
    }

    function _increaseV3Observations(address pool, uint32 blockCount) internal {
        IUniswapV3Pool(pool).increaseObservationCardinalityNext(uint16(blockCount));
    }
}
