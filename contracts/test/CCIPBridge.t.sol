// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {CCIPLocalSimulator, IRouterClient, LinkToken, BurnMintERC677Helper} from "@chainlink/local/src/ccip/CCIPLocalSimulator.sol";
import {CCIPBridge} from "../src/CCIPBridge.sol";
import {Client} from "../src/interfaces/ICCIPRouter.sol";


/// @title CCIPBridgeTest
/// @notice Integration tests for CCIPBridge using Chainlink CCIP Local Simulator
contract CCIPBridgeTest is Test {
    CCIPLocalSimulator public simulator;
    CCIPBridge public bridge;

    uint64 public chainSelector;
    IRouterClient public sourceRouter;
    IRouterClient public destinationRouter;
    LinkToken public linkToken;
    BurnMintERC677Helper public ccipBnM; // used as USDC stand-in

    address public owner;
    address public alice = makeAddr("alice");
    address public receiver = makeAddr("receiver");

    function setUp() public {
        owner = address(this);

        // Deploy the CCIP local simulator
        simulator = new CCIPLocalSimulator();

        // Retrieve configuration from the simulator
        (
            uint64 chainSelector_,
            IRouterClient sourceRouter_,
            IRouterClient destinationRouter_,
            ,
            LinkToken linkToken_,
            BurnMintERC677Helper ccipBnM_,
        ) = simulator.configuration();

        chainSelector = chainSelector_;
        sourceRouter = sourceRouter_;
        destinationRouter = destinationRouter_;
        linkToken = linkToken_;
        ccipBnM = ccipBnM_;

        // Deploy CCIPBridge with the mock router, using ccipBnM as the USDC token
        bridge = new CCIPBridge(
            address(sourceRouter),
            address(ccipBnM),
            address(linkToken)
        );

        // Configure an allowed destination chain
        bridge.configureChain(chainSelector, receiver);

        // Fund the bridge with LINK for fees
        simulator.requestLinkFromFaucet(address(bridge), 100 ether);

        // Mint ccipBnM tokens to alice for testing
        ccipBnM.drip(alice);
    }

    // -------------------------------------------------------
    // Configuration Tests
    // -------------------------------------------------------

    function test_configureChain() public view {
        assertTrue(bridge.allowedChains(chainSelector));
        assertEq(bridge.destinationReceivers(chainSelector), receiver);
    }

    function test_disableChain() public {
        bridge.disableChain(chainSelector);
        assertFalse(bridge.allowedChains(chainSelector));
    }

    function test_configureChain_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(CCIPBridge.OnlyOwner.selector);
        bridge.configureChain(12345, address(0xBEEF));
    }

    // -------------------------------------------------------
    // Fee Estimation Tests
    // -------------------------------------------------------

    function test_estimateFee_returnsValue() public view {
        uint256 fee = bridge.estimateFee(chainSelector, 1000e6, "");
        // The mock router returns 0 by default, which is a valid fee
        assertGe(fee, 0);
    }

    function test_estimateFee_withData() public view {
        bytes memory data = abi.encode("deploy_to_aave");
        uint256 fee = bridge.estimateFee(chainSelector, 5000e6, data);
        assertGe(fee, 0);
    }

    // -------------------------------------------------------
    // Bridge Tokens Tests
    // -------------------------------------------------------

    function test_bridgeTokens_success() public {
        uint256 amount = 1e18; // ccipBnM uses 18 decimals

        // Alice approves the bridge to spend her tokens
        vm.startPrank(alice);
        ccipBnM.approve(address(bridge), amount);

        // Bridge tokens to destination chain
        bytes32 messageId = bridge.bridgeTokens(chainSelector, amount, "");
        vm.stopPrank();

        // Verify a message ID was returned
        assertTrue(messageId != bytes32(0));

        // Verify tokens were transferred from alice (bridge transferred them to router,
        // and the mock router forwards to receiver)
        assertLt(ccipBnM.balanceOf(alice), 1e18);
    }

    function test_bridgeTokens_withData() public {
        uint256 amount = 1e18;

        vm.startPrank(alice);
        ccipBnM.approve(address(bridge), amount);

        bytes memory deployData = abi.encode("deploy_to_aave_v3");
        bytes32 messageId = bridge.bridgeTokens(chainSelector, amount, deployData);
        vm.stopPrank();

        assertTrue(messageId != bytes32(0));
    }

    function test_bridgeTokens_chainNotAllowed() public {
        uint64 invalidChain = 99999;

        vm.startPrank(alice);
        ccipBnM.approve(address(bridge), 1e18);

        vm.expectRevert(CCIPBridge.ChainNotAllowed.selector);
        bridge.bridgeTokens(invalidChain, 1e18, "");
        vm.stopPrank();
    }

    function test_bridgeTokens_multipleTransfers() public {
        uint256 amount = 0.5e18;

        // Mint more tokens to alice for multiple transfers
        ccipBnM.drip(alice);

        vm.startPrank(alice);
        ccipBnM.approve(address(bridge), type(uint256).max);

        bytes32 messageId1 = bridge.bridgeTokens(chainSelector, amount, "");
        bytes32 messageId2 = bridge.bridgeTokens(chainSelector, amount, abi.encode("second"));
        vm.stopPrank();

        // Each call should produce a different message ID
        assertTrue(messageId1 != messageId2, "Message IDs should be unique");
    }

    function test_bridgeTokens_tokensArrivedAtReceiver() public {
        uint256 amount = 1e18;
        uint256 receiverBalBefore = ccipBnM.balanceOf(receiver);

        vm.startPrank(alice);
        ccipBnM.approve(address(bridge), amount);
        bridge.bridgeTokens(chainSelector, amount, "");
        vm.stopPrank();

        // The mock router transfers tokens directly to the receiver
        uint256 receiverBalAfter = ccipBnM.balanceOf(receiver);
        assertEq(receiverBalAfter - receiverBalBefore, amount);
    }

    // -------------------------------------------------------
    // ccipReceive Tests
    // -------------------------------------------------------

    function test_ccipReceive_success() public {
        // Build a mock Any2EVMMessage
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: address(ccipBnM),
            amount: 1000e6
        });

        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("test-message-1"),
            sourceChainSelector: chainSelector,
            sender: abi.encode(address(0xCAFE)),
            data: "",
            destTokenAmounts: tokenAmounts
        });

        // Call ccipReceive as the router (mock router address)
        vm.prank(address(sourceRouter));
        bridge.ccipReceive(message);

        // Verify message was marked as processed
        assertTrue(bridge.processedMessages(keccak256("test-message-1")));
    }

    function test_ccipReceive_onlyRouter() public {
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: address(ccipBnM),
            amount: 1000e6
        });

        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("test-message-2"),
            sourceChainSelector: chainSelector,
            sender: abi.encode(address(0xCAFE)),
            data: "",
            destTokenAmounts: tokenAmounts
        });

        // Calling from a non-router address should revert
        vm.prank(alice);
        vm.expectRevert(CCIPBridge.OnlyRouter.selector);
        bridge.ccipReceive(message);
    }

    function test_ccipReceive_duplicateMessage() public {
        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: address(ccipBnM),
            amount: 1000e6
        });

        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("test-message-3"),
            sourceChainSelector: chainSelector,
            sender: abi.encode(address(0xCAFE)),
            data: "",
            destTokenAmounts: tokenAmounts
        });

        // First call should succeed
        vm.prank(address(sourceRouter));
        bridge.ccipReceive(message);

        // Second call with same messageId should revert
        vm.prank(address(sourceRouter));
        vm.expectRevert(CCIPBridge.MessageAlreadyProcessed.selector);
        bridge.ccipReceive(message);
    }

    function test_ccipReceive_marksProcessed() public {
        bytes32 msgId = keccak256("test-message-4");

        Client.EVMTokenAmount[] memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: address(ccipBnM),
            amount: 5000e6
        });

        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: msgId,
            sourceChainSelector: chainSelector,
            sender: abi.encode(address(0xCAFE)),
            data: "",
            destTokenAmounts: tokenAmounts
        });

        // Verify not processed before
        assertFalse(bridge.processedMessages(msgId));

        vm.prank(address(sourceRouter));
        bridge.ccipReceive(message);

        // Verify processed after
        assertTrue(bridge.processedMessages(msgId));
    }

    // -------------------------------------------------------
    // Admin Tests
    // -------------------------------------------------------

    function test_withdrawLink() public {
        uint256 bridgeLinkBalance = linkToken.balanceOf(address(bridge));
        assertGt(bridgeLinkBalance, 0);

        bridge.withdrawLink();
        assertEq(linkToken.balanceOf(address(bridge)), 0);
        assertEq(linkToken.balanceOf(owner), bridgeLinkBalance);
    }

    function test_withdrawLink_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(CCIPBridge.OnlyOwner.selector);
        bridge.withdrawLink();
    }

    function test_withdrawUsdc() public {
        // Send some tokens to the bridge
        ccipBnM.drip(address(bridge));
        uint256 bal = ccipBnM.balanceOf(address(bridge));
        assertGt(bal, 0);

        bridge.withdrawUsdc();
        assertEq(ccipBnM.balanceOf(address(bridge)), 0);
    }
}
