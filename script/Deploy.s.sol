// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PQGuardianRegistry} from "../src/PQGuardianRegistry.sol";
import {QuantaGuardFactory} from "../src/QuantaGuardFactory.sol";
import {QUBOJobBoard} from "../src/QUBOJobBoard.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        PQGuardianRegistry registry = new PQGuardianRegistry();
        QuantaGuardFactory factory = new QuantaGuardFactory(address(registry));
        QUBOJobBoard board = new QUBOJobBoard();
        vm.stopBroadcast();
        console.log("PQGuardianRegistry:", address(registry));
        console.log("QuantaGuardFactory:", address(factory));
        console.log("QUBOJobBoard:", address(board));
    }
}
