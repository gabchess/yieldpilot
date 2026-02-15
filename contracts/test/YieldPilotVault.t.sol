// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {YieldPilotVault} from "../src/YieldPilotVault.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {AggregatorV3Interface} from "../src/interfaces/AggregatorV3Interface.sol";

contract MockERC20 is IERC20 {
    string public name = "Mock USDC";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockPriceFeed is AggregatorV3Interface {
    int256 public price = 100000000; // $1.00 with 8 decimals

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function description() external pure returns (string memory) {
        return "USDC/USD";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, price, block.timestamp, block.timestamp, 1);
    }

    function setPrice(int256 _price) external {
        price = _price;
    }
}

contract YieldPilotVaultTest is Test {
    YieldPilotVault public vault;
    MockERC20 public usdc;
    MockPriceFeed public priceFeed;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockERC20();
        priceFeed = new MockPriceFeed();
        vault = new YieldPilotVault(address(usdc), address(priceFeed));

        // Fund alice
        usdc.mint(alice, 100_000e6);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
    }

    function test_deposit() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        assertEq(vault.getUserBalance(alice), 10_000e6);
        assertEq(usdc.balanceOf(address(vault)), 10_000e6);
    }

    function test_withdraw() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        vm.prank(alice);
        vault.withdraw(5_000e6);

        assertEq(vault.getUserBalance(alice), 5_000e6);
        assertEq(usdc.balanceOf(alice), 95_000e6);
    }

    function test_withdraw_insufficient() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        vm.prank(alice);
        vm.expectRevert(YieldPilotVault.InsufficientBalance.selector);
        vault.withdraw(20_000e6);
    }

    function test_proposeStrategy() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        YieldPilotVault.Allocation[] memory allocs = new YieldPilotVault.Allocation[](2);
        allocs[0] = YieldPilotVault.Allocation({
            chainSelector: 0,
            protocol: address(0x1),
            asset: address(usdc),
            amount: 6_000e6,
            expectedApy: 520
        });
        allocs[1] = YieldPilotVault.Allocation({
            chainSelector: 0,
            protocol: address(0x2),
            asset: address(usdc),
            amount: 4_000e6,
            expectedApy: 380
        });

        uint256 strategyId = vault.proposeStrategy(alice, allocs, 10_000e6);
        assertEq(strategyId, 1);

        YieldPilotVault.Strategy memory s = vault.getStrategy(1);
        assertEq(s.user, alice);
        assertEq(s.totalAmount, 10_000e6);
        assertFalse(s.approved);
        assertFalse(s.executed);
    }

    function test_approveAndExecuteStrategy() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        // Set router so vault can transfer funds
        address router = makeAddr("router");
        vault.setRouter(router);

        YieldPilotVault.Allocation[] memory allocs = new YieldPilotVault.Allocation[](1);
        allocs[0] = YieldPilotVault.Allocation({
            chainSelector: 0,
            protocol: address(0x1),
            asset: address(usdc),
            amount: 10_000e6,
            expectedApy: 520
        });

        vault.proposeStrategy(alice, allocs, 10_000e6);

        // Alice approves
        vm.prank(alice);
        vault.approveStrategy(1);

        YieldPilotVault.Strategy memory s = vault.getStrategy(1);
        assertTrue(s.approved);

        // Execute
        vault.executeStrategy(1);

        assertEq(vault.getUserBalance(alice), 0);
        assertEq(usdc.balanceOf(router), 10_000e6);
    }

    function test_validateUsdcPeg_normal() public view {
        assertTrue(vault.validateUsdcPeg());
    }

    function test_validateUsdcPeg_depeg() public {
        priceFeed.setPrice(90000000); // $0.90
        assertFalse(vault.validateUsdcPeg());
    }

    function test_getLatestPrice() public view {
        (int256 price, uint8 dec) = vault.getLatestPrice();
        assertEq(price, 100000000);
        assertEq(dec, 8);
    }
}
