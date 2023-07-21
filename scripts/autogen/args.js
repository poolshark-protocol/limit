module.exports = [
    {
        config: {
            minAmountPerAuction: ethers.utils.parseUnits("1", 18),
            auctionLength: "5",
            blockTime: "1000",
            syncFee: "0",
            fillFee: "0",
            minPositionWidth: "1",
            minAmountLowerPriced: true
        },
        twapSource: "0xfC51341F0A72e56EB3c7260e94b26A8813E423ba", // uniswapV3Source
        curveMath: "0xBDA55A142748316b2B0fdA2776888d425994C0B7", // constantProduct
        inputPool: "0x934CB15A67dCe0019AF2168fe00C0ba9BdEd8673", // uniswapV3PoolMock
        owner: "0xA01906e76860870F81BD0CFD6cdaeb35ab2B23A4", // coverPoolManager
        token0: "0x6774be1a283Faed7ED8e40463c40Fb33A8da3461", // token0
        token1: "0xC26906E10E8BDaDeb2cf297eb56DF59775eE52c4", // token1
        tickSpread: "20", // tickSpread
        twapLength: "5" // twapLength
    }
];