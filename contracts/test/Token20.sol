//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.21;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol';
import '../libraries/utils/SafeTransfers.sol';

contract Token20 is ERC20, ERC20Burnable, Ownable {
    uint8 _decimals;

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 decimals_
    ) ERC20(tokenName, tokenSymbol) {
        _transferOwnership(msg.sender);
        _decimals = decimals_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function transferIntoTest() external {
        SafeTransfers.transferInto(address(0), address(0), 0);
    }
}
