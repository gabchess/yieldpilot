// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {YieldPilotVault} from "../src/YieldPilotVault.sol";
import {YieldPilotRouter} from "../src/YieldPilotRouter.sol";
import {CCIPBridge} from "../src/CCIPBridge.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address priceFeed = vm.envAddress("USDC_USD_FEED");
        address ccipRouter = vm.envAddress("CCIP_ROUTER");
        address linkToken = vm.envAddress("LINK_TOKEN");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Vault
        YieldPilotVault vault = new YieldPilotVault(usdc, priceFeed);
        console.log("YieldPilotVault deployed at:", address(vault));

        // 2. Deploy Router
        YieldPilotRouter router = new YieldPilotRouter(usdc, address(vault));
        console.log("YieldPilotRouter deployed at:", address(router));

        // 3. Deploy Bridge
        CCIPBridge bridge = new CCIPBridge(ccipRouter, usdc, linkToken);
        console.log("CCIPBridge deployed at:", address(bridge));

        // 4. Wire contracts together
        vault.setRouter(address(router));
        vault.setBridge(address(bridge));
        router.setBridge(address(bridge));

        vm.stopBroadcast();
    }
}
