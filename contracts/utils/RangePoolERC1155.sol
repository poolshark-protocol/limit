// SPDX-License-Identifier: MIT

pragma solidity 0.8.13;

import '../interfaces/IPool.sol';
import "./RangePoolErrors.sol";
import '../base/storage/RangePoolERC1155Immutables.sol';
import "../interfaces/range/IRangePoolERC1155.sol";
import "../libraries/range/RangeTokens.sol";
import '../libraries/solady/LibClone.sol';

// needs to be deployed as a separate clone
// poolImpls; tokenImpls
// store address in Immutables struct
// emit token address on created pool
// launch an ERC1155 template to track events on Subgraph
// emitting msg.sender will give the pool address
// can verify the owner is the pool address designated based on immutables

contract RangePoolERC1155 is
    IRangePoolERC1155,
    RangePoolERC1155Immutables,
    RangePoolERC1155Errors 
{
    error OwnerOnly();

    address public immutable factory;
    address public immutable original;

    constructor(
        address factory_
    ) {
        factory = factory_;
        original = address(this);
    }

    /// @dev token id => owner => balance
    mapping(uint256 => mapping(address => uint256)) private _tokenBalances;

    /// @dev owner => spender => approved
    mapping(address => mapping(address => bool)) private _spenderApprovals;

    /// @dev token id => total supply
    mapping(uint256 => uint256) private _totalSupplyById;

    string private constant _NAME = "Poolshark Range LP";
    string private constant _SYMBOL = "PSHARK-RANGE-LP";

    modifier onlyCanonicalClones(
        PoolsharkStructs.Immutables memory constants
    ) {
        if(!_onlyCanonicalPools(constants)) require (false, 'CanoncialPoolsOnly()');
        if(!_onlyCanonicalPoolTokens(constants)) require (false, 'CanoncialPoolTokensOnly()');
        _;
    }

    modifier checkApproval(address _from, address _spender) {
        if (!_isApprovedForAll(_from, _spender)) revert SpenderNotApproved(_from, _spender);
        _;
    }

    modifier checkAddresses(address _from, address _to) {
        if (_from == address(0) || _to == address(0)) revert TransferFromOrToAddress0();
        if (_from == _to) revert TransferToSelf();
        _;
    }

    modifier checkLength(uint256 _lengthA, uint256 _lengthB) {
        if (_lengthA != _lengthB) revert LengthMismatch(_lengthA, _lengthB);
        _;
    }

    modifier checkERC1155Support(address recipient) {
        if (!_verifyERC1155Support(recipient)) revert ERC1155NotSupported();
        _;
    }

    function mintFungible(
        address _account,
        uint256 _id,
        uint256 _amount,
        PoolsharkStructs.Immutables memory constants
    ) external onlyCanonicalClones(constants) {
        _mint(_account, _id, _amount);
    }

    function burnFungible(
        address _account,
        uint256 _id,
        uint256 _amount,
        PoolsharkStructs.Immutables memory constants
    ) external onlyCanonicalClones(constants) {
        _burn(_account, _id, _amount);
    }

    function setApprovalForAll(address _spender, bool _approved) public virtual override {
        _setApprovalForAll(msg.sender, _spender, _approved);
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount
    ) public virtual override
        checkAddresses(_from, _to)
        checkApproval(_from, msg.sender)
        checkERC1155Support(_to)
    {
        address _spender = msg.sender;
        _transfer(_from, _to, _id, _amount);
        emit TransferSingle(_spender, _from, _to, _id, _amount);
    }

    function safeBatchTransferFrom(
        address _from,
        address _to,
        uint256[] calldata _ids,
        uint256[] calldata _amounts
    ) public virtual override
        checkLength(_ids.length, _amounts.length)
        checkAddresses(_from, _to)
        checkApproval(_from, msg.sender)
        checkERC1155Support(_to)
    {
        unchecked {
            for (uint256 i; i < _ids.length; ++i) {
                _transfer(_from, _to, _ids[i], _amounts[i]);
            }
        }
        emit TransferBatch(msg.sender, _from, _to, _ids, _amounts);
    }

    function isApprovedForAll(address _owner, address _spender) public view virtual override returns (bool) {
        return _isApprovedForAll(_owner, _spender);
    }

    function supportsInterface(bytes4 interfaceID) external pure returns (bool) {
      return  interfaceID == 0x01ffc9a7 ||    // ERC-165 support
              interfaceID == 0xd9b67a26;      // ERC-1155 support
    }

    function name() public pure virtual override returns (string memory) {
        return _NAME;
    }

    function symbol() public pure virtual override returns (string memory) {
        return _SYMBOL;
    }

    function totalSupply(uint256 _id) public view virtual override returns (uint256) {
        return _totalSupplyById[_id];
    }

    function balanceOf(address _account, uint256 _id) public view virtual override returns (uint256) {
        return _tokenBalances[_id][_account];
    }

    function balanceOfBatch(
        address[] calldata _accounts,
        uint256[] calldata _ids
    ) public view virtual override
        checkLength(_accounts.length, _ids.length)
        returns (uint256[] memory batchBalances)
    {
        batchBalances = new uint256[](_accounts.length);
        unchecked {
            for (uint256 i; i < _accounts.length; ++i) {
                batchBalances[i] = balanceOf(_accounts[i], _ids[i]);
            }
        }
    }

    function _mint(
        address _account,
        uint256 _id,
        uint256 _amount
    ) internal virtual {
        if (_account == address(0)) revert MintToAddress0();
        _beforeTokenTransfer(address(0), _account, _id, _amount);
        _totalSupplyById[_id] += _amount;
        uint256 _accountBalance = _tokenBalances[_id][_account];
        unchecked {
            _tokenBalances[_id][_account] = _accountBalance + _amount;
        }
        emit TransferSingle(msg.sender, address(0), _account, _id, _amount);
    }

    function _burn(
        address _account,
        uint256 _id,
        uint256 _amount
    ) internal virtual {
        if (_account == address(0)) revert BurnFromAddress0();
        uint256 _accountBalance = _tokenBalances[_id][_account];
        if (_accountBalance < _amount) revert BurnExceedsBalance(_account, _id, _amount);
        _beforeTokenTransfer(_account, address(0), _id, _amount);
        unchecked {
            _tokenBalances[_id][_account] = _accountBalance - _amount;
            _totalSupplyById[_id] -= _amount;
        }
        emit TransferSingle(msg.sender, _account, address(0), _id, _amount);
    }

    function _transfer(
        address _from,
        address _to,
        uint256 _id,
        uint256 _amount
    ) internal virtual {
        uint256 _fromBalance = _tokenBalances[_id][_from];
        if (_fromBalance < _amount) revert TransferExceedsBalance(_from, _id, _amount);
        _beforeTokenTransfer(_from, _to, _id, _amount);
        unchecked {
            _tokenBalances[_id][_from] = _fromBalance - _amount;
        }
        uint256 _toBalance = _tokenBalances[_id][_to];
        unchecked {
            _tokenBalances[_id][_to] = _toBalance + _amount;
        }
    }

    function _setApprovalForAll(
        address _owner,
        address _spender,
        bool _approved
    ) internal virtual {
        if (_owner == _spender) revert SelfApproval(_owner);
        _spenderApprovals[_owner][_spender] = _approved;
        emit ApprovalForAll(_owner, _spender, _approved);
    }

    function _isApprovedForAll(address _owner, address _spender) internal view virtual returns (bool) {
        return _owner == _spender || _spenderApprovals[_owner][_spender];
    }

    /// @notice Hook that is called before any token transfer.
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 id,
        uint256 amount
    ) internal virtual {}

    function _onlyCanonicalPoolTokens(
        PoolsharkStructs.Immutables memory constants
    ) private view returns (bool) {
        // generate key for pool
        bytes32 key = keccak256(abi.encode(
            poolImpl(),
            constants.token0,
            constants.token1,
            constants.swapFee
        ));

        // compute address
        address predictedAddress = LibClone.predictDeterministicAddress(
            original,
            abi.encodePacked(
                poolImpl()
            ),
            key,
            factory
        );

        if (predictedAddress != address(this)) return false;

        return true;
    }

        function _onlyCanonicalPools(
        PoolsharkStructs.Immutables memory constants
    ) private view returns (bool) {
        // generate key for pool
        bytes32 key = keccak256(abi.encode(
            poolImpl(),
            constants.token0,
            constants.token1,
            constants.swapFee
        ));

        // compute address
        address predictedAddress = LibClone.predictDeterministicAddress(
            poolImpl(),
            abi.encodePacked(
                constants.owner,
                constants.token0,
                constants.token1,
                constants.poolToken,
                constants.bounds.min,
                constants.bounds.max,
                constants.genesisTime,
                constants.tickSpacing,
                constants.swapFee
            ),
            key,
            factory
        );

        if (predictedAddress != msg.sender) return false;

        return true;
    }

    /// @notice Return if the `_target` contract supports ERC-1155 interface
    /// @param _target The address of the contract
    /// @return supported Whether the contract is supported (true) or not (false)
    function _verifyERC1155Support(address _target) private view returns (bool supported) {
        if (_target.code.length == 0) return true;
        bytes memory encodedParams = abi.encodeWithSelector(
            IERC165.supportsInterface.selector,
            type(IRangePoolERC1155).interfaceId
        );
        (bool success, bytes memory result) = _target.staticcall{gas: 30_000}(encodedParams);
        if (result.length < 32) return false;
        return success && abi.decode(result, (bool));
    }
}