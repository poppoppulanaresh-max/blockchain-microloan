// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract KYCRegistry {

    address public admin;

    mapping(address => bool) public auditors;

    struct KYCRecord {
        bytes32 dataHash;
        bool verified;
        uint256 timestamp;
        string role;
    }

    mapping(address => KYCRecord) public kycRecords;
    address[] public verifiedUsers;

    event KYCSubmitted(address indexed user, bytes32 dataHash, string role);
    event KYCVerified(address indexed user, bool status);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyVerifier() {
        require(msg.sender == admin || auditors[msg.sender], "Not authorized");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function addAuditor(address auditor) external onlyAdmin {
        auditors[auditor] = true;
    }

    function submitKYC(address user, bytes32 dataHash, string calldata role) external onlyAdmin {
        kycRecords[user] = KYCRecord({
            dataHash: dataHash,
            verified: false,
            timestamp: block.timestamp,
            role: role
        });

        emit KYCSubmitted(user, dataHash, role);
    }

    function verifyKYC(address user, bool status) external onlyVerifier {
        require(kycRecords[user].timestamp > 0, "KYC not submitted");

        kycRecords[user].verified = status;

        if (status) {
            verifiedUsers.push(user);
        }

        emit KYCVerified(user, status);
    }

    function isVerified(address user) external view returns (bool) {
        return kycRecords[user].verified;
    }
}