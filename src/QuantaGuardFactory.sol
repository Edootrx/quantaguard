// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {QuantaGuardAccount} from "./QuantaGuardAccount.sol";

/// @title QuantaGuardFactory
/// @notice CREATE2 factory for QuantaGuard accounts — predictable addresses,
///         counterfactual deployment (account address known before deployment,
///         the ERC-4337 onboarding pattern).
contract QuantaGuardFactory {
    address public immutable registry;
    uint256 public constant DEFAULT_RECOVERY_DELAY = 48 hours;

    event AccountCreated(address indexed account, address indexed owner, bytes32 salt);

    constructor(address _registry) {
        registry = _registry;
    }

    function getAddress(address owner_, bytes32 salt) public view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(QuantaGuardAccount).creationCode,
            abi.encode(owner_, registry, DEFAULT_RECOVERY_DELAY)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        return address(uint160(uint256(hash)));
    }

    function createAccount(address owner_, bytes32 salt) public returns (address account) {
        address predicted = getAddress(owner_, salt);
        if (predicted.code.length > 0) return predicted;
        QuantaGuardAccount acc = new QuantaGuardAccount{salt: salt}(
            owner_, registry, DEFAULT_RECOVERY_DELAY
        );
        account = address(acc);
        emit AccountCreated(account, owner_, salt);
    }
}
