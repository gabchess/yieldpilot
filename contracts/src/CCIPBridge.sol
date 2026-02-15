// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {ICCIPRouter, Client} from "./interfaces/ICCIPRouter.sol";

/// @title CCIPBridge
/// @notice Handles CCIP send/receive for cross-chain yield deployment
/// @dev Bridges USDC to destination chains where higher yields are available
contract CCIPBridge {
    // --- State ---
    address public owner;
    ICCIPRouter public ccipRouter;
    IERC20 public immutable usdc;
    IERC20 public linkToken;

    // Destination chain config
    mapping(uint64 => address) public destinationReceivers; // chainSelector => receiver contract
    mapping(uint64 => bool) public allowedChains;

    // CCIP message tracking
    mapping(bytes32 => bool) public processedMessages;

    // --- Events ---
    event BridgeSent(
        bytes32 indexed messageId,
        uint64 indexed destChainSelector,
        address receiver,
        uint256 amount,
        uint256 fees
    );
    event BridgeReceived(bytes32 indexed messageId, uint64 indexed sourceChainSelector, uint256 amount);
    event ChainConfigured(uint64 indexed chainSelector, address receiver);

    // --- Errors ---
    error OnlyOwner();
    error OnlyRouter();
    error ChainNotAllowed();
    error InsufficientLinkFees();
    error MessageAlreadyProcessed();
    error InvalidReceiver();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _ccipRouter, address _usdc, address _linkToken) {
        owner = msg.sender;
        ccipRouter = ICCIPRouter(_ccipRouter);
        usdc = IERC20(_usdc);
        linkToken = IERC20(_linkToken);

        // Approve CCIP router to spend USDC and LINK
        usdc.approve(_ccipRouter, type(uint256).max);
        linkToken.approve(_ccipRouter, type(uint256).max);
    }

    // --- Configuration ---

    function configureChain(uint64 chainSelector, address receiver) external onlyOwner {
        destinationReceivers[chainSelector] = receiver;
        allowedChains[chainSelector] = true;
        emit ChainConfigured(chainSelector, receiver);
    }

    function disableChain(uint64 chainSelector) external onlyOwner {
        allowedChains[chainSelector] = false;
    }

    // --- Bridge Operations ---

    /// @notice Bridge USDC to a destination chain via CCIP
    /// @param destChainSelector The CCIP chain selector for the destination
    /// @param amount Amount of USDC to bridge
    /// @param data Additional data to pass (e.g., deployment instructions)
    function bridgeTokens(uint64 destChainSelector, uint256 amount, bytes calldata data)
        external
        returns (bytes32 messageId)
    {
        if (!allowedChains[destChainSelector]) revert ChainNotAllowed();
        address receiver = destinationReceivers[destChainSelector];
        if (receiver == address(0)) revert InvalidReceiver();

        // Transfer USDC from sender to this contract
        usdc.transferFrom(msg.sender, address(this), amount);

        // Build CCIP message
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({token: address(usdc), amount: amount});

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: data,
            tokenAmounts: tokenAmounts,
            feeToken: address(linkToken),
            extraArgs: ""
        });

        // Get fee estimate
        uint256 fees = ccipRouter.getFee(destChainSelector, message);
        if (linkToken.balanceOf(address(this)) < fees) revert InsufficientLinkFees();

        // Send via CCIP
        messageId = ccipRouter.ccipSend(destChainSelector, message);

        emit BridgeSent(messageId, destChainSelector, receiver, amount, fees);
    }

    /// @notice Receive CCIP message (called by CCIP router)
    /// @dev In production, this would be protected by CCIP's onlyRouter modifier
    function ccipReceive(Client.Any2EVMMessage calldata message) external {
        if (msg.sender != address(ccipRouter)) revert OnlyRouter();
        if (processedMessages[message.messageId]) revert MessageAlreadyProcessed();

        processedMessages[message.messageId] = true;

        emit BridgeReceived(message.messageId, message.sourceChainSelector, message.destTokenAmounts[0].amount);
    }

    /// @notice Get fee estimate for bridging
    function estimateFee(uint64 destChainSelector, uint256 amount, bytes calldata data)
        external
        view
        returns (uint256)
    {
        address receiver = destinationReceivers[destChainSelector];

        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({token: address(usdc), amount: amount});

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver),
            data: data,
            tokenAmounts: tokenAmounts,
            feeToken: address(linkToken),
            extraArgs: ""
        });

        return ccipRouter.getFee(destChainSelector, message);
    }

    // --- Admin ---

    function withdrawLink() external onlyOwner {
        linkToken.transfer(owner, linkToken.balanceOf(address(this)));
    }

    function withdrawUsdc() external onlyOwner {
        usdc.transfer(owner, usdc.balanceOf(address(this)));
    }
}
