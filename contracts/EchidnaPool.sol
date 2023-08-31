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
    event Prices(uint160 price0, uint160 price1);
    event LiquidityGlobal(uint128 liqBefore, uint128 liqAfter);
    event Liquidity(uint128 liq0Before, uint128 liq1Before, uint128 liq0After, uint128 liq1After);
    event PositionTicks(int24 lower, int24 upper);
    event BurnTicks(int24 lower, int24 upper, bool positionExists);
    event LiquidityMinted(uint256 amount, uint256 tokenAmount, bool zeroForOne);
    event PositionCreated(bool isCreated);
    event LiquidityAbsolute(uint128 beforeAbs, uint128 afterAbs);
    event LiquidityDeltaAndAbsolute(int128 delta, uint128 abs);
    event PriceChange(uint160 priceBefore, uint160 priceAfter);
    event PositionIdNext(uint32 idNextBefore, uint32 idNextAfter);

    int16 tickSpacing;
    uint16 swapFee;
    address private implementation;
    LimitPoolFactory private factory;
    LimitPoolManager private manager;
    PositionERC1155 private rangePool;
    LimitPool private pool;
    Token20 private tokenIn;
    Token20 private tokenOut;
    Position[] private positions;

    struct LiquidityDeltaValues {
        int128 liquidityDeltaLowerAfter;
        int128 liquidityDeltaUpperAfter;
    }

    struct PoolValues {
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

    struct SwapCallbackData {
        address sender;
    }

    struct Position {
        address owner;
        uint32 positionId;
        int24 lower;
        int24 upper;
        bool zeroForOne;
    }

    struct PoolStructs {
        PoolsharkStructs.LimitTick lower;
        PoolsharkStructs.LimitTick upper;
        PoolsharkStructs.LimitPoolState pool0;
        PoolsharkStructs.LimitPoolState pool1;
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
        rangePool = new PositionERC1155(address(factory));
        
        manager.enableImplementation(bytes32(0x0), address(implementation), address(rangePool));
        tickSpacing = 10;
        tokenIn = new Token20("IN", "IN", 18);
        tokenOut = new Token20("OUT", "OUT", 18);
        (address poolAddr,) = factory.createLimitPool(bytes32(0x0), address(tokenIn), address(tokenOut), 500, 79228162514264337593543950336);
        pool = LimitPool(poolAddr);
    }

    function mint(uint128 amount, bool zeroForOne, int24 lower, int24 upper) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        amount = amount + 1;
        // Ensure the newly created position is using different ticks
        for(uint i = 0; i < positions.length;) {
            if(positions[i].owner == msg.sender && positions[i].lower == lower && positions[i].upper == upper && positions[i].zeroForOne == zeroForOne) {
                revert("Position already exists");
            }
            unchecked {
                ++i;
            }
        }

        PoolValues memory poolValues;
        PoolStructs memory poolStructs;
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
        if (posCreated) positions.push(Position(msg.sender, poolValues.positionIdNextBefore, lower, upper, zeroForOne));

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

    function mintVariable(uint128 amount, bool zeroForOne, int24 lower, int24 upper, uint96 mintPercent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        amount = amount + 1;
        // Ensure the newly created position is using different ticks
        for(uint i = 0; i < positions.length;) {
            if(positions[i].owner == msg.sender && positions[i].lower == lower && positions[i].upper == upper && positions[i].zeroForOne == zeroForOne) {
                revert("Position already exists");
            }
            unchecked {
                ++i;
            }
        }

        PoolValues memory poolValues;
        PoolStructs memory poolStructs;
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
        if (posCreated) positions.push(Position(msg.sender, poolValues.positionIdNextBefore, lower, upper, zeroForOne));

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

    function burn(int24 claimAt, uint256 positionIndex, uint128 burnPercent) public {
        // PRE CONDITIONS
        positionIndex = positionIndex % positions.length;
        Position memory pos = positions[positionIndex];
        require(claimAt >= pos.lower && claimAt <= pos.upper);
        require(claimAt % tickSpacing == 0);
        PoolValues memory poolValues;

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
            positions[positionIndex] = positions[positions.length - 1];
            delete positions[positions.length - 1];
        }
        else {
            // Update position data in array if not fully burned
            positions[positionIndex] = Position(pos.owner, pos.positionId, lower, upper, pos.zeroForOne);
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
        positionIndex = positionIndex % positions.length;
        Position memory pos = positions[positionIndex];
        claimAt = pos.lower + (claimAt % (pos.upper - pos.lower));
        require(claimAt % tickSpacing == 0);

        PoolValues memory poolValues;
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
            positions[positionIndex] = positions[positions.length - 1];
            delete positions[positions.length - 1];
        }
        else {
            // Update position data in array if not fully burned
            positions[positionIndex] = Position(pos.owner, pos.positionId, lower, upper, pos.zeroForOne);
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
        PoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,,) = pool.globalState();

        LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerBefore = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = upperTick.liquidityAbsolute;

        // ACTION 
        mintVariable(amount, zeroForOne, lower, upper, mintPercent);
        emit PassedMint();
        burn(zeroForOne ? lower : upper, positions.length - 1, 1e38);
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
        PoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,,) = pool.globalState();

        LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerBefore = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = upperTick.liquidityAbsolute;

        // ACTION 
        mint(amount, zeroForOne, lower, upper);
        emit PassedMint();
        burn(zeroForOne ? lower : upper, positions.length - 1, 1e38);
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
        PoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,,) = pool.globalState();

        LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerBefore = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = upperTick.liquidityAbsolute;

        // ACTION 
        mint(amount, zeroForOne, lower, upper);
        emit PassedMint();
        burn(zeroForOne ? lower : upper, positions.length - 1, percent);
        emit PassedBurn();
        burn(zeroForOne ? lower : upper, positions.length - 1, 1e38);
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
        PoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,,) = pool.globalState();

        LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(upper);

        poolValues.liquidityAbsoluteLowerBefore = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = upperTick.liquidityAbsolute;

        // ACTION 
        mintVariable(amount, zeroForOne, lower, upper, mintPercent);
        emit PassedMint();
        burn(zeroForOne ? lower : upper, positions.length - 1, percent);
        emit PassedBurn();
        burn(zeroForOne ? lower : upper, positions.length - 1, 1e38);
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

    function poolsharkSwapCallback(
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