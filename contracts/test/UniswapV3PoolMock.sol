//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import '../interfaces/external/IUniswapV3Pool.sol';
import './UniswapV3PoolMock.sol';

contract UniswapV3PoolMock is IUniswapV3Pool {
    address internal admin;
    address public token0;
    address public token1;
    int24 public tickSpacing;
    uint256 swapFee;

    uint16 observationCardinality;
    uint16 observationCardinalityNext;

    int56 tickCumulative0;
    int56 tickCumulative1;

    constructor(
        address _token0,
        address _token1,
        uint24 _swapFee,
        int24 _tickSpacing
    ) {
        require(_token0 < _token1, 'wrong token order');
        admin = msg.sender;
        token0 = _token0;
        token1 = _token1;
        swapFee = _swapFee;
        tickSpacing = _tickSpacing;
        observationCardinality = 4;
        observationCardinalityNext = 4;
    }

    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 cardinality,
            uint16 cardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        )
    {
        return (1 << 96, 0, 4, observationCardinality, observationCardinalityNext, 100, true);
    }

    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (
            int56[] memory tickCumulatives,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        )
    {
        secondsAgos;
        tickCumulatives = new int56[](secondsAgos.length);
        tickCumulatives[0] = int56(tickCumulative0);
        tickCumulatives[1] = int56(tickCumulative1);
        secondsPerLiquidityCumulativeX128s = new uint160[](secondsAgos.length);
        secondsPerLiquidityCumulativeX128s[0] = uint160(949568451203788412348119);
        secondsPerLiquidityCumulativeX128s[1] = uint160(949568438263103965182699);
    }

    function increaseObservationCardinalityNext(uint16 cardinalityNext) external {
        observationCardinalityNext = cardinalityNext;
    }

    function setTickCumulatives(int56 _tickCumulative0, int56 _tickCumulative1) external {
        tickCumulative0 = _tickCumulative0;
        tickCumulative1 = _tickCumulative1;
    }

    function setObservationCardinality(uint16 _observationCardinality, uint16 _observationCardinalityNext) external {
        observationCardinality = _observationCardinality;
        observationCardinalityNext = _observationCardinalityNext;
    }
}
