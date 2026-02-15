// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

/// @title YieldPilotVault
/// @notice User-facing vault for deposits, strategy approval, and execution tracking
/// @dev Integrates with Chainlink Data Feeds for price validation
contract YieldPilotVault {
    // --- Types ---
    struct Strategy {
        uint256 id;
        address user;
        Allocation[] allocations;
        uint256 totalAmount;
        uint256 createdAt;
        bool executed;
        bool approved;
    }

    struct Allocation {
        uint64 chainSelector; // 0 = current chain
        address protocol;
        address asset;
        uint256 amount;
        uint256 expectedApy; // basis points (e.g., 520 = 5.20%)
    }

    struct UserPosition {
        uint256 deposited;
        uint256 activeStrategyId;
    }

    // --- State ---
    address public owner;
    address public router; // YieldPilotRouter
    address public bridge; // CCIPBridge
    IERC20 public immutable usdc;
    AggregatorV3Interface public immutable priceFeed;

    uint256 public nextStrategyId;
    mapping(uint256 => Strategy) public strategies;
    mapping(address => UserPosition) public positions;
    mapping(address => uint256) public balances;

    // --- Events ---
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event StrategyProposed(uint256 indexed strategyId, address indexed user, uint256 totalAmount);
    event StrategyApproved(uint256 indexed strategyId, address indexed user);
    event StrategyExecuted(uint256 indexed strategyId, address indexed user);

    // --- Errors ---
    error OnlyOwner();
    error OnlyRouter();
    error InsufficientBalance();
    error StrategyNotFound();
    error StrategyAlreadyExecuted();
    error StrategyNotApproved();
    error InvalidAmount();
    error StalePriceFeed();

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyRouterOrOwner() {
        if (msg.sender != router && msg.sender != owner) revert OnlyRouter();
        _;
    }

    constructor(address _usdc, address _priceFeed) {
        owner = msg.sender;
        usdc = IERC20(_usdc);
        priceFeed = AggregatorV3Interface(_priceFeed);
        nextStrategyId = 1;
    }

    // --- Configuration ---
    function setRouter(address _router) external onlyOwner {
        router = _router;
    }

    function setBridge(address _bridge) external onlyOwner {
        bridge = _bridge;
    }

    // --- User Actions ---

    /// @notice Deposit USDC into the vault
    function deposit(uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        usdc.transferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        positions[msg.sender].deposited += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Withdraw USDC from the vault (uninvested balance only)
    function withdraw(uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        if (balances[msg.sender] < amount) revert InsufficientBalance();
        balances[msg.sender] -= amount;
        positions[msg.sender].deposited -= amount;
        usdc.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Propose a yield strategy (called by CRE workflow via router)
    function proposeStrategy(address user, Allocation[] calldata allocations, uint256 totalAmount)
        external
        onlyRouterOrOwner
        returns (uint256 strategyId)
    {
        if (balances[user] < totalAmount) revert InsufficientBalance();

        strategyId = nextStrategyId++;
        Strategy storage s = strategies[strategyId];
        s.id = strategyId;
        s.user = user;
        s.totalAmount = totalAmount;
        s.createdAt = block.timestamp;

        for (uint256 i = 0; i < allocations.length; i++) {
            s.allocations.push(allocations[i]);
        }

        emit StrategyProposed(strategyId, user, totalAmount);
    }

    /// @notice User approves a proposed strategy
    function approveStrategy(uint256 strategyId) external {
        Strategy storage s = strategies[strategyId];
        if (s.id == 0) revert StrategyNotFound();
        if (s.user != msg.sender) revert OnlyOwner();
        if (s.executed) revert StrategyAlreadyExecuted();
        s.approved = true;
        emit StrategyApproved(strategyId, msg.sender);
    }

    /// @notice Execute an approved strategy (called by router)
    function executeStrategy(uint256 strategyId) external onlyRouterOrOwner {
        Strategy storage s = strategies[strategyId];
        if (s.id == 0) revert StrategyNotFound();
        if (!s.approved) revert StrategyNotApproved();
        if (s.executed) revert StrategyAlreadyExecuted();

        // Deduct from user balance
        if (balances[s.user] < s.totalAmount) revert InsufficientBalance();
        balances[s.user] -= s.totalAmount;

        // Transfer funds to router for deployment
        usdc.transfer(router, s.totalAmount);

        s.executed = true;
        positions[s.user].activeStrategyId = strategyId;
        emit StrategyExecuted(strategyId, s.user);
    }

    /// @notice Return funds from protocol withdrawal (called by router)
    function returnFunds(address user, uint256 amount) external onlyRouterOrOwner {
        usdc.transferFrom(msg.sender, address(this), amount);
        balances[user] += amount;
    }

    // --- Views ---

    function getStrategy(uint256 strategyId) external view returns (Strategy memory) {
        return strategies[strategyId];
    }

    function getAllocations(uint256 strategyId) external view returns (Allocation[] memory) {
        return strategies[strategyId].allocations;
    }

    function getUserBalance(address user) external view returns (uint256) {
        return balances[user];
    }

    /// @notice Get latest USDC price from Chainlink Data Feed
    function getLatestPrice() public view returns (int256 price, uint8 dec) {
        uint256 updatedAt;
        (, price,, updatedAt,) = priceFeed.latestRoundData();
        if (block.timestamp - updatedAt > 1 hours) revert StalePriceFeed();
        dec = priceFeed.decimals();
    }

    /// @notice Validate that USDC is pegged (within 1% of $1)
    function validateUsdcPeg() external view returns (bool) {
        (int256 price, uint8 decimals) = getLatestPrice();
        uint256 oneDollar = 10 ** decimals;
        uint256 absPrice = price > 0 ? uint256(price) : 0;
        // Check within 1% of $1
        return absPrice > (oneDollar * 99 / 100) && absPrice < (oneDollar * 101 / 100);
    }
}
