// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

// import './interfaces/ILimitPool.sol';
// import './interfaces/ILimitPoolManager.sol';
// import './interfaces/limit/ILimitPoolStructs.sol';
// import './base/storage/LimitPoolStorage.sol';
import './LimitPool.sol';
import './LimitPoolFactory.sol';
import './utils/LimitPoolManager.sol';
import './test/Token20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import './libraries/utils/SafeTransfers.sol';
import './utils/RangePoolERC1155.sol';
import './base/structs/PoolsharkStructs.sol';


// Fuzz LimitPool functionality
contract EchidnaPool {

    event Address(address a);
    event Price(uint160 price);
    event Prices(uint160 price0, uint160 price1);
    event LiquidityGlobal(uint128 liqBefore, uint128 liqAfter);
    event Liquidity(uint128 liq0Before, uint128 liq1Before, uint128 liq0After, uint128 liq1After);
    event LiquidityDelta(int128 liqLowerBefore, int128 liqUpperBefore, int128 liqLowerAfter, int128 liqUperAfter);
    event Amount(uint256 amt);
    event PassedMint();
    event PassedBurn();
    event PositionTicks(int24 lower, int24 upper);
    event BurnTicks(int24 lower, int24 upper, bool positionExists);
    event LiquidityMinted(uint256 amount, uint256 tokenAmount, bool zeroForOne);
    event PositionCreated(bool isCreated);
    event liquidityDeltaAfterUndercut(bool zeroForOne, int128 liquidityDeltaBefore, int128 liquidityDeltaAfter);
    event AssertFailTest(string message, uint160 priceAfter, uint160 priceBefore);
    event LiquidityAbsolute(uint128 beforeAbs, uint128 afterAbs);

    LimitPoolFactory private factory;
    address private implementation;
    LimitPoolManager private manager;
    RangePoolERC1155 private rangePool;
    LimitPool private pool;
    Token20 private tokenIn;
    Token20 private tokenOut;
    Position[] private positions;
    int16 tickSpacing;
    uint16 swapFee;

    struct LiquidityDeltaValues {
        int128 liquidityDeltaLowerBefore;
        int128 liquidityDeltaUpperBefore;
        int128 liquidityDeltaLowerAfter;
        int128 liquidityDeltaUpperAfter;
    }

    struct PoolValues {
        uint160 price0Before;
        uint128 liquidity0Before;
        uint160 price1Before;
        // uint128 liquidityGlobal1Before;
        uint128 liquidity1Before;
        uint160 price0After;
        uint128 liquidity0After;
        uint160 price1After;
        uint128 liquidity1After;
        // uint128 liquidityGlobal1After;

        uint128 liquidityGlobalBefore;
        uint128 liquidityGlobalAfter;

        uint128 liquidityAbsoluteUpperBefore;
        uint128 liquidityAbsoluteLowerBefore;
        uint128 liquidityAbsoluteUpperAfter;
        uint128 liquidityAbsoluteLowerAfter;

        // int128 liquidityDeltaAtPrice0Before;
        // int128 liquidityDeltaAtPrice1Before;

        // int128 liquidityDeltaAtPrice0After;
        // int128 liquidityDeltaAtPrice1After;

        uint160 price0;
        uint160 price1;
    }

    struct SwapCallbackData {
        address sender;
    }

    struct Position {
        address owner;
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
        rangePool = new RangePoolERC1155(address(factory));
        
        manager.enableImplementation(bytes32(0x0), address(implementation), address(rangePool));
        tickSpacing = 10;
        // manager.enableTickSpacing(tickSpacing,500);
        tokenIn = new Token20("IN", "IN", 18);
        tokenOut = new Token20("OUT", "OUT", 18);
        (address poolAddr,) = factory.createLimitPool(bytes32(0x0), address(tokenIn), address(tokenOut), 500, 79228162514264337593543950336);
        pool = LimitPool(poolAddr);
        // pool.fees(500, 500, true);
    }

    function mint(uint128 amount, bool zeroForOne, int24 lower, int24 upper) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        // NOTE: Do not use the exact inputs of this function for POCs, use the inputs after the input validation
        mintAndApprove();
        amount = amount + 1;
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

        (,poolStructs.pool0, poolStructs.pool1, poolValues.liquidityGlobalBefore,,) = pool.globalState();
        poolValues.price0Before = poolStructs.pool0.price;
        poolValues.liquidity0Before = poolStructs.pool0.liquidity;
        poolValues.price1Before = poolStructs.pool1.price;
        poolValues.liquidity1Before = poolStructs.pool1.liquidity;

        // LiquidityDeltaValues memory values;
        (, poolStructs.lower) = pool.ticks(lower);
        (, poolStructs.upper) = pool.ticks(upper);

        // values.liquidityDeltaLowerBefore = lowerTick.liquidityDelta;
        // values.liquidityDeltaUpperBefore = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerBefore = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = poolStructs.upper.liquidityAbsolute;


        ILimitPoolStructs.MintLimitParams memory params;
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
        if (posCreated) positions.push(Position(msg.sender, lower, upper, zeroForOne));

        (, poolStructs.lower) = pool.ticks(lower);
        (, poolStructs.upper) = pool.ticks(upper);

        // values.liquidityDeltaLowerAfter = lowerTick.liquidityDelta;
        // values.liquidityDeltaUpperAfter = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerAfter = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = poolStructs.upper.liquidityAbsolute;

        (, poolStructs.pool0, poolStructs.pool1, poolValues.liquidityGlobalAfter,,) = pool.globalState();
        poolValues.price0After = poolStructs.pool0.price;
        poolValues.liquidity0After = poolStructs.pool0.liquidity;
        poolValues.price1After = poolStructs.pool1.price;
        poolValues.liquidity1After = poolStructs.pool1.liquidity;
        poolValues.price0 = poolStructs.pool0.price;
        poolValues.price1 = poolStructs.pool1.price;
        emit Prices(poolValues.price0, poolValues.price1);
        assert(poolValues.price0 >= poolValues.price1);
        emit Prices(poolValues.price0After, poolValues.price1After);

        // POST CONDITIONS

        // TODO: Create an invariant that combines liquidity delta and liquidity absolute
        
        // Ensure that liquidityAbsolute is incremented when not undercutting
        if(zeroForOne){
            if(poolValues.price0After >= poolValues.price0Before){
                emit LiquidityAbsolute(poolValues.liquidityAbsoluteUpperBefore, poolValues.liquidityAbsoluteUpperAfter);
                assert(poolValues.liquidityAbsoluteUpperAfter >= poolValues.liquidityAbsoluteUpperBefore);
            }
        } else {
            if(poolValues.price1Before >= poolValues.price1After){
                emit LiquidityAbsolute(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
                assert(poolValues.liquidityAbsoluteLowerAfter >= poolValues.liquidityAbsoluteLowerBefore);
            }
        }
        // Check that liqudityAbsolute is decremented on undercut

        // if(zeroForOne){
        //     if(poolValues.price0After < poolValues.price0Before){
        //         emit LiquidityAbsolute(poolValues.liquidityAbsoluteUpperBefore, poolValues.liquidityAbsoluteUpperAfter);
        //         assert(poolValues.liquidityAbsoluteUpperAfter < poolValues.liquidityAbsoluteUpperBefore);
        //     }
        // } else {
        //     if(poolValues.price1Before < poolValues.price1After){
        //         emit LiquidityAbsolute(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
        //         assert(poolValues.liquidityAbsoluteLowerAfter < poolValues.liquidityAbsoluteLowerBefore);
        //     }
        // }

        // Ensure prices have not crossed
        assert(poolValues.price0After >= poolValues.price1After);
        if (posCreated) {
            // Ensure positions ticks arent crossed
            assert(lower < upper);
            // Ensure minted ticks on proper tick spacing
            assert((lower % tickSpacing == 0) && (upper % tickSpacing == 0));
        }
        
        emit LiquidityGlobal(poolValues.liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        emit Liquidity(poolValues.liquidity0Before, poolValues.liquidity1Before, poolValues.liquidity0After, poolValues.liquidity1After);
        // emit LiquidityDelta(values.liquidityDeltaLowerBefore, values.liquidityDeltaUpperBefore, values.liquidityDeltaLowerAfter, values.liquidityDeltaUpperAfter);
        
        // Ensure pool.liquity is incremented when undercutting
        assert(poolValues.liquidityGlobalAfter >= poolValues.liquidityGlobalBefore);
        if (zeroForOne) {
            // Ensure liquidity does not decrease on mint
            if (poolValues.price0After < poolValues.price0Before) {
                emit AssertFailTest("poolValues.price0After < poolValues.price0Before", poolValues.price0After, poolValues.price0Before);
                assert(poolValues.liquidity0After > 0);
            }

            // Doesn't hold due to insertSingle stashing pool liquidity on tick to save
            // if (posCreated) {
            //     assert(values.liquidityDeltaLowerAfter >= values.liquidityDeltaLowerBefore);
            //     assert(values.liquidityDeltaUpperAfter <= values.liquidityDeltaUpperBefore);
            // }
        }
        else {
            // Ensure pool.liquity is incremented when undercutting
            if (poolValues.price1After > poolValues.price1Before) {
                emit AssertFailTest("poolValues.price1After > poolValues.price1Before", poolValues.price1After, poolValues.price1Before);
                assert(poolValues.liquidity1After > 0);
            }

            // if (posCreated) {
            //     assert(values.liquidityDeltaUpperAfter >= values.liquidityDeltaUpperBefore);
            //     assert(values.liquidityDeltaLowerAfter <= values.liquidityDeltaLowerBefore);
            // }
            
        }
    }

    function mintVariable(uint128 amount, bool zeroForOne, int24 lower, int24 upper, uint96 mintPercent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        // NOTE: Do not use the exact inputs of this function for POCs, use the inputs after the input validation
        mintAndApprove();
        amount = amount + 1;
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

        (,poolStructs.pool0, poolStructs.pool1, poolValues.liquidityGlobalBefore,,) = pool.globalState();
        poolValues.price0Before = poolStructs.pool0.price;
        poolValues.liquidity0Before = poolStructs.pool0.liquidity;
        poolValues.price1Before = poolStructs.pool1.price;
        poolValues.liquidity1Before = poolStructs.pool1.liquidity;

        // LiquidityDeltaValues memory values;
        (, poolStructs.lower) = pool.ticks(lower);
        (, poolStructs.upper) = pool.ticks(upper);

        // values.liquidityDeltaLowerBefore = lowerTick.liquidityDelta;
        // values.liquidityDeltaUpperBefore = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerBefore = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = poolStructs.upper.liquidityAbsolute;

        ILimitPoolStructs.MintLimitParams memory params;
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
        if (posCreated) positions.push(Position(msg.sender, lower, upper, zeroForOne));

        (, poolStructs.lower) = pool.ticks(lower);
        (, poolStructs.upper) = pool.ticks(upper);

        // values.liquidityDeltaLowerAfter = poolStructs.lower.liquidityDelta;
        // values.liquidityDeltaUpperAfter = poolStructs.upper.liquidityDelta;
        poolValues.liquidityAbsoluteLowerAfter = poolStructs.lower.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = poolStructs.upper.liquidityAbsolute;

        (, poolStructs.pool0, poolStructs.pool1, poolValues.liquidityGlobalAfter,,) = pool.globalState();
        poolValues.price0After = poolStructs.pool0.price;
        poolValues.liquidity0After = poolStructs.pool0.liquidity;
        poolValues.price1After = poolStructs.pool1.price;
        poolValues.liquidity1After = poolStructs.pool1.liquidity;

        
        poolValues.price0 = poolStructs.pool0.price;
        poolValues.price1 = poolStructs.pool1.price;
        emit Prices(poolValues.price0, poolValues.price1);
        assert(poolValues.price0 >= poolValues.price1);
        emit Prices(poolValues.price0After, poolValues.price1After);

        // POST CONDITIONS

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

        // Ensure prices have not crossed
        assert(poolValues.price0After >= poolValues.price1After);
        if (posCreated) {
            // Ensure positions ticks arent crossed
            assert(lower < upper);
            // Ensure minted ticks on proper tick spacing
            assert((lower % tickSpacing == 0) && (upper % tickSpacing == 0));
        }
        
        emit LiquidityGlobal(poolValues.liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        emit Liquidity(poolValues.liquidity0Before, poolValues.liquidity1Before, poolValues.liquidity0After, poolValues.liquidity1After);
        // emit LiquidityDelta(values.liquidityDeltaLowerBefore, values.liquidityDeltaUpperBefore, values.liquidityDeltaLowerAfter, values.liquidityDeltaUpperAfter);
        
        // Ensure pool.liquity is incremented when undercutting
        assert(poolValues.liquidityGlobalAfter >= poolValues.liquidityGlobalBefore);
        if (zeroForOne) {
            // Ensure liquidity does not decrease on mint
            if (poolValues.price0After < poolValues.price0Before) {
                emit AssertFailTest("poolValues.price0After < poolValues.price0Before", poolValues.price0After, poolValues.price0Before);
                assert(poolValues.liquidity0After > 0);
            }

            // Doesn't hold due to insertSingle stashing pool liquidity on tick to save
            // if (posCreated) {
            //     assert(values.liquidityDeltaLowerAfter >= values.liquidityDeltaLowerBefore);
            //     assert(values.liquidityDeltaUpperAfter <= values.liquidityDeltaUpperBefore);
            // }
        }
        else {
            // Ensure pool.liquity is incremented when undercutting
            if (poolValues.price1After > poolValues.price1Before) {
                emit AssertFailTest("poolValues.price1After > poolValues.price1Before", poolValues.price1After, poolValues.price1Before);
                assert(poolValues.liquidity1After > 0);
            }

            // if (posCreated) {
            //     assert(values.liquidityDeltaUpperAfter >= values.liquidityDeltaUpperBefore);
            //     assert(values.liquidityDeltaLowerAfter <= values.liquidityDeltaLowerBefore);
            // }
            
        }
    }

    function swap(uint160 priceLimit, uint128 amount, bool exactIn, bool zeroForOne) public {
        // PRE CONDITIONS
        // NOTE: Do not use the exact inputs of this function for POCs, use the inputs after the input validation
        mintAndApprove();

        // TODO: Can do a check for liquidity absolute here probably

        // ACTION
        ILimitPoolStructs.SwapParams memory params;
        params.to = msg.sender;
        params.priceLimit = priceLimit;
        params.amount = amount;
        params.exactIn = exactIn;
        params.zeroForOne = zeroForOne;
        params.callbackData = abi.encodePacked(address(this));

        pool.swap(params);

        // POST CONDITIONS
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1,,,) = pool.globalState();
        uint160 price0 = pool0.price;
        uint160 price1 = pool1.price;
        emit Prices(price0, price1);
        assert(price0 >= price1);
    }

    function burn(int24 claimAt, uint256 positionIndex, uint128 burnPercent) public {
        // PRE CONDITIONS 
        // NOTE: Do not use the exact inputs of this function for POCs, use the inputs after the input validation
        positionIndex = positionIndex % positions.length;
        Position memory pos = positions[positionIndex];
        require(claimAt >= pos.lower && claimAt <= pos.upper);
        require(claimAt % tickSpacing == 0);
        PoolValues memory poolValues;

        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,) = pool.globalState();

        ILimitPoolStructs.BurnLimitParams memory params;
        params.to = pos.owner;
        // TODO: allow for variable burn percentages
        params.burnPercent = burnPercent == 1e38 ? burnPercent : _between(burnPercent, 1e36, 1e38); //1e38;
        params.lower = pos.lower;
        params.claim = claimAt;
        params.upper = pos.upper;
        params.zeroForOne = pos.zeroForOne;

        // LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(pos.lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(pos.upper);

        // values.liquidityDeltaLowerBefore = lowerTick.liquidityDelta;
        // values.liquidityDeltaUpperBefore = upperTick.liquidityDelta;
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
            positions[positionIndex] = Position(pos.owner, lower, upper, pos.zeroForOne);
            // Ensure positions ticks arent crossed
            assert(lower < upper);
            // Ensure minted ticks on proper tick spacing
            assert((lower % tickSpacing == 0) && (upper % tickSpacing == 0));
        }

        // POST CONDITIONS

        (, lowerTick) = pool.ticks(lower);
        (, upperTick) = pool.ticks(upper);

        // values.liquidityDeltaLowerAfter = lowerTick.liquidityDelta;
        // values.liquidityDeltaUpperAfter = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerAfter = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = upperTick.liquidityAbsolute;

        (,pool0, pool1, poolValues.liquidityGlobalAfter,,) = pool.globalState();
        uint160 price0 = pool0.price;
        uint160 price1 = pool1.price;
        emit Prices(price0, price1);
        assert(price0 >= price1);
        emit LiquidityGlobal(liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        assert((poolValues.liquidityGlobalAfter <= liquidityGlobalBefore));

        // TODO: Look into this more
        // emit LiquidityAbsolute(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
        // assert(poolValues.liquidityAbsoluteLowerAfter < poolValues.liquidityAbsoluteLowerBefore);
    }

    function claim(int24 claimAt, uint256 positionIndex) public {
        // PRE CONDITIONS
        // NOTE: Do not use the exact inputs of this function for POCs, use the inputs after the input validation
        positionIndex = positionIndex % positions.length;
        Position memory pos = positions[positionIndex];
        claimAt = pos.lower + (claimAt % (pos.upper - pos.lower));
        require(claimAt % tickSpacing == 0);

        PoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,) = pool.globalState();

        ILimitPoolStructs.BurnLimitParams memory params;
        params.to = pos.owner;
        // TODO: allow for variable burn percentages
        params.burnPercent = 0;
        params.lower = pos.lower;
        params.claim = claimAt;
        params.upper = pos.upper;
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
            positions[positionIndex] = Position(pos.owner, lower, upper, pos.zeroForOne);
            // Ensure positions ticks arent crossed
            assert(lower < upper);
            // Ensure minted ticks on proper tick spacing
            assert((lower % tickSpacing == 0) && (upper % tickSpacing == 0));
        }

        // POST CONDITIONS
        (,pool0, pool1, poolValues.liquidityGlobalAfter,,) = pool.globalState();
        uint160 price0 = pool0.price;
        uint160 price1 = pool1.price;
        emit Prices(price0, price1);
        assert(price0 >= price1);

        // NOTE: INVALID INVARIANTS
        // if(pos.zeroForOne) {
        //     emit LiquidityGlobal(liquidityGlobal0Before, liquidityGlobal1Before, liquidityGlobal0After, liquidityGlobal1After);
        //     if (positionExists) {
        //         assert((liquidityGlobal0After == liquidityGlobal0Before));
        //     }
        // }
        // else {
        //     emit LiquidityGlobal(liquidityGlobal0Before, liquidityGlobal1Before, liquidityGlobal0After, liquidityGlobal1After);
        //     if (positionExists) {
        //         assert((liquidityGlobal1After == liquidityGlobal1Before));
        //     }
        // }
    }

    function mintThenBurnZeroLiquidityChangeVariable(uint128 amount, bool zeroForOne, int24 lower, int24 upper, uint96 mintPercent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        // NOTE: Do not use the exact inputs of this function for POCs, use the inputs after the input validation
        mintAndApprove();
        PoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,) = pool.globalState();
        // uint160 price0Before = pool0.price;
        // uint160 price1Before = pool1.price;

        LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(upper);

        values.liquidityDeltaLowerBefore = lowerTick.liquidityDelta;
        values.liquidityDeltaUpperBefore = upperTick.liquidityDelta;
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
        
        (,pool0, pool1, poolValues.liquidityGlobalAfter,,) = pool.globalState();
        uint160 price0After = pool0.price;
        uint160 price1After = pool1.price;
        emit Prices(price0After, price1After);
        assert(price0After >= price1After);
        emit LiquidityGlobal(liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        assert(poolValues.liquidityGlobalAfter == liquidityGlobalBefore);

        // emit LiquidityAbsolute(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
        // assert(poolValues.liquidityAbsoluteLowerAfter == poolValues.liquidityAbsoluteLowerBefore);
        // emit LiquidityAbsolute(poolValues.liquidityAbsoluteUpperBefore, poolValues.liquidityAbsoluteUpperAfter);
        // assert(poolValues.liquidityAbsoluteUpperAfter == poolValues.liquidityAbsoluteUpperBefore);
    }

    function mintThenBurnZeroLiquidityChange(uint128 amount, bool zeroForOne, int24 lower, int24 upper) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        // NOTE: Do not use the exact inputs of this function for POCs, use the inputs after the input validation
        mintAndApprove();
        PoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,) = pool.globalState();
        // uint160 price0Before = pool0.price;
        // uint160 price1Before = pool1.price;

        LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(upper);

        values.liquidityDeltaLowerBefore = lowerTick.liquidityDelta;
        values.liquidityDeltaUpperBefore = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerBefore = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = upperTick.liquidityAbsolute;

        // ACTION 
        mint(amount, zeroForOne, lower, upper);
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


        (,pool0, pool1, poolValues.liquidityGlobalAfter,,) = pool.globalState();
        uint160 price0After = pool0.price;
        uint160 price1After = pool1.price;
        emit Prices(price0After, price1After);
        assert(price0After >= price1After);
        emit LiquidityGlobal(liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        assert(poolValues.liquidityGlobalAfter == liquidityGlobalBefore);

        // emit LiquidityAbsolute(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
        // assert(poolValues.liquidityAbsoluteLowerAfter == poolValues.liquidityAbsoluteLowerBefore);
        // emit LiquidityAbsolute(poolValues.liquidityAbsoluteUpperBefore, poolValues.liquidityAbsoluteUpperAfter);
        // assert(poolValues.liquidityAbsoluteUpperAfter == poolValues.liquidityAbsoluteUpperBefore);
    }

    function mintThenPartialBurnTwiceLiquidityChange(uint128 amount, bool zeroForOne, int24 lower, int24 upper, uint128 percent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        // NOTE: Do not use the exact inputs of this function for POCs, use the inputs after the input validation
        percent = 1 + (percent % (1e38 - 1));
        mintAndApprove();
        PoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,) = pool.globalState();
        // liquidityGlobalBefore - liquidity at lower or upper tick
        LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(upper);

        values.liquidityDeltaLowerBefore = lowerTick.liquidityDelta;
        values.liquidityDeltaUpperBefore = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerBefore = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = upperTick.liquidityAbsolute;

        // ACTION 
        mint(amount, zeroForOne, lower, upper);
        emit PassedMint();
        burn(zeroForOne ? lower : upper, positions.length - 1, percent);
        emit PassedBurn();
        burn(zeroForOne ? lower : upper, positions.length - 1, 1e38);
        emit PassedBurn();

        // POST CONDITIONS

        (, lowerTick) = pool.ticks(lower);
        (, upperTick) = pool.ticks(upper);

        values.liquidityDeltaLowerAfter = lowerTick.liquidityDelta;
        values.liquidityDeltaUpperAfter = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerAfter = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = upperTick.liquidityAbsolute;

        (,pool0, pool1, poolValues.liquidityGlobalAfter,,) = pool.globalState();
        uint160 price0After = pool0.price;
        uint160 price1After = pool1.price;
        emit Prices(price0After, price1After);
        assert(price0After >= price1After);
        emit LiquidityGlobal(liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        assert(poolValues.liquidityGlobalAfter == liquidityGlobalBefore);

        // emit LiquidityAbsolute(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
        // assert(poolValues.liquidityAbsoluteLowerAfter == poolValues.liquidityAbsoluteLowerBefore);
        // emit LiquidityAbsolute(poolValues.liquidityAbsoluteUpperBefore, poolValues.liquidityAbsoluteUpperAfter);
        // assert(poolValues.liquidityAbsoluteUpperAfter == poolValues.liquidityAbsoluteUpperBefore);
    }

    function mintThenPartialBurnTwiceLiquidityChangeVariable(uint128 amount, bool zeroForOne, int24 lower, int24 upper, uint128 percent, uint96 mintPercent) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        // NOTE: Do not use the exact inputs of this function for POCs, use the inputs after the input validation
        percent = 1 + (percent % (1e38 - 1));
        mintAndApprove();
        PoolValues memory poolValues;
        (,PoolsharkStructs.LimitPoolState memory pool0, PoolsharkStructs.LimitPoolState memory pool1, uint128 liquidityGlobalBefore,,) = pool.globalState();

        LiquidityDeltaValues memory values;
        (, PoolsharkStructs.LimitTick memory lowerTick) = pool.ticks(lower);
        (, PoolsharkStructs.LimitTick memory upperTick) = pool.ticks(upper);

        values.liquidityDeltaLowerBefore = lowerTick.liquidityDelta;
        values.liquidityDeltaUpperBefore = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerBefore = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperBefore = upperTick.liquidityAbsolute;


        // ACTION 
        mintVariable(amount, zeroForOne, lower, upper, mintPercent);
        emit PassedMint();
        burn(zeroForOne ? lower : upper, positions.length - 1, percent);
        emit PassedBurn();
        burn(zeroForOne ? lower : upper, positions.length - 1, 1e38);
        emit PassedBurn();

        // POST CONDITIONS
        (, lowerTick) = pool.ticks(lower);
        (, upperTick) = pool.ticks(upper);

        values.liquidityDeltaLowerAfter = lowerTick.liquidityDelta;
        values.liquidityDeltaUpperAfter = upperTick.liquidityDelta;
        poolValues.liquidityAbsoluteLowerAfter = lowerTick.liquidityAbsolute;
        poolValues.liquidityAbsoluteUpperAfter = upperTick.liquidityAbsolute;

        (,pool0, pool1, poolValues.liquidityGlobalAfter,,) = pool.globalState();
        uint160 price0After = pool0.price;
        uint160 price1After = pool1.price;
        emit Prices(price0After, price1After);
        assert(price0After >= price1After);
        emit LiquidityGlobal(liquidityGlobalBefore, poolValues.liquidityGlobalAfter);
        assert(poolValues.liquidityGlobalAfter == liquidityGlobalBefore);

        // emit LiquidityAbsolute(poolValues.liquidityAbsoluteLowerBefore, poolValues.liquidityAbsoluteLowerAfter);
        // assert(poolValues.liquidityAbsoluteLowerAfter == poolValues.liquidityAbsoluteLowerBefore);
        // emit LiquidityAbsolute(poolValues.liquidityAbsoluteUpperBefore, poolValues.liquidityAbsoluteUpperAfter);
        // assert(poolValues.liquidityAbsoluteUpperAfter == poolValues.liquidityAbsoluteUpperBefore);
    }

    function poolsharkSwapCallback(
        int256 amount0Delta,
    int256 amount1Delta,
        bytes calldata data
    ) external {
        address token0 = LimitPool(pool).token0();
        address token1 = LimitPool(pool).token1();
        // SwapCallbackData memory _data = abi.decode(data, (SwapCallbackData));
        if (amount0Delta < 0) {
            SafeTransfers.transferInto(token0, address(pool), uint256(-amount0Delta));
        } else {
            SafeTransfers.transferInto(token1, address(pool), uint256(-amount1Delta));
        }
    }

    function mintAndApprove() internal {
        // TODO: can make token mints to be in between some range
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
        ILimitPoolStructs.Immutables memory immutables = pool.immutables();
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
            assert(isEqualWithinPercentage(amount, token0Amount, 100));
            
        }
        else {
            emit LiquidityMinted(amount, token1Amount, zeroForOne);
            assert(isEqualWithinPercentage(amount, token1Amount, 100));
        }

    }

    function isEqualWithinPercentage(uint256 a, uint256 b, uint256 percentage) internal pure returns (bool) {
        uint256 diff = a > b ? a - b : b - a;
        uint256 maxDiff = a * percentage / 10000; // basis points 

        return diff <= maxDiff;
    }
}