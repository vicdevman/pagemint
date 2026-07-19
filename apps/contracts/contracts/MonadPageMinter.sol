// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Interface for interacting with target ERC20 assets for token gating.
 */
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

contract MonadPageMinter {
    
    struct Page {
        address creator;
        address targetContract;   // The contract representing the project (token, vault, or protocol)
        address gateToken;        // The specific ERC-20 token checked for gating access
        uint256 minTokenToUnlock;// Minimum token balance of gateToken needed to view gated content
        uint256 totalTrustVotes; // Aggregated number of unique trust votes
        uint256 totalStakedValue;// Total MON staked to this page by supporters
        string ipfsMetadataHash; // Hash containing custom layouts, roadmaps, and configurations
        uint256 mintedAt;
        bool isMinted;
    }

    // Protocol configurations
    address public owner;
    uint256 public mintFee = 0.01 ether;       // Fee in MON to mint a page
    uint256 public voteStakeAmount = 0.05 ether; // Amount of MON required to trust-vote

    // Global accounting metrics
    uint256 public totalPagesMinted;
    uint256 public totalProtocolRevenue;

    // Registries
    mapping(address => Page) public registry;                       // targetContract => Page details
    mapping(address => mapping(address => bool)) public hasVoted;    // user => targetContract => voted status

    // Events
    event PageMinted(
        address indexed targetContract, 
        address indexed creator, 
        address gateToken, 
        uint256 minTokenToUnlock, 
        string ipfsHash
    );
    event PageUpdated(address indexed targetContract, address gateToken, uint256 minTokenToUnlock, string newIpfsHash);
    event TrustVoted(address indexed targetContract, address indexed voter, uint256 currentVotes, uint256 creatorPayout);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can execute");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Mints a new interactive landing page for a target token/protocol contract.
     * @param _targetContract The contract address representing the project (token or protocol).
     * @param _gateToken The specific ERC-20 token contract to check balance against for gating.
     * @param _minTokenToUnlock Threshold requirement for dynamic content unlocking.
     * @param _ipfsMetadataHash IPFS pointer containing roadmap, styles, and custom configurations.
     */
    function mintPage(
        address _targetContract,
        address _gateToken,
        uint256 _minTokenToUnlock,
        string calldata _ipfsMetadataHash
    ) external payable {
        require(_targetContract != address(0), "Invalid target address");
        require(_gateToken != address(0), "Invalid gate token address");
        require(!registry[_targetContract].isMinted, "Page already minted");
        require(msg.value >= mintFee, "Incorrect mint fee sent");

        registry[_targetContract] = Page({
            creator: msg.sender,
            targetContract: _targetContract,
            gateToken: _gateToken,
            minTokenToUnlock: _minTokenToUnlock,
            totalTrustVotes: 0,
            totalStakedValue: 0,
            ipfsMetadataHash: _ipfsMetadataHash,
            mintedAt: block.timestamp,
            isMinted: true
        });

        totalPagesMinted++;
        totalProtocolRevenue += msg.value;

        emit PageMinted(_targetContract, msg.sender, _gateToken, _minTokenToUnlock, _ipfsMetadataHash);
    }

    /**
     * @notice Allows the verified creator to edit and update their page configurations.
     */
    function updatePageConfig(
        address _targetContract,
        address _gateToken,
        uint256 _minTokenToUnlock,
        string calldata _newIpfsHash
    ) external {
        require(registry[_targetContract].isMinted, "Page not found");
        require(registry[_targetContract].creator == msg.sender, "Only creator can edit");
        require(_gateToken != address(0), "Invalid gate token address");

        registry[_targetContract].gateToken = _gateToken;
        registry[_targetContract].minTokenToUnlock = _minTokenToUnlock;
        registry[_targetContract].ipfsMetadataHash = _newIpfsHash;

        emit PageUpdated(_targetContract, _gateToken, _minTokenToUnlock, _newIpfsHash);
    }

    /**
     * @notice Trust Staking Vote: Supporter stakes MON to upvote. Splits payout (80% to creator, 20% to protocol).
     */
    function submitTrustVote(address _targetContract) external payable {
        require(registry[_targetContract].isMinted, "Page not found");
        require(!hasVoted[msg.sender][_targetContract], "Already voted");
        require(msg.value >= voteStakeAmount, "Insufficient stake sent");

        Page storage page = registry[_targetContract];
        hasVoted[msg.sender][_targetContract] = true;
        
        page.totalTrustVotes += 1;
        page.totalStakedValue += msg.value;

        // Perform split payouts
        uint256 creatorShare = (msg.value * 80) / 100;
        uint256 protocolShare = msg.value - creatorShare;

        totalProtocolRevenue += protocolShare;
        
        // Transfer 80% directly to project creator
        (bool successCreator, ) = payable(page.creator).call{value: creatorShare}("");
        require(successCreator, "Creator payment failed");

        emit TrustVoted(_targetContract, msg.sender, page.totalTrustVotes, creatorShare);
    }

    /**
     * @notice Core Access Gate verification logic. 
     * @dev Checks if the viewer has the minimum required amount of the designated gateToken.
     */
    function checkAccess(address _viewer, address _targetContract) external view returns (bool) {
        if (!registry[_targetContract].isMinted) return false;
        Page memory page = registry[_targetContract];
        
        // Query the balance of the designated gateToken instead of the target contract itself
        try IERC20(page.gateToken).balanceOf(_viewer) returns (uint256 balance) {
            return balance >= page.minTokenToUnlock;
        } catch {
            // Fallback: If gateToken isn't a standard ERC20, allow viewing to prevent permanent locks
            return true;
        }
    }

    // Protocol administrative updates
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    function updateMintFee(uint256 _newFee) external onlyOwner {
        mintFee = _newFee;
    }
}
