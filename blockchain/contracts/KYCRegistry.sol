// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title KYCRegistry
 * @dev Stores KYC verification hashes on-chain for MSME borrowers
 * Off-chain data (Aadhaar, GST docs) stored in MySQL; only hash stored here
 */
contract KYCRegistry {
    address public admin;

    struct KYCRecord {
        bytes32 dataHash;      // Hash of KYC documents
        bool    verified;
        uint256 timestamp;
        string  role;          // "borrower" | "lender"
    }

    mapping(address => KYCRecord) public kycRecords;
    address[] public verifiedUsers;

    event KYCSubmitted(address indexed user, bytes32 dataHash, string role);
    event KYCVerified(address indexed user, bool status);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /// @notice Store KYC hash for a user (called by backend after MySQL save)
    function submitKYC(address user, bytes32 dataHash, string calldata role) external onlyAdmin {
        kycRecords[user] = KYCRecord({
            dataHash:  dataHash,
            verified:  false,
            timestamp: block.timestamp,
            role:      role
        });
        emit KYCSubmitted(user, dataHash, role);
    }

    /// @notice Admin verifies the KYC record
    function verifyKYC(address user, bool status) external onlyAdmin {
        require(kycRecords[user].timestamp > 0, "KYC not submitted");
        kycRecords[user].verified = status;
        if (status) verifiedUsers.push(user);
        emit KYCVerified(user, status);
    }

    function isVerified(address user) external view returns (bool) {
        return kycRecords[user].verified;
    }

    function getKYCRecord(address user) external view returns (KYCRecord memory) {
        return kycRecords[user];
    }
}
