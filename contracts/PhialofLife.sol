// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// @author Metaperficient
// @contact metaperficint@gmail.com

contract PhialofLife is
Ownable,
ReentrancyGuard,
ERC721
{
    using Strings for uint256;
    using Counters for Counters.Counter;

    bytes32 public root;

    address proxyRegistryAddress;
    uint256 public maxSupply = 10000;

    string public baseURI = "ipfs://QmWYsGRdAkkvVsVJhUYd4EjK8eE7WKNth8huHoRbENGMof/";
    string public baseExtension = ".json";

    bool public paused = false;
    bool public presaleM = false;
    bool public publicM = false;

    uint256 presaleAmountLimit = 1500;
    mapping(address => uint256) public _presaleClaimed;
    uint256 public _maximumLimit = 5;

    uint256 public _price = 5000000000000000;

    Counters.Counter private _tokenIds;

    constructor( bytes32 merkleroot, address _proxyRegistryAddress)
    ERC721("PhialofLife", "POL")
    ReentrancyGuard()
    {
        root = merkleroot;
        proxyRegistryAddress = _proxyRegistryAddress;
    }
    //changeable base URI
    function setBaseURI(string memory _tokenBaseURI) public onlyOwner {
        baseURI = _tokenBaseURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function setMerkleRoot(bytes32 merkleroot)
    onlyOwner
    public
    {
        root = merkleroot;
    }

    function getBalance() public view returns(uint) {
        return address(this).balance;
    }

    function withdrawMoney() public onlyOwner {
        address payable to = payable(msg.sender);
        to.transfer(getBalance());
    }

    function transfer(address payable _to, uint _amount) public onlyOwner nonReentrant {
        (bool success, ) = _to.call{value: _amount}("");
        require(success, "Failed to send Ether");
    }

    modifier onlyAccounts () {
        require(msg.sender == tx.origin, "Not allowed origin");
        _;
    }

    modifier isValidMerkleProof(bytes32[] calldata _proof) {
        require(MerkleProof.verify(
            _proof,
            root,
            keccak256(abi.encodePacked(msg.sender))
        ) == true, "Not allowed origin");
        _;
    }

    function togglePause() public onlyOwner {
        paused = !paused;
    }

    function togglePresale() public onlyOwner {
        presaleM = !presaleM;
    }

    function togglePublicSale() public onlyOwner {
        publicM = !publicM;
    }

    function changePrice(uint256 _newPrice) public onlyOwner{
        _price = _newPrice;
    }

    function presaleMint(address account, uint256 _amount, bytes32[] calldata _proof)
    external
    payable
    isValidMerkleProof(_proof)
    onlyAccounts
    {
        require((balanceOf(msg.sender) + _amount) <= _maximumLimit, "Cannot exceed limit");
        require(msg.sender == account,          "Metafi: Not allowed");
        require(presaleM,                       "Metafi: Presale is OFF");
        require(!paused,                        "Metafi: Contract is paused");
        require(
            _amount <= presaleAmountLimit,      "Metafi: You can't mint so much tokens");
        require(
            _presaleClaimed[msg.sender] + _amount <= presaleAmountLimit,  "Metafi: You can't mint so much tokens");


        uint current = _tokenIds.current();

        require(
            current + _amount <= maxSupply,
            "Metafi: max supply exceeded"
        );
        require(
            _price * _amount <= msg.value,
            "Metafi: Not enough ethers sent"
        );

        _presaleClaimed[msg.sender] += _amount;

        for (uint i = 0; i < _amount; i++) {
            mintInternal();
        }
    }

    function publicSaleMint(uint256 _amount)
    external
    payable
    onlyAccounts
    {
        require(publicM,  "Metafi: PublicSale is OFF");
        require(!paused, "Metafi: Contract is paused");
        require(_amount > 0, "Metafi: zero amount");

        uint current = _tokenIds.current();

        require(
            current + _amount <= maxSupply,
            "Metafi: Max supply exceeded"
        );
        require(
            _price * _amount <= msg.value,
            "Metafi: Not enough ethers sent"
        );


        for (uint i = 0; i < _amount; i++) {
            mintInternal();
        }
    }

    function mintInternal() internal nonReentrant {
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        _safeMint(msg.sender, tokenId);
    }

    function tokenURI(uint256 tokenId)
    public
    view
    virtual
    override
    returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );

        string memory currentBaseURI = _baseURI();

        return
        bytes(currentBaseURI).length > 0
        ? string(
            abi.encodePacked(
                currentBaseURI,
                tokenId.toString(),
                baseExtension
            )
        )
        : "";
    }

    function setBaseExtension(string memory _newBaseExtension)
    public
    onlyOwner
    {
        baseExtension = _newBaseExtension;
    }

    function totalSupply() public view returns (uint) {
        return _tokenIds.current();
    }

    function isApprovedForAll(address owner, address operator)
    override
    public
    view
    returns (bool)
    {
        // Whitelist OpenSea proxy contract for easy trading.
        ProxyRegistry proxyRegistry = ProxyRegistry(proxyRegistryAddress);
        if (address(proxyRegistry.proxies(owner)) == operator) {
            return true;
        }

        return super.isApprovedForAll(owner, operator);
    }
}



/**
  @title An OpenSea delegate proxy contract which we include for whitelisting.
  @author OpenSea
*/
contract OwnableDelegateProxy {}

/**
  @title An OpenSea proxy registry contract which we include for whitelisting.
  @author OpenSea
*/
contract ProxyRegistry {
    mapping(address => OwnableDelegateProxy) public proxies;
}