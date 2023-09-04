// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import './LimitPool.sol';
import './LimitPoolFactory.sol';
import './utils/LimitPoolManager.sol';
import './test/Token20.sol';
import './libraries/utils/SafeTransfers.sol';
import './utils/PositionERC1155.sol';
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
    event LiquidityAbsolute(uint128 beforeAbs, uint128 afterAbs);
    event LiquidityAbsoluteLower(uint128 beforeAbs, uint128 afterAbs);
    event LiquidityAbsoluteUpper(uint128 beforeAbs, uint128 afterAbs);
    event LiquidityDeltaAndAbsolute(int128 delta, uint128 abs);
    event PriceChange(uint160 priceBefore, uint160 priceAfter);
    event PositionIdNext(uint32 idNextBefore, uint32 idNextAfter);

    int16 tickSpacing;
    uint16 swapFee;
    address private implementation;
    LimitPoolFactory private factory;
    LimitPoolManager private manager;
    PositionERC1155 private poolToken;
    LimitPool private pool;
    Token20 private tokenIn;
    Token20 private tokenOut;
    LimitPosition[] private limitPositions;
    RangePosition[] private rangePositions;

    struct LiquidityDeltaValues {
        int128 liquidityDeltaLowerAfter;
        int128 liquidityDeltaUpperAfter;
    }

    struct LimitPoolValues {
        uint160 price0Before;
        uint128 liquidity0Before;
        uint160 price1Before;
        uint128 liquidity1Before;
        uint160 price0After;
        uint128 liquidity0After;
        uint160 price1After;
        uint128 liquidity1After;

        uint128 liquidityGlobalBefore;
        uint128 liquidityGlobalAfter;

        uint128 liquidityAbsoluteUpperBefore;
        uint128 liquidityAbsoluteLowerBefore;
        uint128 liquidityAbsoluteUpperAfter;
        uint128 liquidityAbsoluteLowerAfter;

        uint160 price0;
        uint160 price1;

        uint32 positionIdNextBefore;
        uint32 positionIdNextAfter;
    }

    struct RangePoolValues {
        uint256 liquidityMinted;
        uint160 priceBefore;
        uint128 liquidityBefore;
        uint160 priceAfter;
        uint128 liquidityAfter;

        uint128 liquidityGlobalBefore;
        uint128 liquidityGlobalAfter;

        uint128 liquidityAbsoluteUpperBefore;
        uint128 liquidityAbsoluteLowerBefore;
        uint128 liquidityAbsoluteUpperAfter;
        uint128 liquidityAbsoluteLowerAfter;

        PoolsharkStructs.Immutables constants;

        uint32 positionIdNextBefore;
        uint32 positionIdNextAfter;
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

    struct LimitPoolLocals {
        PoolsharkStructs.LimitTick lower;
        PoolsharkStructs.LimitTick upper;
        PoolsharkStructs.LimitPoolState pool0;
        PoolsharkStructs.LimitPoolState pool1;
    }

    struct RangePoolLocals {
        PoolsharkStructs.RangeTick lower;
        PoolsharkStructs.RangeTick upper;
        PoolsharkStructs.RangePoolState pool;
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
        implementation = address(new LimitPool(address(factory)));
        poolToken = new PositionERC1155(address(factory));
        
        manager.enableImplementation(bytes32(0x0), address(implementation), address(poolToken));
        tickSpacing = 10;
        tokenIn = new Token20("IN", "IN", 18);
        tokenOut = new Token20("OUT", "OUT", 18);
        (address poolAddr,) = factory.createLimitPool(bytes32(0x0), address(tokenIn), address(tokenOut), 500, 79228162514264337593543950336);
        pool = LimitPool(poolAddr);
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

        LimitPoolValues memory poolValues;
        LimitPoolLocals memory poolStructs;
        LiquidityDeltaValues memory values;

        (,poolStructs.pool0, poolStructs.pool1, poolValues.liquidityGlobalBefore,poolValues.positionIdNextBefore,,) = pool.globalState();
        poolValues.price0Before = poolStructs.pool0.price;
        poolValues.liquidity0Before = poolStructs.pool0.liquidity;
        poolValues.price1Before = poolStructs.pool1.price;
        poolValues.liquidity1Before = poolStructs.pool1.liquidity;

        (, poolStructs.lower) = pool.ticks(lower);
        (, poolStructs.upper) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerBefore = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = poolStructs.upper.liquidityAbsolute;

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
        (lower, upper, posCreated) = pool.getResizedTicksForMint(params);
        emit PositionTicks(lower, upper);
        emit PositionCreated(posCreated);

        // ACTION 
        pool.mintLimit(params);
        if (posCreated) limitPositions.push(LimitPosition(msg.sender, poolValues.positionIdNextBefore, lower, upper, zeroForOne));

        (, poolStructs.lower) = pool.ticks(lower);
        (, poolStructs.upper) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerAfter = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = poolStructs.upper.liquidityAbsolute;

        values.liquidityDeltaLowerAfter = poolStructs.lower.liquidityDelta;
        values.liquidityDeltaUpperAfter = poolStructs.upper.liquidityDelta;

        (, poolStructs.pool0, poolStructs.pool1, poolValues.liquidityGlobalAfter,,,) = pool.globalState();
        poolValues.price0After = poolStructs.pool0.price;
        poolValues.liquidity0After = poolStructs.pool0.liquidity;
        poolValues.price1After = poolStructs.pool1.price;
        poolValues.liquidity1After = poolStructs.pool1.liquidity;
        poolValues.price0 = poolStructs.pool0.price;
        poolValues.price1 = poolStructs.pool1.price;
        
        // POST CONDITIONS
        emit Prices(poolValues.price0, poolValues.price1);
        assert(poolValues.price0 >= poolValues.price1);
        // Ensure prices have not crossed
        emit Prices(poolValues.price0After, poolValues.price1After);
        assert(poolValues.price0After >= poolValues.price1After);

        // Ensure liquidityDelta is always less or equal to liquidityAbsolute
        emit LiquidityDeltaAndAbsolute(values.liquidityDeltaLowerAfter, poolValues.liquidityAbsoluteLowerAfter);
        assert(int256(values.liquidityDeltaLowerAfter) <= int256(uint256(poolValues.liquidityAbsoluteLowerAfter)));
        emit LiquidityDeltaAndAbsolute(values.liquidityDeltaUpperAfter, poolValues.liquidityAbsoluteUpperAfter);
        assert(int256(values.liquidityDeltaUpperAfter) <= int256(uint256(poolValues.liquidityAbsoluteUpperAfter)));
        
        // Ensure that liquidityAbsolute is incremented when not undercutting
        if (posCreated) {
            // positionIdNext should have been incremented
            emit PositionIdNext(poolValues.positionIdNextBefore, poolValues.positionIdNextAfter);
            assert(poolValues.positionIdNextAfter == poolValues.positionIdNextBefore + 1);
            if(zeroForOne){
                if(poolValues.price0After >= poolValues.price0Before){
                    emit LiquidityAbsolute(poolValues.liquidityAbsoluteUpperBefore, poolValues.liquidityAbsoluteUpperAfter);
                    assert(poolValues.liquidityAbsoluteUpperAfter > poolValues.liquidityAbsoluteUpperBefore);
                }
            } else {
                if(poolValues.price1Before >= poolValues.price1After){
                    emit LiquidityAbsolute(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
                    assert(poolValues.liquidityAbsoluteLowerAfter > poolValues.liquidityAbsoluteLowerBefore);
                }
            }
        } else {
            // positionIdNext should not have been incremented
            emit PositionIdNext(poolValues.positionIdNextBefore, poolValues.positionIdNextAfter);
            assert(poolValues.positionIdNextAfter == poolValues.positionIdNextBefore);
            if(zeroForOne){
                if(poolValues.price0After >= poolValues.price0Before){
                    emit LiquidityAbsolute(poolValues.liquidityAbsoluteUpperBefore, poolValues.liquidityAbsoluteUpperAfter);
                    assert(poolValues.liquidityAbsoluteUpperAfter == poolValues.liquidityAbsoluteUpperBefore);
                }
            } else {
                if(poolValues.price1Before >= poolValues.price1After){
                    emit LiquidityAbsolute(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
                    assert(poolValues.liquidityAbsoluteLowerAfter == poolValues.liquidityAbsoluteLowerBefore);
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
        
        emit LiquidityGlobal(poolValues.liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        emit Liquidity(poolValues.liquidity0Before, poolValues.liquidity1Before, poolValues.liquidity0After, poolValues.liquidity1After);
        
        // Ensure liquidityGlobal is incremented after mint
        assert(poolValues.liquidityGlobalAfter >= poolValues.liquidityGlobalBefore);
        
        // Ensure pool liquidity is non-zero after mint with no undercuts
        if (zeroForOne) {
            emit PriceChange(poolValues.price0Before, poolValues.price0After);
            if (poolValues.price0After < poolValues.price0Before) assert(poolValues.liquidity0After > 0);
        }
        else {
            emit PriceChange(poolValues.price1Before, poolValues.price1After);
            if (poolValues.price1After > poolValues.price1Before) assert(poolValues.liquidity1After > 0);
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

        LimitPoolValues memory poolValues;
        LimitPoolLocals memory poolStructs;
        LiquidityDeltaValues memory values;

        (,poolStructs.pool0, poolStructs.pool1, poolValues.liquidityGlobalBefore,poolValues.positionIdNextBefore,,) = pool.globalState();
        poolValues.price0Before = poolStructs.pool0.price;
        poolValues.liquidity0Before = poolStructs.pool0.liquidity;
        poolValues.price1Before = poolStructs.pool1.price;
        poolValues.liquidity1Before = poolStructs.pool1.liquidity;

        (, poolStructs.lower) = pool.ticks(lower);
        (, poolStructs.upper) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerBefore = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = poolStructs.upper.liquidityAbsolute;

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

        // ACTION 
        pool.mintLimit(params);
        if (posCreated) limitPositions.push(LimitPosition(msg.sender, poolValues.positionIdNextBefore, lower, upper, zeroForOne));

        (, poolStructs.lower) = pool.ticks(lower);
        (, poolStructs.upper) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerAfter = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = poolStructs.upper.liquidityAbsolute;

        values.liquidityDeltaLowerAfter = poolStructs.lower.liquidityDelta;
        values.liquidityDeltaUpperAfter = poolStructs.upper.liquidityDelta;

        (, poolStructs.pool0, poolStructs.pool1, poolValues.liquidityGlobalAfter,poolValues.positionIdNextAfter,,) = pool.globalState();
        poolValues.price0After = poolStructs.pool0.price;
        poolValues.liquidity0After = poolStructs.pool0.liquidity;
        poolValues.price1After = poolStructs.pool1.price;
        poolValues.liquidity1After = poolStructs.pool1.liquidity;
        
        poolValues.price0 = poolStructs.pool0.price;
        poolValues.price1 = poolStructs.pool1.price;

        // POST CONDITIONS

        // Ensure prices have not crossed
        emit Prices(poolValues.price0, poolValues.price1);
        assert(poolValues.price0 >= poolValues.price1);

        // Ensure liquidityDelta is always less or equal to liquidityAbsolute
        emit LiquidityDeltaAndAbsolute(values.liquidityDeltaLowerAfter, poolValues.liquidityAbsoluteLowerAfter);
        assert(int256(values.liquidityDeltaLowerAfter) <= int256(uint256(poolValues.liquidityAbsoluteLowerAfter)));
        emit LiquidityDeltaAndAbsolute(values.liquidityDeltaUpperAfter, poolValues.liquidityAbsoluteUpperAfter);
        assert(int256(values.liquidityDeltaUpperAfter) <= int256(uint256(poolValues.liquidityAbsoluteUpperAfter)));

        // Ensure that liquidityAbsolute is incremented when not undercutting
        if (posCreated) {
            // positionIdNext should have been incremented
            emit PositionIdNext(poolValues.positionIdNextBefore, poolValues.positionIdNextAfter);
            assert(poolValues.positionIdNextAfter == poolValues.positionIdNextBefore + 1);
            if(zeroForOne){
                if(poolValues.price0After >= poolValues.price0Before){
                    emit LiquidityAbsolute(poolValues.liquidityAbsoluteUpperBefore, poolValues.liquidityAbsoluteUpperAfter);
                    assert(poolValues.liquidityAbsoluteUpperAfter > poolValues.liquidityAbsoluteUpperBefore);
                }
            } else {
                if(poolValues.price1Before >= poolValues.price1After){
                    emit LiquidityAbsolute(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
                    assert(poolValues.liquidityAbsoluteLowerAfter > poolValues.liquidityAbsoluteLowerBefore);
                }
            }
        } else {
            // positionIdNext should not have been incremented
            emit PositionIdNext(poolValues.positionIdNextBefore, poolValues.positionIdNextAfter);
            assert(poolValues.positionIdNextAfter == poolValues.positionIdNextBefore);
            if(zeroForOne){
                if(poolValues.price0After >= poolValues.price0Before){
                    emit LiquidityAbsolute(poolValues.liquidityAbsoluteUpperBefore, poolValues.liquidityAbsoluteUpperAfter);
                    assert(poolValues.liquidityAbsoluteUpperAfter == poolValues.liquidityAbsoluteUpperBefore);
                }
            } else {
                if(poolValues.price1Before >= poolValues.price1After){
                    emit LiquidityAbsolute(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
                    assert(poolValues.liquidityAbsoluteLowerAfter == poolValues.liquidityAbsoluteLowerBefore);
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
        
        emit LiquidityGlobal(poolValues.liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        emit Liquidity(poolValues.liquidity0Before, poolValues.liquidity1Before, poolValues.liquidity0After, poolValues.liquidity1After);
        
        // Ensure liquidityGlobal is incremented after mint
        assert(poolValues.liquidityGlobalAfter >= poolValues.liquidityGlobalBefore);

        // Ensure pool liquidity is non-zero after mint with no undercuts
        if (zeroForOne) {
            if (poolValues.price0After < poolValues.price0Before) assert(poolValues.liquidity0After > 0);
        }
        else {
            if (poolValues.price1After > poolValues.price1Before) assert(poolValues.liquidity1After > 0);
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
        pool.swap(params);

        // POST CONDITIONS
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1,,,,) = pool.globalState();
        uint160 price0 = pool0.price;
        uint160 price1 = pool1.price;
        
        // Ensure prices never cross
        emit Prices(price0, price1);
        assert(price0 >= price1);
    }

    function burnLimit(int24 claimAt, uint256 positionIndex, uint128 burnPercent) public {
        // PRE CONDITIONS
        positionIndex = positionIndex % limitPositions.length;
        LimitPosition memory pos = limitPositions[positionIndex];
        require(claimAt >= pos.lower && claimAt <= pos.upper);
        require(claimAt % tickSpacing == 0);
        LimitPoolValues memory poolValues;

        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,,) = pool.globalState();

        LimitPoolStructs.BurnLimitParams memory params;
        params.to = pos.owner;
        params.burnPercent = burnPercent == 1e38 ? burnPercent : _between(burnPercent, 1e36, 1e38); //1e38;
        params.positionId = pos.positionId;
        params.claim = claimAt;
        params.zeroForOne = pos.zeroForOne;

        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(pos.lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(pos.upper);

        poolValues.liquidityAbsoluteLowerBefore = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = upperTick.liquidityAbsolute;
        
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

        (, lowerTick) = pool.ticks(lower);
        (, upperTick) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerAfter = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = upperTick.liquidityAbsolute;

        (,pool0, pool1, poolValues.liquidityGlobalAfter,,,) = pool.globalState();
        uint160 price0 = pool0.price;
        uint160 price1 = pool1.price;
        
        // POST CONDITIONS

        // Ensure prices never cross
        emit Prices(price0, price1);
        assert(price0 >= price1);

        // Ensure liquidityGlobal is decremented after burn
        emit LiquidityGlobal(liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        assert((poolValues.liquidityGlobalAfter <= liquidityGlobalBefore));
    }

    function claim(int24 claimAt, uint256 positionIndex) public {
        // PRE CONDITIONS
        positionIndex = positionIndex % limitPositions.length;
        LimitPosition memory pos = limitPositions[positionIndex];
        claimAt = pos.lower + (claimAt % (pos.upper - pos.lower));
        require(claimAt % tickSpacing == 0);

        LimitPoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,,) = pool.globalState();

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
        (,pool0, pool1, poolValues.liquidityGlobalAfter,,,) = pool.globalState();
        uint160 price0 = pool0.price;
        uint160 price1 = pool1.price;

        // Ensure prices never cross
        emit Prices(price0, price1);
        assert(price0 >= price1);
    }

    function mintThenBurnZeroLiquidityChangeVariable(uint128 amount, bool zeroForOne, int24 lower, int24 upper, uint96 mintPercent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        LimitPoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,,) = pool.globalState();

        LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerBefore = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = upperTick.liquidityAbsolute;

        // ACTION 
        mintLimitVariable(amount, zeroForOne, lower, upper, mintPercent);
        emit PassedMint();
        burnLimit(zeroForOne ? lower : upper, limitPositions.length - 1, 1e38);
        emit PassedBurn();

        // POST CONDITIONS
        (, lowerTick) = pool.ticks(lower);
        (, upperTick) = pool.ticks(upper);

        values.liquidityDeltaLowerAfter = lowerTick.liquidityDelta;
        values.liquidityDeltaUpperAfter = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerAfter = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = upperTick.liquidityAbsolute;
        
        (,pool0, pool1, poolValues.liquidityGlobalAfter,,,) = pool.globalState();
        uint160 price0After = pool0.price;
        uint160 price1After = pool1.price;

        // POST CONDITIONS

        // Ensure prices never cross
        emit Prices(price0After, price1After);
        assert(price0After >= price1After);

        // Ensure liquidityGlobal is decremented after burn
        emit LiquidityGlobal(liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        assert(poolValues.liquidityGlobalAfter == liquidityGlobalBefore);
    }

    function mintThenBurnZeroLiquidityChange(uint128 amount, bool zeroForOne, int24 lower, int24 upper) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        LimitPoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,,) = pool.globalState();

        LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerBefore = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = upperTick.liquidityAbsolute;

        // ACTION 
        mintLimit(amount, zeroForOne, lower, upper);
        emit PassedMint();
        burnLimit(zeroForOne ? lower : upper, limitPositions.length - 1, 1e38);
        emit PassedBurn();

        (, lowerTick) = pool.ticks(lower);
        (, upperTick) = pool.ticks(upper);

        values.liquidityDeltaLowerAfter = lowerTick.liquidityDelta;
        values.liquidityDeltaUpperAfter = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerAfter = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = upperTick.liquidityAbsolute;


        (,pool0, pool1, poolValues.liquidityGlobalAfter,,,) = pool.globalState();
        uint160 price0After = pool0.price;
        uint160 price1After = pool1.price;
        
        // POST CONDITIONS

        // Ensure prices never cross
        emit Prices(price0After, price1After);
        assert(price0After >= price1After);

        // Ensure liquidityGlobal is decremented after burn
        emit LiquidityGlobal(liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        assert(poolValues.liquidityGlobalAfter == liquidityGlobalBefore);
    }

    function mintThenPartialBurnTwiceLiquidityChange(uint128 amount, bool zeroForOne, int24 lower, int24 upper, uint128 percent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        percent = 1 + (percent % (1e38 - 1));
        mintAndApprove();
        LimitPoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,,) = pool.globalState();

        LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerBefore = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = upperTick.liquidityAbsolute;

        // ACTION 
        mintLimit(amount, zeroForOne, lower, upper);
        emit PassedMint();
        burnLimit(zeroForOne ? lower : upper, limitPositions.length - 1, percent);
        emit PassedBurn();
        burnLimit(zeroForOne ? lower : upper, limitPositions.length - 1, 1e38);
        emit PassedBurn();

        (, lowerTick) = pool.ticks(lower);
        (, upperTick) = pool.ticks(upper);

        values.liquidityDeltaLowerAfter = lowerTick.liquidityDelta;
        values.liquidityDeltaUpperAfter = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerAfter = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = upperTick.liquidityAbsolute;

        (,pool0, pool1, poolValues.liquidityGlobalAfter,,,) = pool.globalState();
        uint160 price0After = pool0.price;
        uint160 price1After = pool1.price;

        // POST CONDITIONS

        // Ensure prices never cross
        emit Prices(price0After, price1After);
        assert(price0After >= price1After);

        // Ensure liquidityGlobal is decremented after burn
        emit LiquidityGlobal(liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        assert(poolValues.liquidityGlobalAfter == liquidityGlobalBefore);
    }

    function mintThenPartialBurnTwiceLiquidityChangeVariable(uint128 amount, bool zeroForOne, int24 lower, int24 upper, uint128 percent, uint96 mintPercent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        percent = 1 + (percent % (1e38 - 1));
        mintAndApprove();
        LimitPoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,,) = pool.globalState();

        LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerBefore = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = upperTick.liquidityAbsolute;

        // ACTION 
        mintLimitVariable(amount, zeroForOne, lower, upper, mintPercent);
        emit PassedMint();
        burnLimit(zeroForOne ? lower : upper, limitPositions.length - 1, percent);
        emit PassedBurn();
        burnLimit(zeroForOne ? lower : upper, limitPositions.length - 1, 1e38);
        emit PassedBurn();

        (, lowerTick) = pool.ticks(lower);
        (, upperTick) = pool.ticks(upper);

        values.liquidityDeltaLowerAfter = lowerTick.liquidityDelta;
        values.liquidityDeltaUpperAfter = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerAfter = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = upperTick.liquidityAbsolute;

        (,pool0, pool1, poolValues.liquidityGlobalAfter,,,) = pool.globalState();
        uint160 price0After = pool0.price;
        uint160 price1After = pool1.price;
        
        // POST CONDITIONS

        // Ensure prices never cross
        emit Prices(price0After, price1After);
        assert(price0After >= price1After);

        // Ensure liquidityGlobal is decremented after burn
        emit LiquidityGlobal(liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        assert(poolValues.liquidityGlobalAfter == liquidityGlobalBefore);
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

        RangePoolValues memory poolValues;
        RangePoolLocals memory poolStructs;
        LiquidityDeltaValues memory values;

        (poolStructs.pool,,, poolValues.liquidityGlobalBefore,poolValues.positionIdNextBefore,,) = pool.globalState();
        poolValues.priceBefore = poolStructs.pool.price;
        poolValues.liquidityBefore = poolStructs.pool.liquidity;

        (poolStructs.lower,) = pool.ticks(lower);
        (poolStructs.upper,) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerBefore = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = poolStructs.upper.liquidityAbsolute;

        poolValues.constants = pool.immutables();

        RangePoolStructs.MintRangeParams memory params;
        params.to = msg.sender;
        params.amount0 = amount0;
        params.amount1 = amount1;
        params.lower = lower;
        params.upper = upper;

        // Get the ticks the position will be minted with rather than what was passed directly by fuzzer
        // This is so the we can properly compare before and after mint states of particular ticks.
        bool posCreated = false;

        poolValues.liquidityMinted = ConstantProduct.getLiquidityForAmounts(
            ConstantProduct.getPriceAtTick(lower, poolValues.constants),
            ConstantProduct.getPriceAtTick(upper, poolValues.constants),
            poolStructs.pool.price,
            params.amount1,
            params.amount0
        );
        if (poolValues.liquidityMinted > 0) posCreated = true;
        emit PositionTicks(lower, upper);
        emit PositionCreated(posCreated);

        // ACTION 
        pool.mintRange(params);
        if (posCreated) rangePositions.push(RangePosition(msg.sender, poolValues.positionIdNextBefore, lower, upper));

        (poolStructs.lower,) = pool.ticks(lower);
        (poolStructs.upper,) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerAfter = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = poolStructs.upper.liquidityAbsolute;

        values.liquidityDeltaLowerAfter = poolStructs.lower.liquidityDelta;
        values.liquidityDeltaUpperAfter = poolStructs.upper.liquidityDelta;

        (poolStructs.pool,,, poolValues.liquidityGlobalAfter,poolValues.positionIdNextAfter,,) = pool.globalState();
        poolValues.priceAfter = poolStructs.pool.price;
        poolValues.liquidityAfter = poolStructs.pool.liquidity;
        
        // POST CONDITIONS
        
        // Ensure that liquidityAbsolute is incremented if position created
        if (posCreated) {
            // positionIdNext should have been incremented
            emit PositionIdNext(poolValues.positionIdNextBefore, poolValues.positionIdNextAfter);
            assert(poolValues.positionIdNextAfter == poolValues.positionIdNextBefore + 1);
            emit LiquidityAbsoluteLower(poolValues.liquidityAbsoluteUpperBefore, poolValues.liquidityAbsoluteUpperAfter);
            assert(poolValues.liquidityAbsoluteUpperAfter > poolValues.liquidityAbsoluteUpperBefore);
            emit LiquidityAbsoluteUpper(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
            assert(poolValues.liquidityAbsoluteLowerAfter > poolValues.liquidityAbsoluteLowerBefore);
        } else {
            // positionIdNext should not have been incremented
            emit PositionIdNext(poolValues.positionIdNextBefore, poolValues.positionIdNextAfter);
            assert(poolValues.positionIdNextAfter == poolValues.positionIdNextBefore);
            emit LiquidityAbsoluteLower(poolValues.liquidityAbsoluteUpperBefore, poolValues.liquidityAbsoluteUpperAfter);
            assert(poolValues.liquidityAbsoluteUpperAfter == poolValues.liquidityAbsoluteUpperBefore);
            emit LiquidityAbsoluteUpper(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
            assert(poolValues.liquidityAbsoluteLowerAfter == poolValues.liquidityAbsoluteLowerBefore);
        }

        if (posCreated) {
            emit PositionTicks(lower, upper);
            // Ensure positions ticks arent crossed
            assert(lower < upper);
            // Ensure minted ticks on proper tick spacing
            assert((lower % tickSpacing == 0) && (upper % tickSpacing == 0));
        }
        
        emit LiquidityGlobal(poolValues.liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        emit LiquidityRange(poolValues.liquidityBefore, poolValues.liquidityAfter);
        
        // Ensure liquidityGlobal is incremented after mint
        if (posCreated) {
            assert(poolValues.liquidityGlobalAfter > poolValues.liquidityGlobalBefore);
        } else {
            assert(poolValues.liquidityGlobalAfter == poolValues.liquidityGlobalBefore);
        }
        
        // Ensure prices does not change
        emit PriceChange(poolValues.priceBefore, poolValues.priceAfter);
        assert(poolValues.priceBefore == poolValues.priceAfter);
    }

    function burnRange(uint256 positionIndex, uint128 burnPercent) public {
        // PRE CONDITIONS
        positionIndex = positionIndex % rangePositions.length;
        RangePosition memory pos = rangePositions[positionIndex];
        RangePoolValues memory poolValues;
        RangePoolLocals memory poolStructs;

        (poolStructs.pool,,, poolValues.liquidityGlobalBefore,poolValues.positionIdNextBefore,,) = pool.globalState();
        poolValues.priceBefore = poolStructs.pool.price;
        poolValues.liquidityBefore = poolStructs.pool.liquidity;

        (poolStructs.lower,) = pool.ticks(pos.lower);
        (poolStructs.upper,) = pool.ticks(pos.upper);
        poolValues.liquidityAbsoluteLowerBefore = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = poolStructs.upper.liquidityAbsolute;

        RangePoolStructs.BurnRangeParams memory params;
        params.to = pos.owner;
        params.burnPercent = burnPercent == 1e38 ? burnPercent : _between(burnPercent, 1e36, 1e38); //1e38;
        params.positionId = pos.positionId;
        
        emit PositionTicks(pos.lower, pos.upper);
        // (int24 lower, int24 upper, bool positionExists) = pool.getResizedTicksForBurn(params);
        // emit BurnTicks(lower, upper, positionExists);
        bool positionExists = false;
        (,,uint128 positionLiquidity,,) = pool.positions(pos.positionId);
        if (positionLiquidity > 0) positionExists = true;

        // ACTION
        pool.burnRange(params);
        if (params.burnPercent == 1e38) {
            delete rangePositions[positionIndex];
        }

        (poolStructs.lower,) = pool.ticks(pos.lower);
        (poolStructs.upper,) = pool.ticks(pos.upper);

        poolValues.liquidityAbsoluteLowerAfter = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = poolStructs.upper.liquidityAbsolute;

        (poolStructs.pool,,, poolValues.liquidityGlobalBefore,poolValues.positionIdNextBefore,,) = pool.globalState();
        poolValues.priceAfter = poolStructs.pool.price;
        poolValues.liquidityAfter = poolStructs.pool.liquidity;
        
        // POST CONDITIONS

        // Ensure liquidityGlobal is decremented after burn
        emit LiquidityGlobal(poolValues.liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        emit LiquidityRange(poolValues.liquidityBefore, poolValues.liquidityAfter);
        assert(poolValues.liquidityAfter <= poolValues.liquidityBefore);
        assert(poolValues.liquidityGlobalAfter <= poolValues.liquidityGlobalBefore);
    }

    function compoundRange(uint256 positionIndex) public {
        // PRE CONDITIONS
        positionIndex = positionIndex % rangePositions.length;
        RangePosition memory pos = rangePositions[positionIndex];
        RangePoolValues memory poolValues;
        RangePoolLocals memory poolStructs;

        (poolStructs.pool,,, poolValues.liquidityGlobalBefore,poolValues.positionIdNextBefore,,) = pool.globalState();
        poolValues.priceBefore = poolStructs.pool.price;
        poolValues.liquidityBefore = poolStructs.pool.liquidity;

        (poolStructs.lower,) = pool.ticks(pos.lower);
        (poolStructs.upper,) = pool.ticks(pos.upper);
        poolValues.liquidityAbsoluteLowerBefore = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = poolStructs.upper.liquidityAbsolute;

        RangePoolStructs.BurnRangeParams memory params;
        params.to = pos.owner;
        params.burnPercent = 0; //0 to compound
        params.positionId = pos.positionId;
        
        emit PositionTicks(pos.lower, pos.upper);
        // (int24 lower, int24 upper, bool positionExists) = pool.getResizedTicksForBurn(params);
        // emit BurnTicks(lower, upper, positionExists);
        bool positionExists = false;
        (,,uint128 positionLiquidity,,) = pool.positions(pos.positionId);
        if (positionLiquidity > 0) positionExists = true;

        // ACTION
        pool.burnRange(params);

        // position should still exist if it did before

        (poolStructs.lower,) = pool.ticks(pos.lower);
        (poolStructs.upper,) = pool.ticks(pos.upper);

        poolValues.liquidityAbsoluteLowerAfter = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = poolStructs.upper.liquidityAbsolute;

        (poolStructs.pool,,, poolValues.liquidityGlobalBefore,poolValues.positionIdNextBefore,,) = pool.globalState();
        poolValues.priceAfter = poolStructs.pool.price;
        poolValues.liquidityAfter = poolStructs.pool.liquidity;
        
        // POST CONDITIONS

        // Ensure liquidityGlobal is decremented after burn
        emit LiquidityGlobal(poolValues.liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        emit LiquidityRange(poolValues.liquidityBefore, poolValues.liquidityAfter);
        assert(poolValues.liquidityAfter >= poolValues.liquidityBefore);
        assert(poolValues.liquidityGlobalAfter >= poolValues.liquidityGlobalBefore);
    }

    function collectRange(uint256 positionIndex) public {
        // PRE CONDITIONS
        positionIndex = positionIndex % rangePositions.length;
        RangePosition memory pos = rangePositions[positionIndex];
        RangePoolValues memory poolValues;
        RangePoolLocals memory poolStructs;

        (poolStructs.pool,,, poolValues.liquidityGlobalBefore,poolValues.positionIdNextBefore,,) = pool.globalState();
        poolValues.priceBefore = poolStructs.pool.price;
        poolValues.liquidityBefore = poolStructs.pool.liquidity;

        (poolStructs.lower,) = pool.ticks(pos.lower);
        (poolStructs.upper,) = pool.ticks(pos.upper);
        poolValues.liquidityAbsoluteLowerBefore = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = poolStructs.upper.liquidityAbsolute;

        RangePoolStructs.BurnRangeParams memory params;
        params.to = pos.owner;
        params.burnPercent = 1; //1 for collect
        params.positionId = pos.positionId;
        
        emit PositionTicks(pos.lower, pos.upper);
        // (int24 lower, int24 upper, bool positionExists) = pool.getResizedTicksForBurn(params);
        // emit BurnTicks(lower, upper, positionExists);
        bool positionExists = false;
        (,,uint128 positionLiquidity,,) = pool.positions(pos.positionId);
        if (positionLiquidity > 0) positionExists = true;

        // ACTION
        pool.burnRange(params);

        // position should still exist if it did before

        (poolStructs.lower,) = pool.ticks(pos.lower);
        (poolStructs.upper,) = pool.ticks(pos.upper);

        poolValues.liquidityAbsoluteLowerAfter = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = poolStructs.upper.liquidityAbsolute;

        (poolStructs.pool,,, poolValues.liquidityGlobalBefore,poolValues.positionIdNextBefore,,) = pool.globalState();
        poolValues.priceAfter = poolStructs.pool.price;
        poolValues.liquidityAfter = poolStructs.pool.liquidity;
        
        // POST CONDITIONS

        // Ensure liquidityGlobal is decremented after burn
        emit LiquidityGlobal(poolValues.liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        emit LiquidityRange(poolValues.liquidityBefore, poolValues.liquidityAfter);
        assert(poolValues.liquidityAfter <= poolValues.liquidityBefore);
        assert(poolValues.liquidityGlobalAfter <= poolValues.liquidityGlobalBefore);
    }

    function mintRangeThenBurnZeroLiquidityChange(uint128 amount0, uint128 amount1, int24 lower, int24 upper) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        RangePoolValues memory poolValues;
        RangePoolLocals memory poolStructs;

        (poolStructs.pool,,, poolValues.liquidityGlobalBefore,poolValues.positionIdNextBefore,,) = pool.globalState();
        poolValues.priceBefore = poolStructs.pool.price;
        poolValues.liquidityBefore = poolStructs.pool.liquidity;

        (poolStructs.lower,) = pool.ticks(lower);
        (poolStructs.upper,) = pool.ticks(upper);
        poolValues.liquidityAbsoluteLowerBefore = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = poolStructs.upper.liquidityAbsolute;

        // ACTION 
        mintRange(amount0, amount1, lower, upper);
        emit PassedMintRange();
        burnRange(rangePositions.length - 1, 1e38);
        emit PassedBurnRange();

        (poolStructs.pool,,, poolValues.liquidityGlobalAfter,poolValues.positionIdNextAfter,,) = pool.globalState();
        poolValues.priceAfter = poolStructs.pool.price;
        poolValues.liquidityAfter = poolStructs.pool.liquidity;

        (poolStructs.lower,) = pool.ticks(lower);
        (poolStructs.upper,) = pool.ticks(upper);
        poolValues.liquidityAbsoluteLowerAfter = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = poolStructs.upper.liquidityAbsolute;
        
        // POST CONDITIONS

        // Ensure prices never cross
        emit Prices(poolValues.priceBefore, poolValues.priceAfter);
        assert(poolValues.priceBefore == poolValues.priceAfter);

        // Ensure liquidityGlobal is equal
        emit LiquidityGlobal(poolValues.liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        assert(poolValues.liquidityGlobalBefore == poolValues.liquidityGlobalAfter);
    }

    function mintRangeThenPartialBurnTwiceLiquidityChange(uint128 amount0, uint128 amount1, int24 lower, int24 upper, uint128 percent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        percent = 1 + (percent % (1e38 - 1));
        mintAndApprove();
        RangePoolValues memory poolValues;
        RangePoolLocals memory poolStructs;

        (poolStructs.pool,,, poolValues.liquidityGlobalBefore,poolValues.positionIdNextBefore,,) = pool.globalState();
        poolValues.priceBefore = poolStructs.pool.price;
        poolValues.liquidityBefore = poolStructs.pool.liquidity;

        (poolStructs.lower,) = pool.ticks(lower);
        (poolStructs.upper,) = pool.ticks(upper);
        poolValues.liquidityAbsoluteLowerBefore = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = poolStructs.upper.liquidityAbsolute;

        // ACTION 
        mintRange(amount0, amount1, lower, upper);
        emit PassedMintRange();
        burnRange(rangePositions.length - 1, percent);
        emit PassedBurnRange();
        burnRange(rangePositions.length - 1, 1e38);
        emit PassedBurnRange();

        (poolStructs.pool,,, poolValues.liquidityGlobalAfter,poolValues.positionIdNextAfter,,) = pool.globalState();
        poolValues.priceAfter = poolStructs.pool.price;
        poolValues.liquidityAfter = poolStructs.pool.liquidity;

        (poolStructs.lower,) = pool.ticks(lower);
        (poolStructs.upper,) = pool.ticks(upper);
        poolValues.liquidityAbsoluteLowerAfter = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = poolStructs.upper.liquidityAbsolute;

        // POST CONDITIONS

        // Ensure prices never cross
        emit Prices(poolValues.priceBefore, poolValues.priceAfter);
        assert(poolValues.priceBefore == poolValues.priceAfter);

        // Ensure liquidityGlobal is equal
        emit LiquidityGlobal(poolValues.liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        assert(poolValues.liquidityGlobalBefore == poolValues.liquidityGlobalAfter);
    }

    function limitPoolSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        address token0 = LimitPool(pool).token0();
        address token1 = LimitPool(pool).token1();
        if (amount0Delta < 0) {
            SafeTransfers.transferInto(token0, address(pool), uint256(-amount0Delta));
        } else {
            SafeTransfers.transferInto(token1, address(pool), uint256(-amount1Delta));
        }
    }

    function mintAndApprove() internal {
        tokenIn.mint(msg.sender, 100000000000 ether);
        tokenOut.mint(msg.sender, 100000000000 ether);
        tokenIn.mint(address(this), 100000000000 ether);
        tokenOut.mint(address(this), 100000000000 ether);
        tokenIn.approve(address(pool), type(uint256).max);
        tokenOut.approve(address(pool), type(uint256).max);
    }

    function _between(uint128 val, uint low, uint high) internal pure returns(uint128) {
        return uint128(low + (val % (high-low +1))); 
    }

    function liquidityMintedBackcalculates(uint128 amount, bool zeroForOne, int24 lower, int24 upper) tickPreconditions(lower, upper) internal {
        // NOTE: Do not use the exact inputs of this function for POCs, use the inputs after the input validation
        amount = amount + 1e5 + 1;
        LimitPoolStructs.Immutables memory immutables = pool.immutables();
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
