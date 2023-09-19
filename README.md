# 🦈 Poolshark Limit Contracts 🦈
A liquidity pool to support one-way and two-way liquidity positions.

An implementation of Limit, a limit order liquidity pool, written in Solidity. 

This follows the specification detailed in the [Poolshark whitepaper](https://docs.poolsharks.io/whitepaper/).

### What's New 
The concept of "claim ticks" are introduced to inform up to what price tick a user has been filled.

Each tick will have an `epoch` that is marked as ticks are crossed.

This will allow the smart contracts to verify the correct claim tick.

### Installation
```
git clone https://github.com/poolshark-protocol/cover
cd cover
yarn install
```

This repo makes full use of Echidna's assertion testing to fully test and analyze the Limit smart contracts.

### Testing
Tests can be run via the following commands.

Only Hardhat is supported for now, with Foundry support soon to follow.
```
yarn clean
yarn compile
yarn test
```

Contracts can be deployed onto Arbitrum Goerli using the deploy script:
```
npx hardhat deploy-coverpools --network arb_goerli
```

### Contracts
#### Limit Pool
Limit Pool is the liquidity pool contract which contains all the calls for the pool. Outside of the claim process, it is a relatively simple AMM liquidity pool which uses a both a tick bitmap to find ticks to cross and an epoch map to store epochs for any positions boundaries of Limit LPs. Positions are implemented via an ERC-1155 for transferability and composability.
<br/><br/>
The contracts are implemented with extremely limited admin functionality, namely modifying fees up to a defined ceiling of 1% and adding new fee tiers.
<br/><br/>
Limit Pools utilize epochs to determine to what tick in the user's position range they have been filled. A `fillFee` can be turned on by the protocol if desired, taking a portion of any filled positions amounts and directing that to a chosen `feeTo` address. If ever a pool were to ever require an extensive sync, a user burning a position could simply skip the syncing process by passing `sync = true`.

#### Supported Interfaces
_ERC-165: Standard Interface Detection_

_ERC-1155: Multi Token Standard_

#### Cover Pool Factory
The factory which handles the deployment of new Limit Pools. The factory works by cloning the implementation contract to match a given Limit pool type. Each pool type has its own unique implementation, which can have varying details such as AMM curve math (i.e. Constant Product, Constant Sum, etc.), or other unique design choices.

##### Supported Interfaces
_ERC-1167: Minimal Proxy Contract_

### Testing Design
#### Coverage
ERC-1155 Functions

totalSupply
balanceOf
transfer
transferFrom
approve
allowance

General Functions

mintLimit
mintRange
burnLimit
burnRange
swap
quote
snapshotLimit
snapshotRange
immutables
priceBounds

![image](https://github.com/poolshark-protocol/limit/assets/84204260/c82cfc21-f559-452b-864d-5ba6e24992d2)
