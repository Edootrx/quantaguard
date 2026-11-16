// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PQGuardianRegistry} from "./PQGuardianRegistry.sol";

/// @title QuantaGuardAccount
/// @notice Minimal ERC-4337-style smart account for QMS Network.
/// @dev QMS v0.1 today: EVM-compatible (Prague/Osaka), standard ECDSA owners, no
///      blob txs, confirmations instead of a finality layer. This account is
///      deliberately EntryPoint-agnostic: `execute` mirrors the ERC-4337 account
///      abstraction surface, so wiring a bundler/paymaster (QMS Builder track:
///      ERC-4337 infrastructure) later requires only a validateUserOp adapter.
///      Features:
///        (a) Guardian recovery anchored to a PQ commitment in PQGuardianRegistry,
///            executed after a configurable timelock unless the owner cancels.
///        (b) AI-agent session keys with on-chain policy: expiry, cumulative
///            spend limit, and an optional single allowed target contract.
///            This is how an autonomous agent gets a bounded budget on QMS
///            without ever holding the owner key.
contract QuantaGuardAccount {
    struct SessionKey {
        uint256 expiry;
        uint256 spendLimit;
        uint256 spent;
        address allowedTarget; // address(0) = any target
        bool active;
    }

    address public owner;
    PQGuardianRegistry public immutable registry;
    uint256 public recoveryDelay; // seconds; testnet default set by factory

    address public pendingNewOwner;
    uint256 public recoveryExecuteAfter;
    bool public recoveryActive;

    mapping(address key => SessionKey) private _sessions;

    event Executed(address indexed caller, address indexed dest, uint256 value);
    event SessionKeyAdded(address indexed key, uint256 expiry, uint256 spendLimit, address allowedTarget);
    event SessionKeyRevoked(address indexed key);
    event RecoveryProposed(address indexed guardian, address indexed newOwner, uint256 executeAfter);
    event RecoveryCancelled(address indexed owner);
    event RecoveryExecuted(address indexed oldOwner, address indexed newOwner);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event RecoveryDelaySet(uint256 delaySeconds);

    error NotOwner();
    error NotGuardian();
    error SessionExpired();
    error SessionInactive();
    error SpendLimitExceeded();
    error TargetNotAllowed();
    error RecoveryNotReady();
    error NoActiveRecovery();
    error ZeroAddress();
    error CallFailed(bytes data);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _owner, address _registry, uint256 _recoveryDelay) {
        if (_owner == address(0)) revert ZeroAddress();
        owner = _owner;
        registry = PQGuardianRegistry(_registry);
        recoveryDelay = _recoveryDelay;
    }

    receive() external payable {}

    // ── Execution ──────────────────────────────────────────────────────────
    /// @notice Owner execution, or session-key execution if caller is a session key.
    function execute(address dest, uint256 value, bytes calldata data) external returns (bytes memory result) {
        if (msg.sender == owner) {
            return _call(dest, value, data);
        }
        // Session-key path (AI agents)
        SessionKey storage s = _sessions[msg.sender];
        if (!s.active) revert SessionInactive();
        if (block.timestamp > s.expiry) revert SessionExpired();
        if (s.allowedTarget != address(0) && s.allowedTarget != dest) revert TargetNotAllowed();
        if (s.spent + value > s.spendLimit) revert SpendLimitExceeded();
        s.spent += value;
        result = _call(dest, value, data);
        emit Executed(msg.sender, dest, value);
        return result;
    }

    function _call(address dest, uint256 value, bytes calldata data) internal returns (bytes memory) {
        (bool ok, bytes memory ret) = dest.call{value: value}(data);
        if (!ok) revert CallFailed(ret);
        if (msg.sender == owner) emit Executed(msg.sender, dest, value);
        return ret;
    }

    // ── Session keys (AI-agent policy) ─────────────────────────────────────
    function addSessionKey(address key, uint256 expiry, uint256 spendLimit, address allowedTarget)
        external
        onlyOwner
    {
        if (key == address(0)) revert ZeroAddress();
        _sessions[key] = SessionKey(expiry, spendLimit, 0, allowedTarget, true);
        emit SessionKeyAdded(key, expiry, spendLimit, allowedTarget);
    }

    function revokeSessionKey(address key) external onlyOwner {
        _sessions[key].active = false;
        emit SessionKeyRevoked(key);
    }

    function getSessionKey(address key) external view returns (SessionKey memory) {
        return _sessions[key];
    }

    // ── Guardian recovery (PQ-anchored) ────────────────────────────────────
    /// @notice A registry-linked guardian proposes a new owner. Timelocked.
    function proposeRecovery(address newOwner) external {
        if (newOwner == address(0)) revert ZeroAddress();
        if (!registry.isGuardian(address(this), msg.sender)) revert NotGuardian();
        pendingNewOwner = newOwner;
        recoveryExecuteAfter = block.timestamp + recoveryDelay;
        recoveryActive = true;
        emit RecoveryProposed(msg.sender, newOwner, recoveryExecuteAfter);
    }

    function cancelRecovery() external onlyOwner {
        if (!recoveryActive) revert NoActiveRecovery();
        recoveryActive = false;
        pendingNewOwner = address(0);
        recoveryExecuteAfter = 0;
        emit RecoveryCancelled(msg.sender);
    }

    function executeRecovery() external {
        if (!recoveryActive) revert NoActiveRecovery();
        if (block.timestamp < recoveryExecuteAfter) revert RecoveryNotReady();
        address old = owner;
        owner = pendingNewOwner;
        recoveryActive = false;
        pendingNewOwner = address(0);
        recoveryExecuteAfter = 0;
        emit RecoveryExecuted(old, owner);
        emit OwnerChanged(old, owner);
    }

    function setRecoveryDelay(uint256 delaySeconds) external onlyOwner {
        recoveryDelay = delaySeconds;
        emit RecoveryDelaySet(delaySeconds);
    }

    /// @notice Helper for onboarding: register this account's guardian in one call.
    function registerGuardian(bytes32 pqCommitment, address guardian) external onlyOwner {
        // The registry keys entries by msg.sender, so forward via a self-call pattern:
        // account itself must be msg.sender to the registry.
        (bool ok, bytes memory ret) = address(registry).call(
            abi.encodeWithSignature("registerGuardian(bytes32,address)", pqCommitment, guardian)
        );
        if (!ok) revert CallFailed(ret);
    }
}
