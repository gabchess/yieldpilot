// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IAaveV3Pool} from "./interfaces/IAaveV3Pool.sol";
import {ICompoundV3} from "./interfaces/ICompoundV3.sol";
import {YieldPilotVault} from "./YieldPilotVault.sol";

/// @title YieldPilotRouter
/// @notice Routes funds to DeFi protocols based on AI-recommended strategies
contract YieldPilotRouter {
    // --- Types ---
    enum Protocol {
        AAVE_V3,
        COMPOUND_V3
    }

    struct ProtocolConfig {
        address pool; // Aave pool or Compound comet address
        bool active;
    }

    // --- State ---
    address public owner;
    YieldPilotVault public vault;
    IERC20 public immutable usdc;
    address public bridge; // CCIPBridge contract

    mapping(Protocol => ProtocolConfig) public protocols;
    mapping(address => mapping(Protocol => uint256)) public userDeposits;

    // --- Events ---
    event ProtocolConfigured(Protocol indexed protocol, address pool);
    event FundsDeployed(address indexed user, Protocol indexed protocol, uint256 amount);
    event FundsWithdrawn(address indexed user, Protocol indexed protocol, uint256 amount);
    event BridgeInitiated(address indexed user, uint64 destChain, uint256 amount);

    // --- Errors ---
    error OnlyOwner();
    error OnlyVaultOrOwner();
    error ProtocolNotActive();
    error InsufficientFunds();
    error InvalidProtocol();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyVaultOrOwner() {
        if (msg.sender != address(vault) && msg.sender != owner) revert OnlyVaultOrOwner();
        _;
    }

    constructor(address _usdc, address _vault) {
        owner = msg.sender;
        usdc = IERC20(_usdc);
        vault = YieldPilotVault(_vault);
    }

    // --- Configuration ---

    function setBridge(address _bridge) external onlyOwner {
        bridge = _bridge;
    }

    function configureProtocol(Protocol protocol, address pool) external onlyOwner {
        protocols[protocol] = ProtocolConfig({pool: pool, active: true});
        // Approve pool to spend USDC
        usdc.approve(pool, type(uint256).max);
        emit ProtocolConfigured(protocol, pool);
    }

    function disableProtocol(Protocol protocol) external onlyOwner {
        protocols[protocol].active = false;
    }

    // --- Deployment ---

    /// @notice Deploy funds to a specific protocol on this chain
    function deployToProtocol(address user, Protocol protocol, uint256 amount) public onlyVaultOrOwner {
        ProtocolConfig memory config = protocols[protocol];
        if (!config.active) revert ProtocolNotActive();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientFunds();

        if (protocol == Protocol.AAVE_V3) {
            IAaveV3Pool(config.pool).supply(address(usdc), amount, address(this), 0);
        } else if (protocol == Protocol.COMPOUND_V3) {
            ICompoundV3(config.pool).supply(address(usdc), amount);
        } else {
            revert InvalidProtocol();
        }

        userDeposits[user][protocol] += amount;
        emit FundsDeployed(user, protocol, amount);
    }

    /// @notice Withdraw funds from a protocol and return to vault
    function withdrawFromProtocol(address user, Protocol protocol, uint256 amount) external onlyVaultOrOwner {
        ProtocolConfig memory config = protocols[protocol];
        if (!config.active) revert ProtocolNotActive();
        if (userDeposits[user][protocol] < amount) revert InsufficientFunds();

        if (protocol == Protocol.AAVE_V3) {
            IAaveV3Pool(config.pool).withdraw(address(usdc), amount, address(this));
        } else if (protocol == Protocol.COMPOUND_V3) {
            ICompoundV3(config.pool).withdraw(address(usdc), amount);
        }

        userDeposits[user][protocol] -= amount;

        // Return funds to vault
        usdc.approve(address(vault), amount);
        vault.returnFunds(user, amount);

        emit FundsWithdrawn(user, protocol, amount);
    }

    /// @notice Send funds to bridge for cross-chain deployment
    function bridgeFunds(address user, uint64 destChainSelector, uint256 amount) public onlyVaultOrOwner {
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientFunds();
        usdc.transfer(bridge, amount);
        emit BridgeInitiated(user, destChainSelector, amount);
    }

    /// @notice Execute a full strategy from the vault
    function executeFullStrategy(uint256 strategyId) external onlyOwner {
        // Get strategy from vault
        YieldPilotVault.Strategy memory strategy = vault.getStrategy(strategyId);
        YieldPilotVault.Allocation[] memory allocations = vault.getAllocations(strategyId);

        // Execute vault strategy (transfers funds here)
        vault.executeStrategy(strategyId);

        // Deploy to each allocation
        for (uint256 i = 0; i < allocations.length; i++) {
            YieldPilotVault.Allocation memory alloc = allocations[i];

            if (alloc.chainSelector == 0) {
                // Same chain - deploy directly
                // Determine protocol from address
                if (protocols[Protocol.AAVE_V3].pool == alloc.protocol) {
                    deployToProtocol(strategy.user, Protocol.AAVE_V3, alloc.amount);
                } else if (protocols[Protocol.COMPOUND_V3].pool == alloc.protocol) {
                    deployToProtocol(strategy.user, Protocol.COMPOUND_V3, alloc.amount);
                }
            } else {
                // Cross-chain - bridge funds
                bridgeFunds(strategy.user, alloc.chainSelector, alloc.amount);
            }
        }
    }

    // --- Views ---

    function getUserDeposit(address user, Protocol protocol) external view returns (uint256) {
        return userDeposits[user][protocol];
    }
}
