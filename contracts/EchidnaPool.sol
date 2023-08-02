// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.13;

import './interfaces/ILimitPool.sol';
import './interfaces/ILimitPoolManager.sol';
import './interfaces/ILimitPoolStructs.sol';
import './base/storage/LimitPoolStorage.sol';
import './base/structs/LimitPoolFactoryStructs.sol';
import './utils/LimitPoolErrors.sol';
import './libraries/TickMap.sol';
import './LimitPool.sol';
import './LimitPoolFactory.sol';
import './test/Token20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import './libraries/utils/SafeTransfers.sol';


// Fuzz LimitPool functionality
contract EchidnaPool {

    event Address(address a);
    event Price(uint160 price);
    event Prices(uint160 price0, uint160 price1);
    event LiquidityGlobal(uint128 liq0Before, uint128 liq1Before, uint128 liq0After, uint128 liq1After);
    event Liquidity(uint128 liq0Before, uint128 liq1Before, uint128 liq0After, uint128 liq1After);
    event LiquidityDelta(int128 liqLowerBefore, int128 liqUpperBefore, int128 liqLowerAfter, int128 liqUperAfter);
    event Amount(uint256 amt);
    event PassedMint();
    event PassedBurn();
    event PositionTicks(int24 lower, int24 upper);
    event BurnTicks(int24 lower, int24 upper, bool positionExists);

    LimitPoolFactory public factory;
    address public implementation;
    LimitPool public pool;
    Token20 public tokenIn;
    Token20 public tokenOut;
    Position[] public positions;

    struct LiquidityDeltaValues {
        int128 liquidityDeltaLowerBefore;
        int128 liquidityDeltaUpperBefore;
        int128 liquidityDeltaLowerAfter;
        int128 liquidityDeltaUpperAfter;
    }

    struct PoolValues {
        uint160 price0Before;
        uint128 liquidity0Before;
        uint128 liquidityGlobal0Before;
        uint160 price1Before;
        uint128 liquidity1Before;
        uint128 liquidityGlobal1Before;
        uint160 price0After;
        uint128 liquidity0After;
        uint128 liquidityGlobal0After;
        uint160 price1After;
        uint128 liquidity1After;
        uint128 liquidityGlobal1After;
        
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

    modifier tickPreconditions(int24 lower, int24 upper) {
        require(lower < upper);
        require(upper < 887272);
        require(lower > -887272);
        require(lower % 10 == 0);
        require(upper % 10 == 0);
        _;
    }
    constructor() {
        implementation = address(new LimitPool());
        factory = new LimitPoolFactory(msg.sender, implementation);
        tokenIn = new Token20("IN", "IN", 18);
        tokenOut = new Token20("OUT", "OUT", 18);
        pool =  LimitPool(factory.createLimitPool(address(tokenIn), address(tokenOut), 10, 79228162514264337593543950336));
    }

    function mint(uint128 amount, bool zeroForOne, int24 lower, int24 upper) public tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        require(amount > 0);
        PoolValues memory poolValues;
        (poolValues.price0Before, poolValues.liquidity0Before, poolValues.liquidityGlobal0Before,,,,) = pool.pool0();
        (poolValues.price1Before, poolValues.liquidity1Before, poolValues.liquidityGlobal1Before,,,,) = pool.pool1();
        
        
        ILimitPoolStructs.MintParams memory params;
        params.to = msg.sender;
        params.refundTo = msg.sender;
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

        LiquidityDeltaValues memory values;
        if (zeroForOne) {
            (,values.liquidityDeltaLowerBefore) = pool.ticks0(lower);
            (,values.liquidityDeltaUpperBefore) = pool.ticks0(upper);
        }
        else {
            (,values.liquidityDeltaLowerBefore) = pool.ticks1(lower);
            (,values.liquidityDeltaUpperBefore) = pool.ticks1(upper);
        }

        // ACTION 
        pool.mint(params);
        if (posCreated) positions.push(Position(msg.sender, lower, upper, zeroForOne));

        (poolValues.price0After, poolValues.liquidity0After, poolValues.liquidityGlobal0After,,,,) = pool.pool0();
        (poolValues.price1After, poolValues.liquidity1After, poolValues.liquidityGlobal1After,,,,) = pool.pool1();

        if (zeroForOne) {
            (,values.liquidityDeltaLowerAfter) = pool.ticks0(lower);
            (,values.liquidityDeltaUpperAfter) = pool.ticks0(upper);
        }
        else {
            (,values.liquidityDeltaLowerAfter) = pool.ticks1(lower);
            (,values.liquidityDeltaUpperAfter) = pool.ticks1(upper);
        }

        emit Prices(poolValues.price0After, poolValues.price1After);

        // POST CONDITIONS

        // Ensure prices have not crossed
        assert(poolValues.price0After >= poolValues.price1After);
        
        emit LiquidityGlobal(poolValues.liquidityGlobal0Before, poolValues.liquidityGlobal1Before, poolValues.liquidityGlobal0After, poolValues.liquidityGlobal1After);
        emit Liquidity(poolValues.liquidity0Before, poolValues.liquidity1Before, poolValues.liquidity0After, poolValues.liquidity1After);
        emit LiquidityDelta(values.liquidityDeltaLowerBefore, values.liquidityDeltaUpperBefore, values.liquidityDeltaLowerAfter, values.liquidityDeltaUpperAfter);

        if (zeroForOne) {
            // Ensure liquidity does not decrease on mint
            assert(poolValues.liquidityGlobal0After >= poolValues.liquidityGlobal0Before);
            // Ensure pool.liquity is incremented when undercutting
            if (poolValues.price0After < poolValues.price0Before) {
                assert(poolValues.liquidity0After > 0);
            }

            // Doesn't hold due to insertSingle stashing pool liquidity on tick to save
            // if (posCreated) {
            //     assert(values.liquidityDeltaLowerAfter >= values.liquidityDeltaLowerBefore);
            //     assert(values.liquidityDeltaUpperAfter <= values.liquidityDeltaUpperBefore);
            // }
        }
        else {
            // Ensure liquidity does not decrease on mint
            assert(poolValues.liquidityGlobal1After >= poolValues.liquidityGlobal1Before);
            // Ensure pool.liquity is incremented when undercutting
            if (poolValues.price1After > poolValues.price1Before) {
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
        mintAndApprove();

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
        (uint160 price0,,,,,,) = pool.pool0();
        (uint160 price1,,,,,,) = pool.pool1();
        emit Prices(price0, price1);
        assert(price0 >= price1);
    }

    function burn(int24 claim, uint256 positionIndex, uint128 burnPercent) public {
        // PRE CONDITIONS 
        require(positionIndex < positions.length);
        Position memory pos = positions[positionIndex];
        require(claim >= pos.lower && claim <= pos.upper);
        require(claim & 10 == 0);
        
        ILimitPoolStructs.BurnParams memory params;
        params.to = pos.owner;
        // TODO: allow for variable burn percentages
        params.burnPercent = _between(burnPercent, 1e36, 1e38); //1e38;
        params.lower = pos.lower;
        params.claim = claim;
        params.upper = pos.upper;
        params.zeroForOne = pos.zeroForOne;
        
        emit PositionTicks(pos.lower, pos.upper);
        (int24 lower, int24 upper, bool positionExists) = pool.getResizedTicksForBurn(params);
        emit BurnTicks(lower, upper, positionExists);

        // ACTION
        pool.burn(params);
        if (!positionExists) {
            positions[positionIndex] = positions[positions.length - 1];
            delete positions[positions.length - 1];
        }
        else {
            // Update position data in array if not fully burned
            positions[positionIndex] = Position(pos.owner, lower, upper, pos.zeroForOne);
        }

        // POST CONDITIONS
        (uint160 price0,,,,,,) = pool.pool0();
        (uint160 price1,,,,,,) = pool.pool1();
        emit Prices(price0, price1);
        assert(price0 >= price1);
    }

    function mintThenBurnZeroLiquidityChange(uint128 amount, bool zeroForOne, int24 lower, int24 upper) internal tickPreconditions(lower, upper) {
        // PRE CONDITIONS
        mintAndApprove();
        (uint160 price0Before,/*liquidity*/,uint128 liquidityGlobal0Before,,,,) = pool.pool0();
        (uint160 price1Before,/*liquidity*/,uint128 liquidityGlobal1Before,,,,) = pool.pool1();

        // ACTION 
        mint(amount, zeroForOne, lower, upper);
        emit PassedMint();
        burn(zeroForOne ? lower : upper, positions.length - 1, 1e38);
        emit PassedBurn();

        // POST CONDITIONS
        (uint160 price0After,/*liquidity*/,uint128 liquidityGlobal0After,,,,) = pool.pool0();
        (uint160 price1After,/*liquidity*/,uint128 liquidityGlobal1After,,,,) = pool.pool1();
        emit Prices(price0After, price1After);
        assert(price0After >= price1After);
        emit LiquidityGlobal(liquidityGlobal0Before, liquidityGlobal1Before, liquidityGlobal0After, liquidityGlobal1After);
        assert((liquidityGlobal0After == liquidityGlobal0Before) && (liquidityGlobal1After == liquidityGlobal1Before));
        
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
   

}