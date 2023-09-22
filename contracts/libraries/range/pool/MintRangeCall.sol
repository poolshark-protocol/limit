// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import '../../../interfaces/structs/RangePoolStructs.sol';
import '../../../interfaces/callbacks/ILimitPoolCallback.sol';
import '../../../interfaces/IERC20Minimal.sol';
import '../../utils/SafeTransfers.sol';
import '../../utils/Collect.sol';
import '../../utils/PositionTokens.sol';
import '../RangePositions.sol';

library MintRangeCall {
    using SafeCast for uint256;
    using SafeCast for int128;
    using SafeCast for uint128;

    event MintRange(
        address indexed recipient,
        int24 lower,
        int24 upper,
        uint32 indexed positionId,
        uint128 liquidityMinted,
        int128 amount0Delta,
        int128 amount1Delta
    );

    struct Balances {
        uint256 amount0;
        uint256 amount1;
    }

    function perform(
        mapping(uint256 => RangePoolStructs.RangePosition)
            storage positions,
        mapping(int24 => PoolsharkStructs.Tick) storage ticks,
        PoolsharkStructs.TickMap storage tickMap,
        RangePoolStructs.Sample[65535] storage samples,
        PoolsharkStructs.GlobalState storage globalState,
        RangePoolStructs.MintRangeCache memory cache,
        RangePoolStructs.MintRangeParams memory params
    ) external {
        // initialize cache
        cache.state = globalState;

        // id of 0 can be passed to create new position
        if (params.positionId > 0) {
            cache.position = positions[params.positionId];
            // existing position
            // if (PositionTokens.balanceOf(cache.constants, msg.sender, params.positionId) == 0)
            //     // check for balance held
            //     require(false, 'PositionNotFound()');
            // set bounds as defined by position
            params.lower = cache.position.lower;
            params.upper = cache.position.upper;
            // update existing position
            (
                cache.position,
                cache.amount0,
                cache.amount1
            ) = RangePositions.update(
                    ticks,
                    cache.position,
                    cache.state,
                    cache.constants,
                    RangePoolStructs.UpdateParams(
                        params.lower,
                        params.upper,
                        params.positionId,
                        0
                    )
            );
        } else {
            // create a new position
            params.positionId = cache.state.positionIdNext;
            // increment for next position
            cache.state.positionIdNext += 1;
            // set tick bounds on position
            cache.position.lower = params.lower;
            cache.position.upper = params.upper;
        }
        // set cache based on bounds
        cache.priceLower = ConstantProduct.getPriceAtTick(cache.position.lower, cache.constants);
        cache.priceUpper = ConstantProduct.getPriceAtTick(cache.position.upper, cache.constants);

        // compound and transfer remaining back to user
        // if (cache.amount0 > 0 || cache.amount1 > 0) {
        //     (
        //         cache.position,
        //         cache.state,
        //         cache.amount0,
        //         cache.amount1
        //     ) = RangePositions.compound(
        //         ticks,
        //         tickMap,
        //         samples,
        //         cache.state,
        //         cache.constants,
        //         cache.position,
        //         RangePoolStructs.CompoundRangeParams( 
        //             cache.priceLower,
        //             cache.priceUpper,
        //             cache.amount0.toUint128(),
        //             cache.amount1.toUint128(),
        //             params.positionId
        //         )
        //     );
        // }
        // validate input amounts
        (params, cache) = RangePositions.validate(params, cache);

        // save changes to storage before transfer in
        save(positions, globalState, cache, params.positionId);
        cache.amount0 -= params.amount0.toInt128();
        cache.amount1 -= params.amount1.toInt128();

        emit MintRange(
            params.to,
            cache.position.lower,
            cache.position.upper,
            params.positionId,
            cache.liquidityMinted.toUint128(),
            -cache.amount0, /// @dev - emit balance delta from pool POV
            -cache.amount1
        );

        // update position with latest fees accrued
        cache = RangePositions.add(
            ticks,
            samples,
            tickMap,
            cache,
            params
        );

        // save changes to storage before transfer out
        save(positions, globalState, cache, params.positionId);

        // transfer positive amounts back to user
        if (cache.amount0 > 0 || cache.amount1 > 0)
            Collect.range(
                cache.constants,
                params.to,
                cache.amount0,
                cache.amount1
            );

        // check balances and execute callback
        Balances memory startBalance;
        if (cache.amount0 < 0) startBalance.amount0 = balance0(cache);
        if (cache.amount1 < 0) startBalance.amount1 = balance1(cache);
        ILimitPoolMintCallback(msg.sender).limitPoolMintCallback(
            cache.amount0,
            cache.amount1,
            params.callbackData
        );

        // check balance requirements after callback
        if (cache.amount0 < 0)
            if (balance0(cache) < startBalance.amount0 + (-cache.amount0).toUint128())
                require(false, 'MintInputAmount0TooLow()');
        if (cache.amount1 < 0)
            if (balance1(cache) < startBalance.amount1 + (-cache.amount1).toUint128())
                require(false, 'MintInputAmount1TooLow()');
    }

    function save(
        mapping(uint256 => RangePoolStructs.RangePosition)
            storage positions,
        PoolsharkStructs.GlobalState storage globalState,
        RangePoolStructs.MintRangeCache memory cache,
        uint32 positionId
    ) internal {
        positions[positionId] = cache.position;
        globalState.pool = cache.state.pool;
        globalState.liquidityGlobal = cache.state.liquidityGlobal;
        globalState.positionIdNext = cache.state.positionIdNext;
    }

    function balance0(
        RangePoolStructs.MintRangeCache memory cache
    ) private view returns (uint256) {
        (
            bool success,
            bytes memory data
        ) = (cache.constants.token0)
                               .staticcall(
                                    abi.encodeWithSelector(
                                        IERC20Minimal.balanceOf.selector,
                                        address(this)
                                    )
                                );
        require(success && data.length >= 32);
        return abi.decode(data, (uint256));
    }

    function balance1(
        RangePoolStructs.MintRangeCache memory cache
    ) private view returns (uint256) {
        (
            bool success,
            bytes memory data
        ) = (cache.constants.token1)
                               .staticcall(
                                    abi.encodeWithSelector(
                                        IERC20Minimal.balanceOf.selector,
                                        address(this)
                                    )
                                );
        require(success && data.length >= 32);
        return abi.decode(data, (uint256));
    }
}
