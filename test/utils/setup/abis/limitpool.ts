export const LimitPoolABI = [
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "factory_",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [],
      "name": "ReentrancyGuardInvalidState",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ReentrancyGuardReadOnlyReentrantCall",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ReentrancyGuardReentrantCall",
      "type": "error"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "internalType": "uint128",
              "name": "burnPercent",
              "type": "uint128"
            },
            {
              "internalType": "uint32",
              "name": "positionId",
              "type": "uint32"
            },
            {
              "internalType": "int24",
              "name": "claim",
              "type": "int24"
            },
            {
              "internalType": "bool",
              "name": "zeroForOne",
              "type": "bool"
            }
          ],
          "internalType": "struct PoolsharkStructs.BurnLimitParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "burnLimit",
      "outputs": [
        {
          "internalType": "int256",
          "name": "",
          "type": "int256"
        },
        {
          "internalType": "int256",
          "name": "",
          "type": "int256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "internalType": "uint32",
              "name": "positionId",
              "type": "uint32"
            },
            {
              "internalType": "uint128",
              "name": "burnPercent",
              "type": "uint128"
            }
          ],
          "internalType": "struct PoolsharkStructs.BurnRangeParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "burnRange",
      "outputs": [
        {
          "internalType": "int256",
          "name": "",
          "type": "int256"
        },
        {
          "internalType": "int256",
          "name": "",
          "type": "int256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "factory",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "uint16",
              "name": "protocolSwapFee0",
              "type": "uint16"
            },
            {
              "internalType": "uint16",
              "name": "protocolSwapFee1",
              "type": "uint16"
            },
            {
              "internalType": "uint16",
              "name": "protocolFillFee0",
              "type": "uint16"
            },
            {
              "internalType": "uint16",
              "name": "protocolFillFee1",
              "type": "uint16"
            },
            {
              "internalType": "uint8",
              "name": "setFeesFlags",
              "type": "uint8"
            }
          ],
          "internalType": "struct PoolsharkStructs.FeesParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "fees",
      "outputs": [
        {
          "internalType": "uint128",
          "name": "token0Fees",
          "type": "uint128"
        },
        {
          "internalType": "uint128",
          "name": "token1Fees",
          "type": "uint128"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "genesisTime",
      "outputs": [
        {
          "internalType": "uint32",
          "name": "",
          "type": "uint32"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "globalState",
      "outputs": [
        {
          "components": [
            {
              "components": [
                {
                  "internalType": "uint16",
                  "name": "index",
                  "type": "uint16"
                },
                {
                  "internalType": "uint16",
                  "name": "count",
                  "type": "uint16"
                },
                {
                  "internalType": "uint16",
                  "name": "countMax",
                  "type": "uint16"
                }
              ],
              "internalType": "struct PoolsharkStructs.SampleState",
              "name": "samples",
              "type": "tuple"
            },
            {
              "internalType": "uint200",
              "name": "feeGrowthGlobal0",
              "type": "uint200"
            },
            {
              "internalType": "uint200",
              "name": "feeGrowthGlobal1",
              "type": "uint200"
            },
            {
              "internalType": "uint160",
              "name": "secondsPerLiquidityAccum",
              "type": "uint160"
            },
            {
              "internalType": "uint160",
              "name": "price",
              "type": "uint160"
            },
            {
              "internalType": "uint128",
              "name": "liquidity",
              "type": "uint128"
            },
            {
              "internalType": "int56",
              "name": "tickSecondsAccum",
              "type": "int56"
            },
            {
              "internalType": "int24",
              "name": "tickAtPrice",
              "type": "int24"
            },
            {
              "internalType": "uint16",
              "name": "protocolSwapFee0",
              "type": "uint16"
            },
            {
              "internalType": "uint16",
              "name": "protocolSwapFee1",
              "type": "uint16"
            }
          ],
          "internalType": "struct PoolsharkStructs.RangePoolState",
          "name": "pool",
          "type": "tuple"
        },
        {
          "components": [
            {
              "internalType": "uint160",
              "name": "price",
              "type": "uint160"
            },
            {
              "internalType": "uint128",
              "name": "liquidity",
              "type": "uint128"
            },
            {
              "internalType": "uint128",
              "name": "protocolFees",
              "type": "uint128"
            },
            {
              "internalType": "uint16",
              "name": "protocolFillFee",
              "type": "uint16"
            },
            {
              "internalType": "int24",
              "name": "tickAtPrice",
              "type": "int24"
            }
          ],
          "internalType": "struct PoolsharkStructs.LimitPoolState",
          "name": "pool0",
          "type": "tuple"
        },
        {
          "components": [
            {
              "internalType": "uint160",
              "name": "price",
              "type": "uint160"
            },
            {
              "internalType": "uint128",
              "name": "liquidity",
              "type": "uint128"
            },
            {
              "internalType": "uint128",
              "name": "protocolFees",
              "type": "uint128"
            },
            {
              "internalType": "uint16",
              "name": "protocolFillFee",
              "type": "uint16"
            },
            {
              "internalType": "int24",
              "name": "tickAtPrice",
              "type": "int24"
            }
          ],
          "internalType": "struct PoolsharkStructs.LimitPoolState",
          "name": "pool1",
          "type": "tuple"
        },
        {
          "internalType": "uint128",
          "name": "liquidityGlobal",
          "type": "uint128"
        },
        {
          "internalType": "uint32",
          "name": "positionIdNext",
          "type": "uint32"
        },
        {
          "internalType": "uint32",
          "name": "epoch",
          "type": "uint32"
        },
        {
          "internalType": "uint8",
          "name": "unlocked",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "immutables",
      "outputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "owner",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "poolImpl",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "factory",
              "type": "address"
            },
            {
              "components": [
                {
                  "internalType": "uint160",
                  "name": "min",
                  "type": "uint160"
                },
                {
                  "internalType": "uint160",
                  "name": "max",
                  "type": "uint160"
                }
              ],
              "internalType": "struct PoolsharkStructs.PriceBounds",
              "name": "bounds",
              "type": "tuple"
            },
            {
              "internalType": "address",
              "name": "token0",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "token1",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "poolToken",
              "type": "address"
            },
            {
              "internalType": "uint32",
              "name": "genesisTime",
              "type": "uint32"
            },
            {
              "internalType": "int16",
              "name": "tickSpacing",
              "type": "int16"
            },
            {
              "internalType": "uint16",
              "name": "swapFee",
              "type": "uint16"
            }
          ],
          "internalType": "struct PoolsharkStructs.LimitImmutables",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint16",
          "name": "newSampleCountMax",
          "type": "uint16"
        }
      ],
      "name": "increaseSampleCount",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint160",
          "name": "startPrice",
          "type": "uint160"
        }
      ],
      "name": "initialize",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "limitTickMap",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "blocks",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "maxPrice",
      "outputs": [
        {
          "internalType": "uint160",
          "name": "",
          "type": "uint160"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "minPrice",
      "outputs": [
        {
          "internalType": "uint160",
          "name": "",
          "type": "uint160"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "internalType": "uint128",
              "name": "amount",
              "type": "uint128"
            },
            {
              "internalType": "uint96",
              "name": "mintPercent",
              "type": "uint96"
            },
            {
              "internalType": "uint32",
              "name": "positionId",
              "type": "uint32"
            },
            {
              "internalType": "int24",
              "name": "lower",
              "type": "int24"
            },
            {
              "internalType": "int24",
              "name": "upper",
              "type": "int24"
            },
            {
              "internalType": "bool",
              "name": "zeroForOne",
              "type": "bool"
            },
            {
              "internalType": "bytes",
              "name": "callbackData",
              "type": "bytes"
            }
          ],
          "internalType": "struct PoolsharkStructs.MintLimitParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "mintLimit",
      "outputs": [
        {
          "internalType": "int256",
          "name": "",
          "type": "int256"
        },
        {
          "internalType": "int256",
          "name": "",
          "type": "int256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "internalType": "int24",
              "name": "lower",
              "type": "int24"
            },
            {
              "internalType": "int24",
              "name": "upper",
              "type": "int24"
            },
            {
              "internalType": "uint32",
              "name": "positionId",
              "type": "uint32"
            },
            {
              "internalType": "uint128",
              "name": "amount0",
              "type": "uint128"
            },
            {
              "internalType": "uint128",
              "name": "amount1",
              "type": "uint128"
            },
            {
              "internalType": "bytes",
              "name": "callbackData",
              "type": "bytes"
            }
          ],
          "internalType": "struct PoolsharkStructs.MintRangeParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "mintRange",
      "outputs": [
        {
          "internalType": "int256",
          "name": "",
          "type": "int256"
        },
        {
          "internalType": "int256",
          "name": "",
          "type": "int256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "original",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "poolToken",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "positions",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "feeGrowthInside0Last",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "feeGrowthInside1Last",
          "type": "uint256"
        },
        {
          "internalType": "uint128",
          "name": "liquidity",
          "type": "uint128"
        },
        {
          "internalType": "int24",
          "name": "lower",
          "type": "int24"
        },
        {
          "internalType": "int24",
          "name": "upper",
          "type": "int24"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "positions0",
      "outputs": [
        {
          "internalType": "uint128",
          "name": "liquidity",
          "type": "uint128"
        },
        {
          "internalType": "uint32",
          "name": "epochLast",
          "type": "uint32"
        },
        {
          "internalType": "int24",
          "name": "lower",
          "type": "int24"
        },
        {
          "internalType": "int24",
          "name": "upper",
          "type": "int24"
        },
        {
          "internalType": "bool",
          "name": "crossedInto",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "positions1",
      "outputs": [
        {
          "internalType": "uint128",
          "name": "liquidity",
          "type": "uint128"
        },
        {
          "internalType": "uint32",
          "name": "epochLast",
          "type": "uint32"
        },
        {
          "internalType": "int24",
          "name": "lower",
          "type": "int24"
        },
        {
          "internalType": "int24",
          "name": "upper",
          "type": "int24"
        },
        {
          "internalType": "bool",
          "name": "crossedInto",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "int16",
          "name": "tickSpacing",
          "type": "int16"
        }
      ],
      "name": "priceBounds",
      "outputs": [
        {
          "internalType": "uint160",
          "name": "",
          "type": "uint160"
        },
        {
          "internalType": "uint160",
          "name": "",
          "type": "uint160"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "uint160",
              "name": "priceLimit",
              "type": "uint160"
            },
            {
              "internalType": "uint128",
              "name": "amount",
              "type": "uint128"
            },
            {
              "internalType": "bool",
              "name": "exactIn",
              "type": "bool"
            },
            {
              "internalType": "bool",
              "name": "zeroForOne",
              "type": "bool"
            }
          ],
          "internalType": "struct PoolsharkStructs.QuoteParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "quote",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "uint160",
          "name": "",
          "type": "uint160"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "rangeTickMap",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "blocks",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint32[]",
          "name": "secondsAgo",
          "type": "uint32[]"
        }
      ],
      "name": "sample",
      "outputs": [
        {
          "internalType": "int56[]",
          "name": "tickSecondsAccum",
          "type": "int56[]"
        },
        {
          "internalType": "uint160[]",
          "name": "secondsPerLiquidityAccum",
          "type": "uint160[]"
        },
        {
          "internalType": "uint160",
          "name": "averagePrice",
          "type": "uint160"
        },
        {
          "internalType": "uint128",
          "name": "averageLiquidity",
          "type": "uint128"
        },
        {
          "internalType": "int24",
          "name": "averageTick",
          "type": "int24"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "samples",
      "outputs": [
        {
          "internalType": "uint32",
          "name": "blockTimestamp",
          "type": "uint32"
        },
        {
          "internalType": "int56",
          "name": "tickSecondsAccum",
          "type": "int56"
        },
        {
          "internalType": "uint160",
          "name": "secondsPerLiquidityAccum",
          "type": "uint160"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "owner",
              "type": "address"
            },
            {
              "internalType": "uint128",
              "name": "burnPercent",
              "type": "uint128"
            },
            {
              "internalType": "uint32",
              "name": "positionId",
              "type": "uint32"
            },
            {
              "internalType": "int24",
              "name": "claim",
              "type": "int24"
            },
            {
              "internalType": "bool",
              "name": "zeroForOne",
              "type": "bool"
            }
          ],
          "internalType": "struct PoolsharkStructs.SnapshotLimitParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "snapshotLimit",
      "outputs": [
        {
          "internalType": "uint128",
          "name": "",
          "type": "uint128"
        },
        {
          "internalType": "uint128",
          "name": "",
          "type": "uint128"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint32",
          "name": "positionId",
          "type": "uint32"
        }
      ],
      "name": "snapshotRange",
      "outputs": [
        {
          "internalType": "int56",
          "name": "tickSecondsAccum",
          "type": "int56"
        },
        {
          "internalType": "uint160",
          "name": "secondsPerLiquidityAccum",
          "type": "uint160"
        },
        {
          "internalType": "uint128",
          "name": "feesOwed0",
          "type": "uint128"
        },
        {
          "internalType": "uint128",
          "name": "feesOwed1",
          "type": "uint128"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "internalType": "uint160",
              "name": "priceLimit",
              "type": "uint160"
            },
            {
              "internalType": "uint128",
              "name": "amount",
              "type": "uint128"
            },
            {
              "internalType": "bool",
              "name": "exactIn",
              "type": "bool"
            },
            {
              "internalType": "bool",
              "name": "zeroForOne",
              "type": "bool"
            },
            {
              "internalType": "bytes",
              "name": "callbackData",
              "type": "bytes"
            }
          ],
          "internalType": "struct PoolsharkStructs.SwapParams",
          "name": "params",
          "type": "tuple"
        }
      ],
      "name": "swap",
      "outputs": [
        {
          "internalType": "int256",
          "name": "",
          "type": "int256"
        },
        {
          "internalType": "int256",
          "name": "",
          "type": "int256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "swapFee",
      "outputs": [
        {
          "internalType": "uint16",
          "name": "",
          "type": "uint16"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "tickSpacing",
      "outputs": [
        {
          "internalType": "int16",
          "name": "",
          "type": "int16"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "int24",
          "name": "",
          "type": "int24"
        }
      ],
      "name": "ticks",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint200",
              "name": "feeGrowthOutside0",
              "type": "uint200"
            },
            {
              "internalType": "uint200",
              "name": "feeGrowthOutside1",
              "type": "uint200"
            },
            {
              "internalType": "uint160",
              "name": "secondsPerLiquidityAccumOutside",
              "type": "uint160"
            },
            {
              "internalType": "int56",
              "name": "tickSecondsAccumOutside",
              "type": "int56"
            },
            {
              "internalType": "int128",
              "name": "liquidityDelta",
              "type": "int128"
            },
            {
              "internalType": "uint128",
              "name": "liquidityAbsolute",
              "type": "uint128"
            }
          ],
          "internalType": "struct PoolsharkStructs.RangeTick",
          "name": "range",
          "type": "tuple"
        },
        {
          "components": [
            {
              "internalType": "uint160",
              "name": "priceAt",
              "type": "uint160"
            },
            {
              "internalType": "int128",
              "name": "liquidityDelta",
              "type": "int128"
            },
            {
              "internalType": "uint128",
              "name": "liquidityAbsolute",
              "type": "uint128"
            }
          ],
          "internalType": "struct PoolsharkStructs.LimitTick",
          "name": "limit",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "token0",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "token1",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    }
]