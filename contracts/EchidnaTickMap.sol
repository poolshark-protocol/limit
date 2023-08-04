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
    int16 tickSpacing;

     constructor() {
        tickSpacing = 10;
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
        require(tick % tickSpacing == 0);
        require(tick % (tickSpacing/2) == 0);
        int24 nextTick = TickMap.next(tickMap, tick, tickSpacing, inclusive);
        emit TickResult(tick, nextTick);
        // if (inclusive) {
        //     bool exists = TickMap.get(tickMap, tick, tickSpacing);
        //     if (exists) assert(tick == nextTick);
        // }
        assert(nextTick >= tick);
    
    }

    function previous(int24 tick, bool inclusive) public {
        require(tick % tickSpacing == 0);
        require(tick % (tickSpacing/2) == 0);
        int24 previousTick = TickMap.previous(tickMap, tick, tickSpacing, inclusive);
        emit TickResult(tick, previousTick);
        if (inclusive) {
            bool exists = TickMap.get(tickMap, tick, tickSpacing);
            if (exists) assert(tick == previousTick);
        }
        assert(previousTick <= tick);
    }

}