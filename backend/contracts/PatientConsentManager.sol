// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PatientConsentManager
 * @dev Smart contract for managing patient consent and data access permissions
 * This contract implements a decentralized consent management system for healthcare data
 */
contract PatientConsentManager {
    // Struct to represent a consent record
    struct ConsentRecord {
        address patientAddress;
        address providerAddress;
        string dataType; // e.g., "medical_records", "diagnostic_data", "genetic_data"
        uint256 timestamp;
        bool isActive;
        uint256 expirationTime; // 0 means no expiration
        string purpose; // e.g., "treatment", "research", "analytics"
    }

    // Struct to represent a data access request
    struct AccessRequest {
        address requester;
        address patientAddress;
        string dataType;
        string purpose;
        uint256 timestamp;
        bool isApproved;
        bool isProcessed;
    }

    // Mapping from consent ID to consent record
    mapping(uint256 => ConsentRecord) public consentRecords;
    
    // Mapping from patient address to array of consent IDs
    mapping(address => uint256[]) public patientConsents;
    
    // Mapping from provider address to array of consent IDs
    mapping(address => uint256[]) public providerConsents;
    
    // Mapping from request ID to access request
    mapping(uint256 => AccessRequest) public accessRequests;
    
    // Mapping from patient address to array of request IDs
    mapping(address => uint256[]) public patientRequests;

    // Counters
    uint256 public consentCounter;
    uint256 public requestCounter;

    // Events
    event ConsentGranted(
        uint256 indexed consentId,
        address indexed patient,
        address indexed provider,
        string dataType,
        uint256 timestamp
    );

    event ConsentRevoked(
        uint256 indexed consentId,
        address indexed patient,
        uint256 timestamp
    );

    event AccessRequested(
        uint256 indexed requestId,
        address indexed requester,
        address indexed patient,
        string dataType,
        uint256 timestamp
    );

    event AccessApproved(
        uint256 indexed requestId,
        address indexed patient,
        uint256 timestamp
    );

    event AccessDenied(
        uint256 indexed requestId,
        address indexed patient,
        uint256 timestamp
    );

    /**
     * @dev Grant consent for data access
     * @param provider The address of the healthcare provider
     * @param dataType The type of data being consented to
     * @param expirationTime Unix timestamp when consent expires (0 for no expiration)
     * @param purpose The purpose for which data will be used
     */
    function grantConsent(
        address provider,
        string memory dataType,
        uint256 expirationTime,
        string memory purpose
    ) public returns (uint256) {
        require(provider != address(0), "Invalid provider address");
        require(provider != msg.sender, "Cannot grant consent to self");
        require(bytes(dataType).length > 0, "DataType cannot be empty");
        require(bytes(purpose).length > 0, "Purpose cannot be empty");

        uint256 consentId = consentCounter++;
        
        consentRecords[consentId] = ConsentRecord({
            patientAddress: msg.sender,
            providerAddress: provider,
            dataType: dataType,
            timestamp: block.timestamp,
            isActive: true,
            expirationTime: expirationTime,
            purpose: purpose
        });

        patientConsents[msg.sender].push(consentId);
        providerConsents[provider].push(consentId);

        emit ConsentGranted(
            consentId,
            msg.sender,
            provider,
            dataType,
            block.timestamp
        );

        return consentId;
    }

    /**
     * @dev Revoke a previously granted consent
     * @param consentId The ID of the consent to revoke
     */
    function revokeConsent(uint256 consentId) public {
        ConsentRecord storage consent = consentRecords[consentId];
        require(consent.patientAddress == msg.sender, "Only patient can revoke consent");
        require(consent.isActive, "Consent is already inactive");

        consent.isActive = false;

        emit ConsentRevoked(consentId, msg.sender, block.timestamp);
    }

    /**
     * @dev Request access to patient data
     * @param patient The address of the patient
     * @param dataType The type of data being requested
     * @param purpose The purpose for which data is needed
     */
    function requestAccess(
        address patient,
        string memory dataType,
        string memory purpose
    ) public returns (uint256) {
        require(patient != address(0), "Invalid patient address");
        require(patient != msg.sender, "Cannot request access from self");
        require(bytes(dataType).length > 0, "DataType cannot be empty");
        require(bytes(purpose).length > 0, "Purpose cannot be empty");

        uint256 requestId = requestCounter++;
        
        accessRequests[requestId] = AccessRequest({
            requester: msg.sender,
            patientAddress: patient,
            dataType: dataType,
            purpose: purpose,
            timestamp: block.timestamp,
            isApproved: false,
            isProcessed: false
        });

        patientRequests[patient].push(requestId);

        emit AccessRequested(
            requestId,
            msg.sender,
            patient,
            dataType,
            block.timestamp
        );

        return requestId;
    }

    /**
     * @dev Approve or deny an access request
     * @param requestId The ID of the access request
     * @param approved Whether to approve the request
     */
    function respondToAccessRequest(
        uint256 requestId,
        bool approved
    ) public {
        AccessRequest storage request = accessRequests[requestId];
        require(!request.isProcessed, "Request already processed");
        require(request.patientAddress == msg.sender, "Only patient can respond to request");

        request.isProcessed = true;
        request.isApproved = approved;

        if (approved) {
            emit AccessApproved(requestId, msg.sender, block.timestamp);
        } else {
            emit AccessDenied(requestId, msg.sender, block.timestamp);
        }
    }

    /**
     * @dev Check if a provider has active consent for specific data type
     * @param patient The address of the patient
     * @param provider The address of the provider
     * @param dataType The type of data to check
     * @return hasConsent Whether active consent exists
     * @return consentId The ID of the consent if found
     */
    function hasActiveConsent(
        address patient,
        address provider,
        string memory dataType
    ) public view returns (bool hasConsent, uint256 consentId) {
        uint256[] memory consents = patientConsents[patient];
        
        for (uint256 i = 0; i < consents.length; i++) {
            ConsentRecord memory consent = consentRecords[consents[i]];
            if (
                consent.providerAddress == provider &&
                keccak256(bytes(consent.dataType)) == keccak256(bytes(dataType)) &&
                consent.isActive &&
                (consent.expirationTime == 0 || consent.expirationTime > block.timestamp)
            ) {
                return (true, consents[i]);
            }
        }
        
        return (false, 0);
    }

    /**
     * @dev Get all consent IDs for a patient
     * @param patient The address of the patient
     * @return Array of consent IDs
     */
    function getPatientConsents(address patient) public view returns (uint256[] memory) {
        return patientConsents[patient];
    }

    /**
     * @dev Get all request IDs for a patient
     * @param patient The address of the patient
     * @return Array of request IDs
     */
    function getPatientRequests(address patient) public view returns (uint256[] memory) {
        return patientRequests[patient];
    }

    /**
     * @dev Get consent record details
     * @param consentId The ID of the consent
     * @return ConsentRecord The consent record
     */
    function getConsentRecord(uint256 consentId) public view returns (ConsentRecord memory) {
        return consentRecords[consentId];
    }

    /**
     * @dev Get access request details
     * @param requestId The ID of the request
     * @return AccessRequest The access request
     */
    function getAccessRequest(uint256 requestId) public view returns (AccessRequest memory) {
        return accessRequests[requestId];
    }
}

