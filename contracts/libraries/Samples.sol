// SPDX-License-Identifier: GPLv3
pragma solidity 0.8.13;

import './math/ConstantProduct.sol';
import './utils/SafeCast.sol';
import '../interfaces/IPool.sol';
import '../interfaces/range/IRangePool.sol';
import '../interfaces/structs/RangePoolStructs.sol';

library Samples {
    using SafeCast for uint256;

    uint8 internal constant TIME_DELTA_MAX = 6;

    error InvalidSampleLength();
    error SampleArrayUninitialized();
    error SampleLengthNotAvailable();

    event SampleRecorded(
        int56 tickSecondsAccum,
        uint160 secondsPerLiquidityAccum
    );

    event SampleLengthIncreased(
        uint16 sampleLengthNext
    );

    function initialize(
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.RangePoolState memory state
    ) internal returns (
        PoolsharkStructs.RangePoolState memory
    )
    {
        samples[0] = PoolsharkStructs.Sample({
            blockTimestamp: uint32(block.timestamp),
            tickSecondsAccum: 0,
            secondsPerLiquidityAccum: 0
        });

        state.samples.length = 1;
        state.samples.lengthNext = 5;

        return state;
        /// @dev - TWAP length of 5 is safer for oracle manipulation
    }

    function save(
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.SampleState memory sampleState,
        uint128 startLiquidity, /// @dev - liquidity from start of block
        int24  tick
    ) internal returns (
        uint16 sampleIndexNew,
        uint16 sampleLengthNew
    ) {
        // grab the latest sample
        RangePoolStructs.Sample memory newSample = samples[sampleState.index];

        // early return if timestamp has not advanced 2 seconds
        if (newSample.blockTimestamp + 2 > uint32(block.timestamp))
            return (sampleState.index, sampleState.length);

        if (sampleState.lengthNext > sampleState.length
            && sampleState.index == (sampleState.length - 1)) {
            // increase sampleLengthNew if old size exceeded
            sampleLengthNew = sampleState.lengthNext;
        } else {
            sampleLengthNew = sampleState.length;
        }
        sampleIndexNew = (sampleState.index + 1) % sampleLengthNew;
        samples[sampleIndexNew] = _build(newSample, uint32(block.timestamp), tick, startLiquidity);

        emit SampleRecorded(
            samples[sampleIndexNew].tickSecondsAccum,
            samples[sampleIndexNew].secondsPerLiquidityAccum
        );
    }

    function expand(
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.RangePoolState storage pool,
        uint16 sampleLengthNext
    ) internal {
        if (sampleLengthNext <= pool.samples.lengthNext) return ;
        for (uint16 i = pool.samples.lengthNext; i < sampleLengthNext; i++) {
            samples[i].blockTimestamp = 1;
        }
        pool.samples.lengthNext = sampleLengthNext;
        emit SampleLengthIncreased(sampleLengthNext);
    }

    function get(
        address pool,
        RangePoolStructs.SampleParams memory params
    ) internal view returns (
        int56[]   memory tickSecondsAccum,
        uint160[] memory secondsPerLiquidityAccum,
        uint160 averagePrice,
        uint128 averageLiquidity,
        int24 averageTick
    ) {
        if (params.sampleLength == 0) require(false, 'InvalidSampleLength()');
        if (params.secondsAgo.length == 0) require(false, 'SecondsAgoArrayEmpty()');
        uint256 size = params.secondsAgo.length > 1 ? params.secondsAgo.length : 2;
        uint32[] memory secondsAgo = new uint32[](size);
        if (params.secondsAgo.length == 1) {
            secondsAgo = new uint32[](2);
            secondsAgo[0] = params.secondsAgo[0];
            secondsAgo[1] = params.secondsAgo[0] + 2;
        }
        else secondsAgo = params.secondsAgo;

        if (secondsAgo[0] == secondsAgo[secondsAgo.length - 1]) require(false, 'SecondsAgoArrayValuesEqual()');

        tickSecondsAccum = new int56[](secondsAgo.length);
        secondsPerLiquidityAccum = new uint160[](secondsAgo.length);

        for (uint256 i = 0; i < secondsAgo.length; i++) {
            (
                tickSecondsAccum[i],
                secondsPerLiquidityAccum[i]
            ) = getSingle(
                IPool(pool),
                params,
                secondsAgo[i]
            );
        }
        if (secondsAgo[secondsAgo.length - 1] > secondsAgo[0]) {
            averageTick = int24((tickSecondsAccum[0] - tickSecondsAccum[secondsAgo.length - 1]) 
                                / int32(secondsAgo[secondsAgo.length - 1] - secondsAgo[0]));
            averagePrice = ConstantProduct.getPriceAtTick(averageTick, params.constants);
            averageLiquidity = uint128((secondsPerLiquidityAccum[0] - secondsPerLiquidityAccum[secondsAgo.length - 1]) 
                                    * (secondsAgo[secondsAgo.length - 1] - secondsAgo[0]));
        } else {
            averageTick = int24((tickSecondsAccum[secondsAgo.length - 1] - tickSecondsAccum[0]) 
                                / int32(secondsAgo[0] - secondsAgo[secondsAgo.length - 1]));
            averagePrice = ConstantProduct.getPriceAtTick(averageTick, params.constants);
            averageLiquidity = uint128((secondsPerLiquidityAccum[secondsAgo.length - 1] - secondsPerLiquidityAccum[0]) 
                                    * (secondsAgo[0] - secondsAgo[secondsAgo.length - 1]));
        }
    }

    function _poolSample(
        IPool pool,
        uint256 sampleIndex
    ) internal view returns (
        RangePoolStructs.Sample memory
    ) {
        (
            uint32 blockTimestamp,
            int56 tickSecondsAccum,
            uint160 liquidityPerSecondsAccum
        ) = pool.samples(sampleIndex);

        return PoolsharkStructs.Sample(
            blockTimestamp,
            tickSecondsAccum,
            liquidityPerSecondsAccum
        );
    }

    function getSingle(
        IPool pool,
        RangePoolStructs.SampleParams memory params,
        uint32 secondsAgo
    ) internal view returns (
        int56   tickSecondsAccum,
        uint160 secondsPerLiquidityAccum
    ) {
        RangePoolStructs.Sample memory latest = _poolSample(pool, params.sampleIndex);

        if (secondsAgo == 0) {
            if (latest.blockTimestamp != uint32(block.timestamp)) {
                latest = _build(
                    latest,
                    uint32(block.timestamp),
                    params.tick,
                    params.liquidity
                );
            } 
            return (
                latest.tickSecondsAccum,
                latest.secondsPerLiquidityAccum
            );
        }

        uint32 targetTime = uint32(block.timestamp) - secondsAgo;

        // should be getting samples
        (
            RangePoolStructs.Sample memory firstSample,
            RangePoolStructs.Sample memory secondSample
        ) = _getAdjacentSamples(
                pool,
                latest,
                params,
                targetTime
        );

        if (targetTime == firstSample.blockTimestamp) {
            // first sample
            return (
                firstSample.tickSecondsAccum,
                firstSample.secondsPerLiquidityAccum
            );
        } else if (targetTime == secondSample.blockTimestamp) {
            // second sample
            return (
                secondSample.tickSecondsAccum,
                secondSample.secondsPerLiquidityAccum
            );
        } else {
            // average two samples
            int32 sampleTimeDelta = int32(secondSample.blockTimestamp - firstSample.blockTimestamp);
            int56 targetDelta = int56(int32(targetTime - firstSample.blockTimestamp));
            return (
                firstSample.tickSecondsAccum +
                    ((secondSample.tickSecondsAccum - firstSample.tickSecondsAccum) 
                    / sampleTimeDelta)
                    * targetDelta,
                firstSample.secondsPerLiquidityAccum +
                    uint160(
                        (uint256(
                            secondSample.secondsPerLiquidityAccum - firstSample.secondsPerLiquidityAccum
                        ) 
                        * uint256(uint56(targetDelta))) 
                        / uint32(sampleTimeDelta)
                    )
            );
        }
    }

    function getLatest(
        PoolsharkStructs.GlobalState memory state,
        PoolsharkStructs.LimitImmutables memory constants,
        uint256 liquidity
    ) internal view returns (
        uint160 latestPrice,
        uint160 secondsPerLiquidityAccum,
        int56 tickSecondsAccum
    ) {
        uint32 timeDelta = timeElapsed(constants);
        (
            tickSecondsAccum,
            secondsPerLiquidityAccum
        ) = getSingle(
                IPool(address(this)), 
                RangePoolStructs.SampleParams(
                    state.pool.samples.index,
                    state.pool.samples.length,
                    uint32(block.timestamp),
                    new uint32[](2),
                    state.pool.tickAtPrice,
                    liquidity.toUint128(),
                    constants
                ),
                0
        );
        // grab older sample for dynamic fee calculation
        (
            int56 tickSecondsAccumBase,
        ) = Samples.getSingle(
                IPool(address(this)), 
                RangePoolStructs.SampleParams(
                    state.pool.samples.index,
                    state.pool.samples.length,
                    uint32(block.timestamp),
                    new uint32[](2),
                    state.pool.tickAtPrice,
                    liquidity.toUint128(),
                    constants
                ),
                timeDelta
        );

        latestPrice = calculateLatestPrice(
            tickSecondsAccum,
            tickSecondsAccumBase,
            timeDelta,
            TIME_DELTA_MAX,
            constants
        );
    }

    function calculateLatestPrice(
        int56 tickSecondsAccum,
        int56 tickSecondsAccumBase,
        uint32 timeDelta,
        uint32 timeDeltaMax,
        PoolsharkStructs.LimitImmutables memory constants
    ) private pure returns (
        uint160 averagePrice
    ) {
        int56 tickSecondsAccumDiff = tickSecondsAccum - tickSecondsAccumBase;
        int24 averageTick;
        if (timeDelta == timeDeltaMax) {
            averageTick = int24(tickSecondsAccumDiff / int32(timeDelta));
        } else {
            averageTick = int24(tickSecondsAccum / int32(timeDelta));
        }
        averagePrice = ConstantProduct.getPriceAtTick(averageTick, constants);
    }


    function timeElapsed(
        PoolsharkStructs.LimitImmutables memory constants
    ) private view returns (
        uint32
    )    
    {
        return  uint32(block.timestamp) - constants.genesisTime >= TIME_DELTA_MAX
                    ? TIME_DELTA_MAX
                    : uint32(block.timestamp - constants.genesisTime);
    }

    function _lte(
        uint32 timeA,
        uint32 timeB
    ) private view returns (bool) {
        uint32 currentTime = uint32(block.timestamp);
        if (timeA <= currentTime && timeB <= currentTime) return timeA <= timeB;

        uint256 timeAOverflow = timeA;
        uint256 timeBOverflow = timeB;

        if (timeA <= currentTime) {
            timeAOverflow = timeA + 2**32;
        }
        if (timeB <= currentTime) {
            timeBOverflow = timeB + 2**32;
        }

        return timeAOverflow <= timeBOverflow;
    }

    function _build(
        RangePoolStructs.Sample memory newSample,
        uint32  blockTimestamp,
        int24   tick,
        uint128 liquidity
    ) internal pure returns (
         RangePoolStructs.Sample memory
    ) {
        int56 timeDelta = int56(uint56(blockTimestamp - newSample.blockTimestamp));

        return
            PoolsharkStructs.Sample({
                blockTimestamp: blockTimestamp,
                tickSecondsAccum: newSample.tickSecondsAccum + int56(tick) * int32(timeDelta),
                secondsPerLiquidityAccum: newSample.secondsPerLiquidityAccum +
                    ((uint160(uint56(timeDelta)) << 128) / (liquidity > 0 ? liquidity : 1))
            });
    }

    function _binarySearch(
        IPool pool,
        uint32 targetTime,
        uint16 sampleIndex,
        uint16 sampleLength
    ) private view returns (
        RangePoolStructs.Sample memory firstSample,
        RangePoolStructs.Sample memory secondSample
    ) {
        uint256 oldIndex = (sampleIndex + 1) % sampleLength;
        uint256 newIndex = oldIndex + sampleLength - 1;             
        uint256 index;
        while (true) {
            // start in the middle
            index = (oldIndex + newIndex) / 2;

            // get the first sample
            firstSample = _poolSample(pool, index % sampleLength);

            // if sample is uninitialized
            if (firstSample.blockTimestamp == 0) {
                // skip this index and continue
                oldIndex = index + 1;
                continue;
            }
            // else grab second sample
            secondSample = _poolSample(pool, (index + 1) % sampleLength);

            // check if target time within first and second sample
            bool targetAfterFirst   = _lte(firstSample.blockTimestamp, targetTime);
            bool targetBeforeSecond = _lte(targetTime, secondSample.blockTimestamp);
            if (targetAfterFirst && targetBeforeSecond) break;
            if (!targetAfterFirst) newIndex = index - 1;
            else oldIndex = index + 1;
        }
    }

    function _getAdjacentSamples(
        IPool pool,
        RangePoolStructs.Sample memory firstSample,
        RangePoolStructs.SampleParams memory params,
        uint32 targetTime
    ) private view returns (
        RangePoolStructs.Sample memory,
        RangePoolStructs.Sample memory
    ) {
        if (_lte(firstSample.blockTimestamp, targetTime)) {
            if (firstSample.blockTimestamp == targetTime) {
                return (firstSample, PoolsharkStructs.Sample(0,0,0));
            } else {
                return (firstSample, _build(firstSample, targetTime, params.tick, params.liquidity));
            }
        }
        firstSample = _poolSample(pool, (params.sampleIndex + 1) % params.sampleLength);
        if (firstSample.blockTimestamp == 0) {
            firstSample = _poolSample(pool, 0);
        }
        if(!_lte(firstSample.blockTimestamp, targetTime)) require(false, 'SampleLengthNotAvailable()');

        return _binarySearch(
            pool,
            targetTime,
            params.sampleIndex,
            params.sampleLength
        );
    }
}