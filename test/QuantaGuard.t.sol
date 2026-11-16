// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PQGuardianRegistry} from "../src/PQGuardianRegistry.sol";
import {QuantaGuardAccount} from "../src/QuantaGuardAccount.sol";
import {QuantaGuardFactory} from "../src/QuantaGuardFactory.sol";
import {QUBOJobBoard} from "../src/QUBOJobBoard.sol";

contract QuantaGuardTest is Test {
    PQGuardianRegistry registry;
    QuantaGuardFactory factory;
    QUBOJobBoard board;

    address owner = address(0xA11CE);
    address guardian = address(0x6A12D);
    address agent = address(0xA6E77);
    address target = address(0x7A9E7);
    address solver1 = address(0x5011);
    address solver2 = address(0x5022);
    address poster;

    function setUp() public {
        // fix poster address (hex literal guard)
        poster = address(0xB057);
        registry = new PQGuardianRegistry();
        factory = new QuantaGuardFactory(address(registry));
        board = new QUBOJobBoard();
        vm.deal(owner, 100 ether);
        vm.deal(poster, 100 ether);
        vm.deal(target, 0);
    }

    function _createAccount() internal returns (QuantaGuardAccount acc) {
        address predicted = factory.getAddress(owner, bytes32(uint256(1)));
        address created = factory.createAccount(owner, bytes32(uint256(1)));
        assertEq(created, predicted, "CREATE2 prediction mismatch");
        acc = QuantaGuardAccount(payable(created));
        vm.deal(created, 10 ether);
    }

    function test_factoryCreatesAccount() public {
        QuantaGuardAccount acc = _createAccount();
        assertEq(acc.owner(), owner);
        // idempotent second create returns same address
        assertEq(factory.createAccount(owner, bytes32(uint256(1))), address(acc));
    }

    function test_ownerExecute() public {
        QuantaGuardAccount acc = _createAccount();
        vm.prank(owner);
        acc.execute(target, 1 ether, "");
        assertEq(target.balance, 1 ether);
    }

    function test_sessionKeyWithinLimit() public {
        QuantaGuardAccount acc = _createAccount();
        vm.prank(owner);
        acc.addSessionKey(agent, block.timestamp + 1 days, 2 ether, address(0));
        vm.prank(agent);
        acc.execute(target, 1.5 ether, "");
        assertEq(target.balance, 1.5 ether);
    }

    function test_sessionKeyOverLimitReverts() public {
        QuantaGuardAccount acc = _createAccount();
        vm.prank(owner);
        acc.addSessionKey(agent, block.timestamp + 1 days, 1 ether, address(0));
        vm.prank(agent);
        vm.expectRevert(QuantaGuardAccount.SpendLimitExceeded.selector);
        acc.execute(target, 1.1 ether, "");
    }

    function test_sessionKeyTargetAndRevocation() public {
        QuantaGuardAccount acc = _createAccount();
        vm.prank(owner);
        acc.addSessionKey(agent, block.timestamp + 1 days, 5 ether, target);
        vm.prank(agent);
        vm.expectRevert(QuantaGuardAccount.TargetNotAllowed.selector);
        acc.execute(address(0xDEAD), 0.1 ether, "");
        vm.prank(owner);
        acc.revokeSessionKey(agent);
        vm.prank(agent);
        vm.expectRevert(QuantaGuardAccount.SessionInactive.selector);
        acc.execute(target, 0.1 ether, "");
    }

    function test_recoveryFlow() public {
        QuantaGuardAccount acc = _createAccount();
        // account registers its PQ guardian (account is msg.sender to registry)
        bytes32 commitment = keccak256("demo ML-DSA pubkey placeholder");
        vm.prank(owner);
        acc.registerGuardian(commitment, guardian);
        (address g, bytes32 c, bool active) = registry.guardianOf(address(acc));
        assertEq(g, guardian);
        assertEq(c, commitment);
        assertTrue(active);

        address newOwner = address(0xBEEF);
        vm.prank(guardian);
        acc.proposeRecovery(newOwner);
        // too early
        vm.expectRevert(QuantaGuardAccount.RecoveryNotReady.selector);
        acc.executeRecovery();
        // owner can cancel scenario tested separately; here warp past 48h
        vm.warp(block.timestamp + 48 hours + 1);
        acc.executeRecovery();
        assertEq(acc.owner(), newOwner);
    }

    function test_recoveryCancelByOwner() public {
        QuantaGuardAccount acc = _createAccount();
        vm.prank(owner);
        acc.registerGuardian(keccak256("pk"), guardian);
        vm.prank(guardian);
        acc.proposeRecovery(address(0xBEEF));
        vm.prank(owner);
        acc.cancelRecovery();
        vm.warp(block.timestamp + 49 hours);
        vm.expectRevert(QuantaGuardAccount.NoActiveRecovery.selector);
        acc.executeRecovery();
        assertEq(acc.owner(), owner);
    }

    function test_registryDirectAndRevoke() public {
        bytes32 commitment = keccak256("SLH-DSA pubkey demo");
        vm.prank(owner);
        registry.registerGuardian(commitment, guardian);
        assertTrue(registry.isGuardian(owner, guardian));
        vm.prank(owner);
        registry.revokeGuardian();
        assertFalse(registry.isGuardian(owner, guardian));
    }

    function test_jobPostSubmitSettlePaysBest() public {
        vm.prank(poster);
        uint256 jobId = board.postJob{value: 1 ether}(keccak256("qubo-portfolio-4asset"), block.timestamp + 1 days);
        vm.prank(solver1);
        board.submitSolution(jobId, keccak256("sol1"), -10);
        vm.prank(solver2);
        board.submitSolution(jobId, keccak256("sol2"), -42); // lower = better
        vm.warp(block.timestamp + 1 days + 1);
        uint256 before = solver2.balance;
        board.settle(jobId);
        assertEq(solver2.balance - before, 1 ether);
        assertEq(solver1.balance, 0);
    }

    function test_jobCancelRefundsBeforeSolution() public {
        vm.prank(poster);
        uint256 jobId = board.postJob{value: 0.5 ether}(keccak256("q"), block.timestamp + 1 days);
        uint256 before = poster.balance;
        vm.prank(poster);
        board.cancelJob(jobId);
        assertEq(poster.balance - before, 0.5 ether);
    }
}
