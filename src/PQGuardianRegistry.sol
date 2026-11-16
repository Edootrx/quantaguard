// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Pluggable post-quantum signature verifier interface.
/// @dev QMS v0.1 (today) uses standard ECDSA accounts — PQ signatures are NOT live.
///      This interface is the v1 integration point: when QMS ships PQ accounts /
///      finality, a concrete ML-DSA (FIPS 204) or SLH-DSA (FIPS 205) verifier can be
///      plugged in without changing QuantaGuard accounts. Until then, guardians act
///      via their ECDSA address, anchored to the PQ commitment stored in the registry.
interface IPQVerifier {
    function verify(bytes32 pqPublicKeyHash, bytes calldata signature, bytes32 messageHash)
        external
        view
        returns (bool);
}

/// @title PQGuardianRegistry
/// @notice Anchors a post-quantum guardian identity to a smart account on QMS.
/// @dev Stores, per account, `keccak256(pqPublicKey)` (or SHA-256 / SHAKE digest cast
///      to bytes32) for an ML-DSA / SLH-DSA keypair held offline by the guardian,
///      plus the guardian's current ECDSA address used on QMS v0.1 testnet.
///      Honest staging: the commitment is an on-chain anchor today; full PQ
///      signature verification activates with the IPQVerifier in QMS v1.
contract PQGuardianRegistry {
    struct GuardianInfo {
        bytes32 pqCommitment; // hash of ML-DSA / SLH-DSA public key
        address guardian; // ECDSA address authorised to propose recovery today
        bool active;
        uint256 updatedAt;
    }

    mapping(address account => GuardianInfo) private _guardians;
    IPQVerifier public pqVerifier; // address(0) until QMS v1 PQ verifier ships
    address public admin;

    event GuardianRegistered(address indexed account, address indexed guardian, bytes32 pqCommitment);
    event GuardianUpdated(address indexed account, address indexed guardian, bytes32 pqCommitment);
    event GuardianRevoked(address indexed account);
    event PQVerifierSet(address indexed verifier);

    error NotAccountOwner();
    error ZeroCommitment();
    error ZeroGuardian();
    error NotAdmin();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /// @notice Register a PQ guardian for the caller's account.
    /// @param pqCommitment bytes32 hash of the guardian's ML-DSA/SLH-DSA public key.
    /// @param guardian ECDSA address that may propose recovery on QMS v0.1.
    function registerGuardian(bytes32 pqCommitment, address guardian) external {
        if (pqCommitment == bytes32(0)) revert ZeroCommitment();
        if (guardian == address(0)) revert ZeroGuardian();
        bool existed = _guardians[msg.sender].active;
        _guardians[msg.sender] = GuardianInfo(pqCommitment, guardian, true, block.timestamp);
        if (existed) emit GuardianUpdated(msg.sender, guardian, pqCommitment);
        else emit GuardianRegistered(msg.sender, guardian, pqCommitment);
    }

    /// @notice Register on behalf of a smart account (account contract calls with its own address as msg.sender in normal flow;
    ///         this overload exists for factory-assisted onboarding where the account authorises the caller).
    /// @dev Only callable by the account itself — enforced by requiring msg.sender == account in the primary path.
    ///      Factory onboarding uses the account's own call, so no privileged registrar is introduced.
    function updateGuardian(bytes32 pqCommitment, address guardian) external {
        if (!_guardians[msg.sender].active) revert NotAccountOwner();
        if (pqCommitment == bytes32(0)) revert ZeroCommitment();
        if (guardian == address(0)) revert ZeroGuardian();
        _guardians[msg.sender].pqCommitment = pqCommitment;
        _guardians[msg.sender].guardian = guardian;
        _guardians[msg.sender].updatedAt = block.timestamp;
        emit GuardianUpdated(msg.sender, guardian, pqCommitment);
    }

    function revokeGuardian() external {
        if (!_guardians[msg.sender].active) revert NotAccountOwner();
        delete _guardians[msg.sender];
        emit GuardianRevoked(msg.sender);
    }

    function setPQVerifier(address verifier) external onlyAdmin {
        pqVerifier = IPQVerifier(verifier);
        emit PQVerifierSet(verifier);
    }

    function getGuardian(address account) external view returns (GuardianInfo memory) {
        return _guardians[account];
    }

    function guardianOf(address account) external view returns (address guardian, bytes32 pqCommitment, bool active) {
        GuardianInfo memory g = _guardians[account];
        return (g.guardian, g.pqCommitment, g.active);
    }

    function isGuardian(address account, address candidate) external view returns (bool) {
        GuardianInfo memory g = _guardians[account];
        return g.active && g.guardian == candidate && g.pqCommitment != bytes32(0);
    }
}
