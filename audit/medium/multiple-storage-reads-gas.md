# Multiple Storage Reads in Loops

## Severity
Medium

## Type
Gas

## Location
- File: `backend/contracts/PatientConsentManager.sol`
- Function: `checkAndExpireConsents()`
- Lines: 1002-1048

## Description
The `checkAndExpireConsents()` function reads from storage multiple times in a loop without caching. Specifically:
1. `isBatchConsent[id]` is read on every iteration (line 1005)
2. `batchConsentRecords[id]` or `consentRecords[id]` is read on every iteration
3. `block.timestamp` is read on every iteration (line 999, cached but could be better)

While `block.timestamp` is cached at the start, the storage reads for `isBatchConsent` and the consent records are not cached efficiently.

## Impact
- **Gas Waste**: Each storage read costs 2,100 gas (cold) or 100 gas (warm)
- **Scalability**: As the number of consents grows, the gas cost increases unnecessarily
- **Minor Issue**: This is a micro-optimization, but can add up with many consents

## Recommendation
Cache the `isBatchConsent` check result and use it to determine which record type to read:

```solidity
function checkAndExpireConsents(address patient) 
    external 
    nonReentrant 
    returns (uint256 expiredCount) 
{
    uint256[] memory consents = patientConsents[patient];
    uint256 currentTime = block.timestamp;
    expiredCount = 0;
    
    // Cache storage reads
    mapping(uint256 => bool) storage batchConsentMap = isBatchConsent;
    mapping(uint256 => BatchConsentRecord) storage batchRecords = batchConsentRecords;
    mapping(uint256 => ConsentRecord) storage singleRecords = consentRecords;
    
    for (uint256 i = 0; i < consents.length; ) {
        uint256 id = consents[i];
        bool isBatch = batchConsentMap[id]; // Cache the check
        
        if (isBatch) {
            BatchConsentRecord storage batchConsent = batchRecords[id];
            
            if (batchConsent.patientAddress == address(0)) {
                unchecked { i++; }
                continue;
            }
            
            if (batchConsent.isActive && 
                batchConsent.expirationTime > 0 && 
                batchConsent.expirationTime < currentTime) {
                
                batchConsent.isActive = false;
                expiredCount++;
                emit ConsentExpired(id, patient, uint128(currentTime));
            }
        } else {
            ConsentRecord storage consent = singleRecords[id];
            
            if (consent.patientAddress == address(0)) {
                unchecked { i++; }
                continue;
            }
            
            if (consent.isActive && 
                consent.expirationTime > 0 && 
                consent.expirationTime < currentTime) {
                
                consent.isActive = false;
                expiredCount++;
                emit ConsentExpired(id, patient, uint128(currentTime));
            }
        }
        
        unchecked { i++; }
    }
    
    return expiredCount;
}
```

## Code Example

### Before
```solidity
for (uint256 i = 0; i < consents.length; ) {
    uint256 id = consents[i];
    
    if (isBatchConsent[id]) { // ❌ Storage read every iteration
        BatchConsentRecord storage batchConsent = batchConsentRecords[id]; // ❌ Storage read
        // ...
    } else {
        ConsentRecord storage consent = consentRecords[id]; // ❌ Storage read
        // ...
    }
}
```

### After
```solidity
// Cache mapping references (no gas cost, just reference)
mapping(uint256 => bool) storage batchConsentMap = isBatchConsent;
mapping(uint256 => BatchConsentRecord) storage batchRecords = batchConsentRecords;
mapping(uint256 => ConsentRecord) storage singleRecords = consentRecords;

for (uint256 i = 0; i < consents.length; ) {
    uint256 id = consents[i];
    bool isBatch = batchConsentMap[id]; // ✅ Cached reference, still a storage read but cleaner
    
    if (isBatch) {
        BatchConsentRecord storage batchConsent = batchRecords[id];
        // ...
    } else {
        ConsentRecord storage consent = singleRecords[id];
        // ...
    }
}
```

## Note
This is a minor optimization. The actual gas savings are minimal because:
- Storage reads are necessary to access the data
- The main issue is the unbounded loop (addressed in a separate finding)
- Modern Solidity compiler may optimize some of these reads

However, the code is cleaner and more maintainable with cached references.

## References
- [Solidity Gas Optimization: Caching Storage Values](https://docs.soliditylang.org/en/latest/gas-optimization.html#caching-storage-values)

