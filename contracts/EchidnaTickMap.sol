// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;


import './LimitPool.sol';
import './LimitPoolFactory.sol';
import './utils/LimitPoolManager.sol';
import './test/Token20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import './libraries/utils/SafeTransfers.sol';
import './libraries/math/ConstantProduct.sol';


// Fuzz TickMap functionality
contract EchidnaTickMap {

    event TickResult(int24 inputTick, int24 outputTick);

    ILimitPoolStructs.TickMap public tickMap;
    int16 immutable tickSpacing;
    int16 immutable halfTickSpacing;

     constructor() {
        tickSpacing = 10;
        halfTickSpacing = tickSpacing / 2;
        TickMap.set(tickMap, ConstantProduct.minTick(tickSpacing), tickSpacing);
        TickMap.set(tickMap, ConstantProduct.maxTick(tickSpacing), tickSpacing);

    }

    function setTickTwice(int24 tick) public {
        require(tick > ConstantProduct.minTick(tickSpacing));
        require(tick < ConstantProduct.maxTick(tickSpacing));
        TickMap.set(tickMap, tick, tickSpacing);
        TickMap.set(tickMap, tick, tickSpacing);
        bool exists = TickMap.get(tickMap, tick, tickSpacing);
        assert(exists);
    }

    function setThenUnsets(int24 tick) public {
        require(tick > ConstantProduct.minTick(tickSpacing));
        require(tick < ConstantProduct.maxTick(tickSpacing));
        TickMap.set(tickMap, tick, tickSpacing);
        TickMap.unset(tickMap, tick, tickSpacing);
        bool exists = TickMap.get(tickMap, tick, tickSpacing);
        assert(!exists);
    }

    function setTick(int24 tick) public {
        require(tick > ConstantProduct.minTick(tickSpacing));
        require(tick < ConstantProduct.maxTick(tickSpacing));
        TickMap.set(tickMap, tick, tickSpacing);
        bool exists = TickMap.get(tickMap, tick, tickSpacing);
        assert(exists);
    }

    function unsetTick(int24 tick) public {
        require(tick > ConstantProduct.minTick(tickSpacing));
        require(tick < ConstantProduct.maxTick(tickSpacing));
        TickMap.unset(tickMap, tick, tickSpacing);
        bool exists = TickMap.get(tickMap, tick, tickSpacing);
        assert(!exists);
    }

    function next(int24 tick, bool inclusive) public {
        require(tick < ConstantProduct.maxTick(tickSpacing));
        require(tick > 0);

        int24 nextTick = TickMap.next(tickMap, tick, tickSpacing, inclusive);
        emit TickResult(tick, nextTick);

        // For next(), inclusive does not include the full tick as it is already crossed
        // If at tick 5, get tick 5 when inclusive and tick 5 exists
        // If at tick 7, get tick 5 when inclusive and tick 5 exists
        if (inclusive && ((tick % tickSpacing) >= halfTickSpacing)) {
            int24 halfTick = (tick / tickSpacing * tickSpacing) + halfTickSpacing;
            bool exists = TickMap.get(tickMap, halfTick, tickSpacing);
            if (exists) {
                assert(halfTick == nextTick);
                return;
            }
        }
        assert(nextTick > tick);
    }

    function previous(int24 tick, bool inclusive) public {
        require(tick > ConstantProduct.minTick(tickSpacing));

        int24 previousTick = TickMap.previous(tickMap, tick, tickSpacing, inclusive);
        emit TickResult(tick, previousTick);

        // If inclusive and on half/full tick, previous should be that tick
        if (inclusive && ((tick % halfTickSpacing) == 0)) {
            bool exists = TickMap.get(tickMap, tick, tickSpacing);
            if (exists) {
                assert(tick == previousTick);
                return;
            }
        }
        assert(previousTick <  tick);
    }

}