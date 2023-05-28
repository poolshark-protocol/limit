//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import '../interfaces/external/IUniswapV3Factory.sol';
import './UniswapV3PoolMock.sol';

contract UniswapV3FactoryMock is IUniswapV3Factory {
    address mockPool;
    address mockPool2;
    address owner;

    mapping(uint24 => int24) public feeTierTickSpacing;
    mapping(address => mapping(address => mapping(uint24 => address))) public override getPool;

    constructor(address tokenA, address tokenB) {
        owner = msg.sender;
        require(tokenA < tokenB, 'wrong token order');

        feeTierTickSpacing[500] = 10;
        feeTierTickSpacing[3000] = 60;
        feeTierTickSpacing[10000] = 200;

        // create mock pool 1
        mockPool = address(new UniswapV3PoolMock(tokenA, tokenB, 500, 10));
        getPool[tokenA][tokenB][500] = mockPool;

        // create mock pool 2
        mockPool2 = address(new UniswapV3PoolMock(tokenA, tokenB, 3000, 60));
        getPool[tokenA][tokenB][3000] = mockPool2;
    }
}
