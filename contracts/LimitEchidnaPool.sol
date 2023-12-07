// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import './LimitPool.sol';
import './LimitPoolFactory.sol';
import './test/Token20.sol';
import './libraries/utils/SafeTransfers.sol';
import './utils/PositionERC1155.sol';
import './utils/LimitPoolManager.sol';
import './utils/PoolsharkRouter.sol';
import './interfaces/structs/PoolsharkStructs.sol';

// Fuzz LimitPool functionality
contract EchidnaPool {

    event PassedMint();
    event PassedBurn();
    event PassedMintRange();
    event PassedBurnRange();
    event Prices(uint160 price0, uint160 price1);
    event LiquidityGlobal(uint128 liqBefore, uint128 liqAfter);
    event Liquidity(uint128 liq0Before, uint128 liq1Before, uint128 liq0After, uint128 liq1After);
    event LiquidityRange(uint128 liqBefore, uint128 liqAfter);
    event PositionTicks(int24 lower, int24 upper);
    event BurnTicks(int24 lower, int24 upper, bool positionExists);
    event LiquidityMinted(uint256 amount, uint256 tokenAmount, bool zeroForOne);
    event PositionCreated(bool isCreated);
    event LiquidityAbsoluteNoPosCreated(uint128 beforeAbs, uint128 afterAbs);
    event LiquidityAbsoluteNoPosCreatedPriceCheck(uint256 priceBefore, uint256 priceTick, uint256 priceAfter);
    event LiquidityAbsolutePosCreated(uint128 beforeAbs, uint128 afterAbs);
    event LiquidityAbsoluteLower(uint128 beforeAbs, uint128 afterAbs);
    event LiquidityAbsoluteUpper(uint128 beforeAbs, uint128 afterAbs);
    event LiquidityDeltaAndAbsolute(int128 delta, uint128 abs);
    event PriceChange(uint160 priceBefore, uint160 priceAfter);
    event PositionIdNext(uint32 idNextBefore, uint32 idNextAfter);
    event LimitCallbackOnEchidnaPool(uint256 amount0, uint256 amount1);
    event RangeCallbackOnEchidnaPool(uint256 amount0, uint256 amount1);
    event GetResizedTicks(address pool);
    event MsgSenderPool(address sender, address thisAddress);

    int16 tickSpacing;
    uint16 swapFee;
    address private immutable poolImpl;
    address private immutable tokenImpl;
    LimitPoolFactory private immutable factory;
    LimitPoolManager private immutable manager;
    PoolsharkRouter private immutable router;
    LimitPool private pool;
    PositionERC1155 private immutable token;
    Token20 private tokenIn;
    Token20 private tokenOut;
    LimitPosition[] private limitPositions;
    RangePosition[] private rangePositions;

    struct MintLimitArgs {
        address[] pools;
        PoolsharkStructs.MintLimitParams[] params;
    }

    struct MintRangeArgs {
        address[] pools;
        PoolsharkStructs.MintRangeParams[] params;
    }

    struct SwapArgs {
        address[] pools;
        PoolsharkStructs.SwapParams[] params;
    }

    struct LimitPoolValues {

        // global state
        PoolsharkStructs.GlobalState globalStateBefore;
        PoolsharkStructs.GlobalState globalStateAfter;

        // lower tick
        PoolsharkStructs.LimitTick lowerTickBefore;
        PoolsharkStructs.LimitTick lowerTickAfter;

        // upper tick
        PoolsharkStructs.LimitTick upperTickBefore;
        PoolsharkStructs.LimitTick upperTickAfter;

        // pool0
        PoolsharkStructs.LimitPoolState pool0Before;
        PoolsharkStructs.LimitPoolState pool0After;

        // pool1
        PoolsharkStructs.LimitPoolState pool1Before;
        PoolsharkStructs.LimitPoolState pool1After;

        // constants
        PoolsharkStructs.LimitImmutables constants;
    }

    struct RangePoolValues {
        uint256 liquidityMinted;
        PoolsharkStructs.LimitImmutables constants;

        // global state
        PoolsharkStructs.GlobalState globalStateBefore;
        PoolsharkStructs.GlobalState globalStateAfter;

        // lower tick
        PoolsharkStructs.RangeTick lowerTickBefore;
        PoolsharkStructs.RangeTick lowerTickAfter;

        // upper tick
        PoolsharkStructs.RangeTick upperTickBefore;
        PoolsharkStructs.RangeTick upperTickAfter;

        // pool
        PoolsharkStructs.RangePoolState poolBefore;
        PoolsharkStructs.RangePoolState poolAfter;
    }

    struct SwapCallbackData {
        address sender;
    }

    struct LimitPosition {
        address owner;
        uint32 positionId;
        int24 lower;
        int24 upper;
        bool zeroForOne;
    }

    struct RangePosition {
        address owner;
        uint32 positionId;
        int24 lower;
        int24 upper;
    }

    modifier tickPreconditions(int24 lower, int24 upper) {
        require(lower < upper);
        require(upper < 887272);
        require(lower > -887272);
        require(lower % tickSpacing == 0);
        require(upper % tickSpacing == 0);
        _;
    }

    constructor() {
        manager = new LimitPoolManager();
        factory = new LimitPoolFactory(address(manager));
        router = new PoolsharkRouter(address(factory), address(0), address(0));
        poolImpl = address(new LimitPool(address(factory)));
        tokenImpl = address(new PositionERC1155(address(factory)));
        
        manager.enablePoolType(address(poolImpl), address(tokenImpl), bytes32(uint256(0x1)));
        manager.enableFeeTier(500, 10);
        tickSpacing = 10;
        tokenIn = new Token20("IN", "IN", 18);
        tokenOut = new Token20("OUT", "OUT", 18);

        PoolsharkStructs.LimitPoolParams memory params;
        params.poolTypeId = 0;
        params.tokenIn = address(tokenIn);
        params.tokenOut = address(tokenOut);
        params.swapFee = 500;
        params.startPrice = 79228162514264337593543950336;
        (address poolAddr, address tokenAddr) = factory.createLimitPool(params);
        pool = LimitPool(poolAddr);
        token = PositionERC1155(tokenAddr);
    }

    // LIMIT CALLS

    function mintLimit(uint128 amount, bool zeroForOne, int24 lower, int24 upper) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        amount = amount + 1;
        // Ensure the newly created position is using different ticks
        for(uint i = 0; i < limitPositions.length;) {
            if(limitPositions[i].owner == msg.sender && limitPositions[i].lower == lower && limitPositions[i].upper == upper && limitPositions[i].zeroForOne == zeroForOne) {
                revert("Position already exists");
            }
            unchecked {
                ++i;
            }
        }

        LimitPoolValues memory values;

        values.globalStateBefore = pool.getGlobalState();
        values.pool0Before = values.globalStateBefore.pool0;
        values.pool1Before = values.globalStateBefore.pool1;

        LimitPoolStructs.MintLimitParams memory params;
        params.to = msg.sender;
        params.amount = amount;
        params.mintPercent = 0;
        params.lower = lower;
        params.upper = upper;
        params.zeroForOne = zeroForOne;

        // Get the ticks the position will be minted with rather than what was passed directly by fuzzer
        // This is so the we can properly compare before and after mint states of particular ticks.
        bool posCreated;
        emit GetResizedTicks(address(this));
        (lower, upper, posCreated) = pool.getResizedTicksForMint(params);
        emit PositionTicks(lower, upper);
        emit PositionCreated(posCreated);

        (, values.lowerTickBefore) = pool.ticks(lower);
        (, values.upperTickBefore) = pool.ticks(upper);

        // ACTION
        MintLimitArgs memory args;
        args.pools = new address[](1);
        args.pools[0] = address(pool);
        args.params = new PoolsharkStructs.MintLimitParams[](1);
        args.params[0] = params;
        router.multiMintLimit(args.pools, args.params);
        if (posCreated) limitPositions.push(LimitPosition(msg.sender, values.globalStateBefore.positionIdNext, lower, upper, zeroForOne));

        (, values.lowerTickAfter) = pool.ticks(lower);
        (, values.upperTickAfter) = pool.ticks(upper);

        values.globalStateAfter = pool.getGlobalState();
        values.pool0After = values.globalStateAfter.pool0;
        values.pool1After = values.globalStateAfter.pool1;
        
        // POST CONDITIONS

        // Ensure prices have not crossed
        emit Prices(values.pool0After.price, values.pool1After.price);
        assert(values.pool0After.price >= values.pool1After.price);

        // Ensure liquidityDelta is always less or equal to liquidityAbsolute
        emit LiquidityDeltaAndAbsolute(values.lowerTickAfter.liquidityDelta, values.lowerTickAfter.liquidityAbsolute);
        assert(int256(values.lowerTickAfter.liquidityDelta) <= int256(uint256(values.lowerTickAfter.liquidityAbsolute)));
        emit LiquidityDeltaAndAbsolute(values.upperTickAfter.liquidityDelta, values.upperTickAfter.liquidityAbsolute);
        assert(int256(values.upperTickAfter.liquidityDelta) <= int256(uint256(values.upperTickAfter.liquidityAbsolute)));
        
        // Ensure that liquidityAbsolute is incremented when not undercutting
        if (posCreated) {
            // positionIdNext should have been incremented
            emit PositionIdNext(values.globalStateBefore.positionIdNext, values.globalStateAfter.positionIdNext);
            assert(values.globalStateAfter.positionIdNext == values.globalStateBefore.positionIdNext + 1);
            if(zeroForOne){
                if(values.pool0After.price >= values.pool0Before.price){
                    // ensure liquidityAbsolute is strictly greater
                    //TODO: could be falsified if liquidity cleared out
                    emit LiquidityAbsolutePosCreated(values.upperTickBefore.liquidityAbsolute, values.upperTickAfter.liquidityAbsolute);
                    assert(values.upperTickAfter.liquidityAbsolute > values.upperTickBefore.liquidityAbsolute);
                }
            } else {
                if(values.pool1Before.price >= values.pool1After.price){
                    // ensure liquidityAbsolute is strictly greater
                    //TODO: could be falsified if liquidity cleared out
                    emit LiquidityAbsolutePosCreated(values.lowerTickBefore.liquidityAbsolute, values.lowerTickAfter.liquidityAbsolute);
                    assert(values.lowerTickAfter.liquidityAbsolute > values.lowerTickBefore.liquidityAbsolute);
                }
            }
        } else {
            // positionIdNext should not have been incremented
            emit PositionIdNext(values.globalStateBefore.positionIdNext, values.globalStateAfter.positionIdNext);
            assert(values.globalStateAfter.positionIdNext == values.globalStateBefore.positionIdNext);
            if(zeroForOne){
                if(values.pool0After.price >= values.pool0Before.price){
                    // ensure liquidityAbsolute is strictly equal
                    //TODO: be falsified if liquidity cleared out
                    emit LiquidityAbsoluteNoPosCreated(values.upperTickBefore.liquidityAbsolute, values.upperTickAfter.liquidityAbsolute);
                    values.constants = pool.immutables();
                    uint256 upperPrice = ConstantProduct.getPriceAtTick(upper, values.constants);
                    if (values.pool1Before.price >= upperPrice && values.pool1After.price <= upperPrice) {
                        assert(values.upperTickAfter.liquidityAbsolute == 0);
                    } else {
                        assert(values.upperTickAfter.liquidityAbsolute == values.upperTickBefore.liquidityAbsolute);
                    }
                }
            } else {
                if(values.pool1Before.price >= values.pool1After.price){
                    // ensure liquidityAbsolute is strictly equal
                    //TODO: be falsified if liquidity cleared out
                    emit LiquidityAbsoluteNoPosCreated(values.lowerTickBefore.liquidityAbsolute, values.lowerTickAfter.liquidityAbsolute);
                    values.constants = pool.immutables();
                    uint256 lowerPrice = ConstantProduct.getPriceAtTick(lower, values.constants);
                    if (values.pool0Before.price <= lowerPrice && values.pool1After.price >= lowerPrice) {
                        assert(values.lowerTickAfter.liquidityAbsolute == 0);
                    } else {
                        assert(values.lowerTickAfter.liquidityAbsolute == values.lowerTickBefore.liquidityAbsolute);
                    }
                }
            }
        }

        if (posCreated) {
            emit PositionTicks(lower, upper);
            // Ensure positions ticks arent crossed
            assert(lower < upper);
            // Ensure minted ticks on proper tick spacing
            assert((lower % tickSpacing == 0) && (upper % tickSpacing == 0));
        }
        
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        emit Liquidity(values.pool0Before.liquidity, values.pool1Before.liquidity, values.pool0After.liquidity, values.pool1After.liquidity);
        
        // Ensure liquidityGlobal is incremented after mint
        // if no pos created should be strictly equal
        assert(values.globalStateAfter.liquidityGlobal >= values.globalStateBefore.liquidityGlobal);
        
        // If undercut, liquidity should be non-zero
        // If not undercut, liquidity should be the same or greater
        if (zeroForOne) {
            emit PriceChange(values.pool0Before.price, values.pool0After.price);
            if (values.pool0After.price < values.pool0Before.price) assert(values.pool0After.liquidity > 0);
        }
        else {
            emit PriceChange(values.pool1Before.price, values.pool1After.price);
            if (values.pool1After.price > values.pool1Before.price) assert(values.pool1After.liquidity > 0);
        }
    }

    function mintLimitVariable(uint128 amount, bool zeroForOne, int24 lower, int24 upper, uint96 mintPercent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        amount = amount + 1;
        // Ensure the newly created position is using different ticks
        for(uint i = 0; i < limitPositions.length;) {
            if(limitPositions[i].owner == msg.sender && limitPositions[i].lower == lower && limitPositions[i].upper == upper && limitPositions[i].zeroForOne == zeroForOne) {
                revert("Position already exists");
            }
            unchecked {
                ++i;
            }
        }

        LimitPoolValues memory values;

        values.globalStateBefore = pool.getGlobalState();
        values.pool0Before = values.globalStateBefore.pool0;
        values.pool1Before = values.globalStateBefore.pool1;

        LimitPoolStructs.MintLimitParams memory params;
        params.to = msg.sender;
        params.amount = amount;
        params.mintPercent = mintPercent;
        params.lower = lower;
        params.upper = upper;
        params.zeroForOne = zeroForOne;

        // Get the ticks the position will be minted with rather than what was passed directly by fuzzer
        // This is so the we can properly compare before and after mint states of particular ticks.
        bool posCreated;
        (lower, upper, posCreated) = pool.getResizedTicksForMint(params);
        emit PositionTicks(lower, upper);
        emit PositionCreated(posCreated);

        (, values.lowerTickBefore) = pool.ticks(lower);
        (, values.upperTickBefore) = pool.ticks(upper);

        // ACTION 
        MintLimitArgs memory args;
        args.pools = new address[](1);
        args.pools[0] = address(pool);
        args.params = new PoolsharkStructs.MintLimitParams[](1);
        args.params[0] = params;
        router.multiMintLimit(args.pools, args.params);
        if (posCreated) limitPositions.push(LimitPosition(msg.sender, values.globalStateBefore.positionIdNext, lower, upper, zeroForOne));

        (, values.lowerTickAfter) = pool.ticks(lower);
        (, values.upperTickAfter) = pool.ticks(upper);

        values.globalStateAfter = pool.getGlobalState();
        values.pool0After = values.globalStateAfter.pool0;
        values.pool1After = values.globalStateAfter.pool1;

        // POST CONDITIONS

        // Ensure prices have not crossed
        emit Prices(values.pool0After.price, values.pool1After.price);
        assert(values.pool0After.price >= values.pool1After.price);

        // Ensure liquidityDelta is always less or equal to liquidityAbsolute
        emit LiquidityDeltaAndAbsolute(values.lowerTickAfter.liquidityDelta, values.lowerTickAfter.liquidityAbsolute);
        assert(int256(values.lowerTickAfter.liquidityDelta) <= int256(uint256(values.lowerTickAfter.liquidityAbsolute)));
        emit LiquidityDeltaAndAbsolute(values.upperTickAfter.liquidityDelta, values.upperTickAfter.liquidityAbsolute);
        assert(int256(values.upperTickAfter.liquidityDelta) <= int256(uint256(values.upperTickAfter.liquidityAbsolute)));

        // Ensure that liquidityAbsolute is incremented when not undercutting
        if (posCreated) {
            // positionIdNext should have been incremented
            emit PositionIdNext(values.globalStateBefore.positionIdNext, values.globalStateAfter.positionIdNext);
            assert(values.globalStateAfter.positionIdNext == values.globalStateBefore.positionIdNext + 1);
            if(zeroForOne){
                if(values.pool0After.price >= values.pool0Before.price){
                    // ensure liquidityAbsolute is strictly greater
                    //TODO: could be falsified if liquidity cleared out
                    emit LiquidityAbsolutePosCreated(values.upperTickBefore.liquidityAbsolute, values.upperTickAfter.liquidityAbsolute);
                    assert(values.upperTickAfter.liquidityAbsolute > values.upperTickBefore.liquidityAbsolute);
                }
            } else {
                if(values.pool1Before.price >= values.pool1After.price){
                    // ensure liquidityAbsolute is strictly greater
                    //TODO: could be falsified if liquidity cleared out
                    emit LiquidityAbsolutePosCreated(values.lowerTickBefore.liquidityAbsolute, values.lowerTickAfter.liquidityAbsolute);
                    assert(values.lowerTickAfter.liquidityAbsolute > values.lowerTickBefore.liquidityAbsolute);
                }
            }
        } else {
            // positionIdNext should not have been incremented
            emit PositionIdNext(values.globalStateBefore.positionIdNext, values.globalStateAfter.positionIdNext);
            assert(values.globalStateAfter.positionIdNext == values.globalStateBefore.positionIdNext);
            if(zeroForOne){
                if(values.pool0After.price >= values.pool0Before.price){
                    // ensure liquidityAbsolute is strictly equal
                    //TODO: be falsified if liquidity cleared out
                    emit LiquidityAbsoluteNoPosCreated(values.upperTickBefore.liquidityAbsolute, values.upperTickAfter.liquidityAbsolute);
                    values.constants = pool.immutables();
                    uint256 upperPrice = ConstantProduct.getPriceAtTick(upper, values.constants);
                    emit LiquidityAbsoluteNoPosCreatedPriceCheck(values.pool1Before.price, upperPrice, values.pool1After.price);
                    if (values.pool1Before.price >= upperPrice && values.pool1After.price <= upperPrice) {
                        assert(values.upperTickAfter.liquidityAbsolute == 0);
                    } else {
                        assert(values.upperTickAfter.liquidityAbsolute == values.upperTickBefore.liquidityAbsolute);
                    }
                }
            } else {
                if(values.pool1Before.price >= values.pool1After.price){
                    // ensure liquidityAbsolute is strictly equal
                    //TODO: be falsified if liquidity cleared out
                    emit LiquidityAbsoluteNoPosCreated(values.lowerTickBefore.liquidityAbsolute, values.lowerTickAfter.liquidityAbsolute);
                    values.constants = pool.immutables();
                    uint256 lowerPrice = ConstantProduct.getPriceAtTick(lower, values.constants);
                    emit LiquidityAbsoluteNoPosCreatedPriceCheck(values.pool0Before.price, lowerPrice, values.pool0After.price);
                    if (values.pool0Before.price <= lowerPrice && values.pool0After.price >= lowerPrice) {
                        assert(values.lowerTickAfter.liquidityAbsolute == 0);
                    } else {
                        assert(values.lowerTickAfter.liquidityAbsolute == values.lowerTickBefore.liquidityAbsolute);
                    }
                }
            }
        }

        if (posCreated) {
            emit PositionTicks(lower, upper);
            // Ensure positions ticks arent crossed
            assert(lower < upper);
            // Ensure minted ticks on proper tick spacing
            assert((lower % tickSpacing == 0) && (upper % tickSpacing == 0));
        }
        
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        emit Liquidity(values.pool0Before.liquidity, values.pool1Before.liquidity, values.pool0After.liquidity, values.pool1After.liquidity);
        
        // Ensure liquidityGlobal is incremented after mint
        //TODO: strictly equal if !posCreated
        assert(values.globalStateAfter.liquidityGlobal >= values.globalStateBefore.liquidityGlobal);

        // Ensure pool liquidity is non-zero after mint with no undercuts
        if (zeroForOne) {
            if (values.pool0After.price < values.pool0Before.price) assert(values.pool0After.liquidity > 0);
        }
        else {
            if (values.pool1After.price > values.pool1Before.price) assert(values.pool1After.liquidity > 0);
        }
    }

    function swap(uint160 priceLimit, uint128 amount, bool exactIn, bool zeroForOne) public {
        // PRE CONDITIONS
        mintAndApprove();

        LimitPoolStructs.SwapParams memory params;
        params.to = msg.sender;
        params.priceLimit = priceLimit;
        params.amount = amount;
        params.exactIn = exactIn;
        params.zeroForOne = zeroForOne;
        params.callbackData = abi.encodePacked(address(this));
        
        // ACTION
        SwapArgs memory args;
        args.pools = new address[](1);
        args.pools[0] = address(pool);
        args.params = new PoolsharkStructs.SwapParams[](1);
        args.params[0] = params;
        router.multiSwapSplit(args.pools, args.params);

        // POST CONDITIONS
        LimitPoolValues memory values;

        values.globalStateAfter = pool.getGlobalState();
        values.pool0After = values.globalStateAfter.pool0;
        values.pool1After = values.globalStateAfter.pool1;
        
        // Ensure prices never cross
        emit Prices(values.pool0After.price, values.pool1After.price);
        assert(values.pool0After.price >= values.pool1After.price);
    }

    function burnLimit(int24 claimAt, uint256 positionIndex, uint128 burnPercent) public {
        // PRE CONDITIONS
        positionIndex = positionIndex % limitPositions.length;
        LimitPosition memory pos = limitPositions[positionIndex];
        require(claimAt >= pos.lower && claimAt <= pos.upper);
        require(claimAt % (tickSpacing / 2) == 0);
        LimitPoolValues memory values;

        values.globalStateBefore = pool.getGlobalState();
        values.pool0Before = values.globalStateBefore.pool0;
        values.pool1Before = values.globalStateBefore.pool1;

        LimitPoolStructs.BurnLimitParams memory params;
        params.to = pos.owner;
        params.burnPercent = burnPercent == 1e38 ? burnPercent : _between(burnPercent, 1e36, 1e38); //1e38;
        params.positionId = pos.positionId;
        params.claim = claimAt;
        params.zeroForOne = pos.zeroForOne;

        (, values.lowerTickBefore) = pool.ticks(pos.lower);
        (, values.upperTickBefore) = pool.ticks(pos.upper);
        
        emit PositionTicks(pos.lower, pos.upper);
        (int24 lower, int24 upper, bool positionExists) = pool.getResizedTicksForBurn(params);
        emit BurnTicks(lower, upper, positionExists);

        // ACTION
        pool.burnLimit(params);
        if (!positionExists) {
            limitPositions[positionIndex] = limitPositions[limitPositions.length - 1];
            delete limitPositions[limitPositions.length - 1];
        }
        else {
            // Update position data in array if not fully burned
            limitPositions[positionIndex] = LimitPosition(pos.owner, pos.positionId, lower, upper, pos.zeroForOne);
            // Ensure positions ticks arent crossed
            assert(lower < upper);
            // Ensure minted ticks on proper tick spacing
            assert((lower % tickSpacing == 0) && (upper % tickSpacing == 0));
        }

        (, values.lowerTickAfter) = pool.ticks(lower);
        (, values.upperTickAfter) = pool.ticks(upper);

        values.globalStateAfter = pool.getGlobalState();
        values.pool0After = values.globalStateAfter.pool0;
        values.pool1After = values.globalStateAfter.pool1;
        
        // POST CONDITIONS

        // Ensure prices never cross
        emit Prices(values.pool0After.price, values.pool1After.price);
        assert(values.pool0After.price >= values.pool1After.price);

        // Ensure liquidityGlobal is decremented after burn
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        assert(values.globalStateAfter.liquidityGlobal <= values.globalStateBefore.liquidityGlobal);
    }

    function claim(int24 claimAt, uint256 positionIndex) public {
        // PRE CONDITIONS
        positionIndex = positionIndex % limitPositions.length;
        LimitPosition memory pos = limitPositions[positionIndex];
        claimAt = pos.lower + (claimAt % (pos.upper - pos.lower));
        require(claimAt % (tickSpacing / 2) == 0);

        LimitPoolValues memory values;
        
        values.globalStateBefore = pool.getGlobalState();
        values.pool0Before = values.globalStateBefore.pool0;
        values.pool1Before = values.globalStateBefore.pool1;

        LimitPoolStructs.BurnLimitParams memory params;
        params.to = pos.owner;
        params.burnPercent = 0;
        params.positionId = pos.positionId;
        params.claim = claimAt;
        params.zeroForOne = pos.zeroForOne;
        
        emit PositionTicks(pos.lower, pos.upper);
        (int24 lower, int24 upper, bool positionExists) = pool.getResizedTicksForBurn(params);
        emit BurnTicks(lower, upper, positionExists);

        // ACTION
        pool.burnLimit(params);
        if (!positionExists) {
            limitPositions[positionIndex] = limitPositions[limitPositions.length - 1];
            delete limitPositions[limitPositions.length - 1];
        }
        else {
            // Update position data in array if not fully burned
            limitPositions[positionIndex] = LimitPosition(pos.owner, pos.positionId, lower, upper, pos.zeroForOne);
            // Ensure positions ticks arent crossed
            assert(lower < upper);
            // Ensure minted ticks on proper tick spacing
            assert((lower % tickSpacing == 0) && (upper % tickSpacing == 0));
        }

        // POST CONDITIONS
        values.globalStateAfter = pool.getGlobalState();
        values.pool0After = values.globalStateAfter.pool0;
        values.pool1After = values.globalStateAfter.pool1;

        // Ensure prices never cross
        emit Prices(values.pool0After.price, values.pool1After.price);
        assert(values.pool0After.price >= values.pool1After.price);
    }

    function mintThenBurnZeroLiquidityChangeVariable(uint128 amount, bool zeroForOne, int24 lower, int24 upper, uint96 mintPercent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        LimitPoolValues memory values;
        
        values.globalStateBefore = pool.getGlobalState();
        values.pool0Before = values.globalStateBefore.pool0;
        values.pool1Before = values.globalStateBefore.pool1;

        (, values.lowerTickBefore) = pool.ticks(lower);
        (, values.upperTickBefore) = pool.ticks(upper);

        // ACTION 
        mintLimitVariable(amount, zeroForOne, lower, upper, mintPercent);
        emit PassedMint();
        burnLimit(zeroForOne ? lower : upper, limitPositions.length - 1, 1e38);
        emit PassedBurn();

        // POST CONDITIONS
        (, values.lowerTickAfter) = pool.ticks(lower);
        (, values.upperTickAfter) = pool.ticks(upper);
        
        values.globalStateBefore = pool.getGlobalState();
        values.pool0Before = values.globalStateBefore.pool0;
        values.pool1Before = values.globalStateBefore.pool1;

        // Ensure prices never cross
        emit Prices(values.pool0After.price, values.pool1After.price);
        assert(values.pool0After.price >= values.pool1After.price);

        // Ensure liquidityGlobal is decremented after burn
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        assert(values.globalStateAfter.liquidityGlobal == values.globalStateBefore.liquidityGlobal);
    }

    function mintThenBurnZeroLiquidityChange(uint128 amount, bool zeroForOne, int24 lower, int24 upper) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        LimitPoolValues memory values;

        values.globalStateBefore = pool.getGlobalState();
        values.pool0Before = values.globalStateBefore.pool0;
        values.pool1Before = values.globalStateBefore.pool1;

        (, values.lowerTickBefore) = pool.ticks(lower);
        (, values.upperTickBefore) = pool.ticks(upper);

        // ACTION 
        mintLimit(amount, zeroForOne, lower, upper);
        emit PassedMint();
        burnLimit(zeroForOne ? lower : upper, limitPositions.length - 1, 1e38);
        emit PassedBurn();

        (, values.lowerTickAfter) = pool.ticks(lower);
        (, values.upperTickAfter) = pool.ticks(upper);

        values.globalStateAfter = pool.getGlobalState();
        values.pool0After = values.globalStateAfter.pool0;
        values.pool1After = values.globalStateAfter.pool1;
        
        // POST CONDITIONS

        // Ensure prices never cross
        emit Prices(values.pool0After.price, values.pool1After.price);
        assert(values.pool0After.price >= values.pool1After.price);

        // Ensure liquidityGlobal is equal after burn
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        assert(values.globalStateAfter.liquidityGlobal == values.globalStateBefore.liquidityGlobal);
    }

    function mintThenPartialBurnTwiceLiquidityChange(uint128 amount, bool zeroForOne, int24 lower, int24 upper, uint128 percent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        percent = 1 + (percent % (1e38 - 1));
        mintAndApprove();
        LimitPoolValues memory values;
        
        values.globalStateBefore = pool.getGlobalState();
        values.pool0Before = values.globalStateBefore.pool0;
        values.pool1Before = values.globalStateBefore.pool1;

        (, values.lowerTickBefore) = pool.ticks(lower);
        (, values.upperTickBefore) = pool.ticks(upper);

        // ACTION 
        mintLimit(amount, zeroForOne, lower, upper);
        emit PassedMint();
        burnLimit(zeroForOne ? lower : upper, limitPositions.length - 1, percent);
        emit PassedBurn();
        burnLimit(zeroForOne ? lower : upper, limitPositions.length - 1, 1e38);
        emit PassedBurn();

        (, values.lowerTickAfter) = pool.ticks(lower);
        (, values.upperTickAfter) = pool.ticks(upper);

        values.globalStateAfter = pool.getGlobalState();
        values.pool0After = values.globalStateAfter.pool0;
        values.pool1After = values.globalStateAfter.pool1;

        // POST CONDITIONS

        // Ensure prices never cross
        emit Prices(values.pool0After.price, values.pool1After.price);
        assert(values.pool0After.price >= values.pool1After.price);

        // Ensure liquidityGlobal is decremented after burn
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        assert(values.globalStateAfter.liquidityGlobal == values.globalStateBefore.liquidityGlobal);
    }

    function mintThenPartialBurnTwiceLiquidityChangeVariable(uint128 amount, bool zeroForOne, int24 lower, int24 upper, uint128 percent, uint96 mintPercent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        percent = 1 + (percent % (1e38 - 1));
        mintAndApprove();
        LimitPoolValues memory values;

        values.globalStateBefore = pool.getGlobalState();
        values.pool0Before = values.globalStateBefore.pool0;
        values.pool1Before = values.globalStateBefore.pool1;

        (, values.lowerTickBefore) = pool.ticks(lower);
        (, values.upperTickBefore) = pool.ticks(upper);

        // ACTION 
        mintLimitVariable(amount, zeroForOne, lower, upper, mintPercent);
        emit PassedMint();
        burnLimit(zeroForOne ? lower : upper, limitPositions.length - 1, percent);
        emit PassedBurn();
        burnLimit(zeroForOne ? lower : upper, limitPositions.length - 1, 1e38);
        emit PassedBurn();

        (, values.lowerTickAfter) = pool.ticks(lower);
        (, values.upperTickAfter) = pool.ticks(upper);

        values.globalStateAfter = pool.getGlobalState();
        values.pool0After = values.globalStateAfter.pool0;
        values.pool1After = values.globalStateAfter.pool1;
        
        // POST CONDITIONS

        // Ensure prices never cross
        emit Prices(values.pool0After.price, values.pool1After.price);
        assert(values.pool0After.price >= values.pool1After.price);

        // Ensure liquidityGlobal is decremented after burn
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        assert(values.globalStateAfter.liquidityGlobal == values.globalStateBefore.liquidityGlobal);
    }

    // RANGE CALLS

    function mintRange(uint128 amount0, uint128 amount1, int24 lower, int24 upper) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        amount0 = amount0 + 1;
        amount1 = amount1 + 1;
        // Ensure the newly created position is using different ticks
        for(uint i = 0; i < rangePositions.length;) {
            if(rangePositions[i].owner == msg.sender && rangePositions[i].lower == lower && rangePositions[i].upper == upper) {
                revert("Position already exists");
            }
            unchecked {
                ++i;
            }
        }

        RangePoolValues memory values;

        values.globalStateBefore = pool.getGlobalState();
        values.poolBefore = values.globalStateBefore.pool;

        (values.lowerTickBefore,) = pool.ticks(lower);
        (values.upperTickBefore,) = pool.ticks(upper);

        values.constants = pool.immutables();

        RangePoolStructs.MintRangeParams memory params;
        params.to = msg.sender;
        params.amount0 = amount0;
        params.amount1 = amount1;
        params.lower = lower;
        params.upper = upper;

        // Get the ticks the position will be minted with rather than what was passed directly by fuzzer
        // This is so the we can properly compare before and after mint states of particular ticks.
        bool posCreated = false;

        values.liquidityMinted = ConstantProduct.getLiquidityForAmounts(
            ConstantProduct.getPriceAtTick(lower, values.constants),
            ConstantProduct.getPriceAtTick(upper, values.constants),
            values.poolBefore.price,
            params.amount1,
            params.amount0
        );
        if (values.liquidityMinted > 0) posCreated = true;
        emit PositionTicks(lower, upper);
        emit PositionCreated(posCreated);

        // ACTION
        MintRangeArgs memory args;
        args.pools = new address[](1);
        args.pools[0] = address(pool);
        args.params = new PoolsharkStructs.MintRangeParams[](1);
        args.params[0] = params;
        router.multiMintRange(args.pools, args.params);
        if (posCreated) rangePositions.push(RangePosition(msg.sender, values.globalStateBefore.positionIdNext, lower, upper));

        (values.lowerTickAfter,) = pool.ticks(lower);
        (values.upperTickAfter,) = pool.ticks(upper);

        values.globalStateAfter = pool.getGlobalState();
        values.poolAfter = values.globalStateAfter.pool;
        
        // POST CONDITIONS
        
        // Ensure that liquidityAbsolute is incremented if position created
        if (posCreated) {
            // positionIdNext should have been incremented
            emit PositionIdNext(values.globalStateBefore.positionIdNext, values.globalStateAfter.positionIdNext);
            assert(values.globalStateAfter.positionIdNext == values.globalStateBefore.positionIdNext + 1);
            emit LiquidityAbsoluteLower(values.upperTickBefore.liquidityAbsolute, values.upperTickAfter.liquidityAbsolute);
            assert(values.upperTickAfter.liquidityAbsolute > values.upperTickBefore.liquidityAbsolute);
            emit LiquidityAbsoluteUpper(values.lowerTickBefore.liquidityAbsolute, values.lowerTickAfter.liquidityAbsolute);
            assert(values.lowerTickAfter.liquidityAbsolute > values.lowerTickBefore.liquidityAbsolute);
        } else {
            // positionIdNext should not have been incremented
            emit PositionIdNext(values.globalStateBefore.positionIdNext, values.globalStateAfter.positionIdNext);
            assert(values.globalStateAfter.positionIdNext == values.globalStateBefore.positionIdNext);
            emit LiquidityAbsoluteLower(values.upperTickBefore.liquidityAbsolute, values.upperTickAfter.liquidityAbsolute);
            assert(values.upperTickAfter.liquidityAbsolute == values.upperTickBefore.liquidityAbsolute);
            emit LiquidityAbsoluteUpper(values.lowerTickBefore.liquidityAbsolute, values.lowerTickAfter.liquidityAbsolute);
            assert(values.lowerTickAfter.liquidityAbsolute == values.lowerTickBefore.liquidityAbsolute);
        }

        if (posCreated) {
            emit PositionTicks(lower, upper);
            // Ensure positions ticks arent crossed
            assert(lower < upper);
            // Ensure minted ticks on proper tick spacing
            assert((lower % tickSpacing == 0) && (upper % tickSpacing == 0));
        }
        
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        emit LiquidityRange(values.poolBefore.liquidity, values.poolAfter.liquidity);
        
        // Ensure liquidityGlobal is incremented after mint
        if (posCreated) {
            assert(values.globalStateAfter.liquidityGlobal > values.globalStateBefore.liquidityGlobal);
        } else {
            assert(values.globalStateAfter.liquidityGlobal == values.globalStateBefore.liquidityGlobal);
        }
        
        // Ensure prices does not change
        emit PriceChange(values.poolBefore.price, values.poolAfter.price);
        assert(values.poolBefore.price == values.poolAfter.price);
    }

    function burnRange(uint256 positionIndex, uint128 burnPercent) public {
        // PRE CONDITIONS
        positionIndex = positionIndex % rangePositions.length;
        RangePosition memory pos = rangePositions[positionIndex];
        RangePoolValues memory values;

        values.globalStateBefore = pool.getGlobalState();
        values.poolBefore = values.globalStateBefore.pool;

        (values.lowerTickBefore,) = pool.ticks(pos.lower);
        (values.upperTickBefore,) = pool.ticks(pos.upper);

        RangePoolStructs.BurnRangeParams memory params;
        params.to = pos.owner;
        params.burnPercent = burnPercent == 1e38 ? burnPercent : _between(burnPercent, 1e36, 1e38); //1e38;
        params.positionId = pos.positionId;
        
        emit PositionTicks(pos.lower, pos.upper);
        bool positionExists = false;
        (,,uint128 positionLiquidity,,) = pool.positions(pos.positionId);
        if (positionLiquidity > 0) positionExists = true;

        // ACTION
        pool.burnRange(params);
        if (params.burnPercent == 1e38) {
            delete rangePositions[positionIndex];
        }

        (values.lowerTickAfter,) = pool.ticks(pos.lower);
        (values.upperTickAfter,) = pool.ticks(pos.upper);

        values.globalStateAfter = pool.getGlobalState();
        values.poolAfter = values.globalStateAfter.pool;
        
        // POST CONDITIONS

        // Ensure liquidityGlobal is decremented after burn
        //TODO: if !positionExists liquidity should not change
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        emit LiquidityRange(values.poolBefore.liquidity, values.poolAfter.liquidity);
        assert(values.poolAfter.liquidity <= values.poolBefore.liquidity);
        assert(values.globalStateAfter.liquidityGlobal <= values.globalStateBefore.liquidityGlobal);
    }

    function compoundRange(uint256 positionIndex) public {
        // PRE CONDITIONS
        positionIndex = positionIndex % rangePositions.length;
        RangePosition memory pos = rangePositions[positionIndex];
        RangePoolValues memory values;

        values.globalStateBefore = pool.getGlobalState();
        values.poolBefore = values.globalStateBefore.pool;

        (values.lowerTickBefore,) = pool.ticks(pos.lower);
        (values.upperTickBefore,) = pool.ticks(pos.upper);

        RangePoolStructs.BurnRangeParams memory params;
        params.to = pos.owner;
        params.burnPercent = 0; //0 to compound
        params.positionId = pos.positionId;
        
        emit PositionTicks(pos.lower, pos.upper);
        bool positionExists = false;
        (,,uint128 positionLiquidity,,) = pool.positions(pos.positionId);
        if (positionLiquidity > 0) positionExists = true;

        // ACTION
        pool.burnRange(params);

        // position should still exist if it did before
        (values.lowerTickAfter,) = pool.ticks(pos.lower);
        (values.upperTickAfter,) = pool.ticks(pos.upper);

        values.globalStateAfter = pool.getGlobalState();
        values.poolAfter = values.globalStateAfter.pool;
        
        // POST CONDITIONS

        // Ensure liquidityGlobal is greater than or equal after compound
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        emit LiquidityRange(values.poolBefore.liquidity, values.poolAfter.liquidity);
        assert(values.poolAfter.liquidity >= values.poolBefore.liquidity);
        assert(values.globalStateAfter.liquidityGlobal >= values.globalStateBefore.liquidityGlobal);
    }

    function collectRange(uint256 positionIndex) public {
        // PRE CONDITIONS
        positionIndex = positionIndex % rangePositions.length;
        RangePosition memory pos = rangePositions[positionIndex];
        RangePoolValues memory values;

        values.globalStateBefore = pool.getGlobalState();
        values.poolBefore = values.globalStateBefore.pool;

        (values.lowerTickBefore,) = pool.ticks(pos.lower);
        (values.upperTickBefore,) = pool.ticks(pos.upper);

        RangePoolStructs.BurnRangeParams memory params;
        params.to = pos.owner;
        params.burnPercent = 1; //1 for collect
        params.positionId = pos.positionId;
        
        emit PositionTicks(pos.lower, pos.upper);
        bool positionExists = false;
        (,,uint128 positionLiquidity,,) = pool.positions(pos.positionId);
        if (positionLiquidity > 0) positionExists = true;

        // ACTION
        pool.burnRange(params);

        // position should still exist if it did before
        (values.lowerTickAfter,) = pool.ticks(pos.lower);
        (values.upperTickAfter,) = pool.ticks(pos.upper);

        values.globalStateAfter = pool.getGlobalState();
        values.poolAfter = values.globalStateAfter.pool;
        
        // POST CONDITIONS

        // Ensure liquidityGlobal is equal after collect
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        emit LiquidityRange(values.poolBefore.liquidity, values.poolAfter.liquidity);
        assert(values.poolAfter.liquidity <= values.poolBefore.liquidity);
        assert(values.globalStateAfter.liquidityGlobal <= values.globalStateBefore.liquidityGlobal);
    }

    function mintRangeThenBurnZeroLiquidityChange(uint128 amount0, uint128 amount1, int24 lower, int24 upper) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        RangePoolValues memory values;

        values.globalStateBefore = pool.getGlobalState();
        values.poolBefore = values.globalStateBefore.pool;

        (values.lowerTickBefore,) = pool.ticks(lower);
        (values.upperTickBefore,) = pool.ticks(upper);

        // ACTION 
        mintRange(amount0, amount1, lower, upper);
        emit PassedMintRange();
        burnRange(rangePositions.length - 1, 1e38);
        emit PassedBurnRange();

        (values.lowerTickAfter,) = pool.ticks(lower);
        (values.upperTickAfter,) = pool.ticks(upper);

        values.globalStateAfter = pool.getGlobalState();
        values.poolAfter = values.globalStateAfter.pool;
        
        // POST CONDITIONS

        // Ensure price remains unchanged
        emit Prices(values.poolBefore.price, values.poolAfter.price);
        assert(values.poolBefore.price == values.poolAfter.price);

        // Ensure liquidityGlobal is equal
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        assert(values.globalStateBefore.liquidityGlobal == values.globalStateAfter.liquidityGlobal);
    }

    function mintRangeThenPartialBurnTwiceLiquidityChange(uint128 amount0, uint128 amount1, int24 lower, int24 upper, uint128 percent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        percent = 1 + (percent % (1e38 - 1));
        mintAndApprove();
        RangePoolValues memory values;

        values.globalStateBefore = pool.getGlobalState();
        values.poolBefore = values.globalStateBefore.pool;

        (values.lowerTickBefore,) = pool.ticks(lower);
        (values.upperTickBefore,) = pool.ticks(upper);

        // ACTION 
        mintRange(amount0, amount1, lower, upper);
        emit PassedMintRange();
        burnRange(rangePositions.length - 1, percent);
        emit PassedBurnRange();
        burnRange(rangePositions.length - 1, 1e38);
        emit PassedBurnRange();

        (values.lowerTickAfter,) = pool.ticks(lower);
        (values.upperTickAfter,) = pool.ticks(upper);

        values.globalStateAfter = pool.getGlobalState();
        values.poolAfter = values.globalStateAfter.pool;

        // POST CONDITIONS

        // Ensure prices never cross
        emit Prices(values.poolBefore.price, values.poolAfter.price);
        assert(values.poolBefore.price == values.poolAfter.price);

        // Ensure liquidityGlobal is equal
        emit LiquidityGlobal(values.globalStateBefore.liquidityGlobal, values.globalStateAfter.liquidityGlobal);
        assert(values.globalStateBefore.liquidityGlobal == values.globalStateAfter.liquidityGlobal);
    }

    function mintAndApprove() internal {
        tokenIn.mint(msg.sender, 100000000000 ether);
        tokenOut.mint(msg.sender, 100000000000 ether);
        tokenIn.mint(address(this), 100000000000 ether);
        tokenOut.mint(address(this), 100000000000 ether);
        tokenIn.approve(address(router), type(uint256).max);
        tokenOut.approve(address(router), type(uint256).max);
        tokenIn.approve(address(pool), type(uint256).max);
        tokenOut.approve(address(pool), type(uint256).max);
        tokenIn.approve(address(this), type(uint256).max);
        tokenOut.approve(address(this), type(uint256).max);
    }

    function limitPoolMintLimitCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        emit LimitCallbackOnEchidnaPool(uint256(-amount0Delta), uint256(-amount1Delta));
        address token0 = LimitPool(pool).token0();
        address token1 = LimitPool(pool).token1();
        if (amount0Delta < 0) {
            emit MsgSenderPool(msg.sender, address(this));
            SafeTransfers.transferOut(msg.sender, token0, uint256(-amount0Delta));
            emit MsgSenderPool(msg.sender, address(this));
        }
        if (amount1Delta < 0) {
            SafeTransfers.transferOut(msg.sender, token1, uint256(-amount1Delta));
        }
    }

    function limitPoolMintRangeCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        emit RangeCallbackOnEchidnaPool(uint256(-amount0Delta), uint256(-amount1Delta));
        address token0 = LimitPool(pool).token0();
        address token1 = LimitPool(pool).token1();
        if (amount0Delta < 0) {
            emit MsgSenderPool(msg.sender, address(this));
            SafeTransfers.transferOut(msg.sender, token0, uint256(-amount0Delta));
            emit MsgSenderPool(msg.sender, address(this));
        }
        if (amount1Delta < 0) {
            SafeTransfers.transferOut(msg.sender, token1, uint256(-amount1Delta));
        }
    }

    function limitPoolSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        address token0 = LimitPool(pool).token0();
        address token1 = LimitPool(pool).token1();
        if (amount0Delta < 0) {
            emit MsgSenderPool(msg.sender, address(this));
            SafeTransfers.transferOut(msg.sender, token0, uint256(-amount0Delta));
            emit MsgSenderPool(msg.sender, address(this));
        }
        if (amount1Delta < 0) {
            SafeTransfers.transferOut(msg.sender, token1, uint256(-amount1Delta));
        }
    }

    function _between(uint128 val, uint low, uint high) internal pure returns(uint128) {
        return uint128(low + (val % (high-low +1))); 
    }

    function liquidityMintedBackcalculates(uint128 amount, bool zeroForOne, int24 lower, int24 upper) tickPreconditions(lower, upper) internal {
        // NOTE: Do not use the exact inputs of this function for POCs, use the inputs after the input validation
        amount = amount + 1e5 + 1;
        LimitPoolStructs.LimitImmutables memory immutables = pool.immutables();
        uint256 priceLower = ConstantProduct.getPriceAtTick(lower, immutables);
        uint256 priceUpper = ConstantProduct.getPriceAtTick(upper, immutables);

        uint256 liquidityMinted = ConstantProduct.getLiquidityForAmounts(
            priceLower,
            priceUpper,
            zeroForOne ? priceLower : priceUpper,
            zeroForOne ? 0 : uint256(amount),
            zeroForOne ? uint256(amount) : 0
        );

        (uint256 token0Amount, uint256 token1Amount) = ConstantProduct.getAmountsForLiquidity(
            priceLower,
            priceUpper,
            zeroForOne ? priceLower : priceUpper,
            liquidityMinted,
            true
        );

        if(zeroForOne) {
            emit LiquidityMinted(amount, token0Amount, zeroForOne);
            assert(token0Amount <= amount);
            
        }
        else {
            emit LiquidityMinted(amount, token1Amount, zeroForOne);
            assert(token1Amount <= amount);
        }
    }
}
