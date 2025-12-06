# Code Duplication in revokeConsent Function

## Severity
Low

## Type
Code Quality

## Location
- File: `backend/contracts/PatientConsentManager.sol`
- Function: `revokeConsent()`
- Lines: 523-562

## Description
The `revokeConsent()` function has significant code duplication. The same validation and revocation logic is repeated for both batch consents and single consents:

```solidity
if (isBatchConsent[consentId]) {
    // Handle batch consent
    BatchConsentRecord storage batchConsent = batchConsentRecords[consentId];
    if (batchConsent.patientAddress == address(0)) revert ConsentNotFound();
    if (batchConsent.patientAddress != msg.sender) revert UnauthorizedRevocation();
    if (!batchConsent.isActive) revert ConsentAlreadyInactive();
    batchConsent.isActive = false;
    emit ConsentRevoked(consentId, msg.sender, uint128(block.timestamp));
} else {
    // Handle single consent - SAME LOGIC REPEATED
    ConsentRecord storage consent = consentRecords[consentId];
    if (consent.patientAddress == address(0)) revert ConsentNotFound();
    if (consent.patientAddress != msg.sender) revert UnauthorizedRevocation();
    if (!consent.isActive) revert ConsentAlreadyInactive();
    consent.isActive = false;
    emit ConsentRevoked(consentId, msg.sender, uint128(block.timestamp));
}
```

## Impact
- **Code Maintainability**: Changes to revocation logic must be made in two places
- **Bug Risk**: Higher chance of introducing bugs when updating logic
- **Code Size**: Increases contract bytecode size
- **No Security Impact**: Function is secure, just not DRY (Don't Repeat Yourself)

## Recommendation
Extract common logic to an internal helper function:

```solidity
function revokeConsent(uint256 consentId) external nonReentrant {
    // Determine consent type and get patient address
    address patient;
    bool isActive;
    
    if (isBatchConsent[consentId]) {
        BatchConsentRecord storage batchConsent = batchConsentRecords[consentId];
        if (batchConsent.patientAddress == address(0)) revert ConsentNotFound();
        patient = batchConsent.patientAddress;
        isActive = batchConsent.isActive;
        
        // Validate and revoke
        _validateAndRevoke(consentId, patient, isActive, true);
        batchConsent.isActive = false;
    } else {
        ConsentRecord storage consent = consentRecords[consentId];
        if (consent.patientAddress == address(0)) revert ConsentNotFound();
        patient = consent.patientAddress;
        isActive = consent.isActive;
        
        // Validate and revoke
        _validateAndRevoke(consentId, patient, isActive, false);
        consent.isActive = false;
    }
    
    emit ConsentRevoked(consentId, msg.sender, uint128(block.timestamp));
}

function _validateAndRevoke(
    uint256 consentId,
    address patient,
    bool isActive,
    bool isBatch
) internal {
    if (patient != msg.sender) revert UnauthorizedRevocation();
    if (!isActive) revert ConsentAlreadyInactive();
    // isActive is set to false in calling function
}
```

**However**, the current implementation is acceptable because:
1. The logic is simple and unlikely to change
2. Extracting to a helper might not save much code
3. The current approach is more explicit and easier to understand

## Code Example

### Current (Acceptable)
```solidity
function revokeConsent(uint256 consentId) external nonReentrant {
    if (isBatchConsent[consentId]) {
        BatchConsentRecord storage batchConsent = batchConsentRecords[consentId];
        if (batchConsent.patientAddress == address(0)) revert ConsentNotFound();
        if (batchConsent.patientAddress != msg.sender) revert UnauthorizedRevocation();
        if (!batchConsent.isActive) revert ConsentAlreadyInactive();
        batchConsent.isActive = false;
        emit ConsentRevoked(consentId, msg.sender, uint128(block.timestamp));
    } else {
        ConsentRecord storage consent = consentRecords[consentId];
        if (consent.patientAddress == address(0)) revert ConsentNotFound();
        if (consent.patientAddress != msg.sender) revert UnauthorizedRevocation();
        if (!consent.isActive) revert ConsentAlreadyInactive();
        consent.isActive = false;
        emit ConsentRevoked(consentId, msg.sender, uint128(block.timestamp));
    }
}
```

### Refactored (Optional)
```solidity
function revokeConsent(uint256 consentId) external nonReentrant {
    address patient;
    bool active;
    
    if (isBatchConsent[consentId]) {
        BatchConsentRecord storage batchConsent = batchConsentRecords[consentId];
        if (batchConsent.patientAddress == address(0)) revert ConsentNotFound();
        patient = batchConsent.patientAddress;
        active = batchConsent.isActive;
        if (patient != msg.sender) revert UnauthorizedRevocation();
        if (!active) revert ConsentAlreadyInactive();
        batchConsent.isActive = false;
    } else {
        ConsentRecord storage consent = consentRecords[consentId];
        if (consent.patientAddress == address(0)) revert ConsentNotFound();
        patient = consent.patientAddress;
        active = consent.isActive;
        if (patient != msg.sender) revert UnauthorizedRevocation();
        if (!active) revert ConsentAlreadyInactive();
        consent.isActive = false;
    }
    
    emit ConsentRevoked(consentId, msg.sender, uint128(block.timestamp));
}
```

## Recommendation
**Keep current implementation** - The code duplication is minimal and the current approach is clear and maintainable. Refactoring would add complexity without significant benefit.

## References
- [DRY Principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- [Solidity Best Practices: Code Organization](https://docs.soliditylang.org/en/latest/style-guide.html)

