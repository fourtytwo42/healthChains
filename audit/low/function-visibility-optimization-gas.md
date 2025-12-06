# Function Visibility Optimization

## Severity
Low

## Type
Gas

## Location
- File: `backend/contracts/PatientConsentManager.sol`
- Functions: Multiple view functions
- Lines: Various

## Description
Several `public` view functions could be changed to `external` since they are not called internally. The `external` visibility is slightly more gas-efficient because:
1. Function parameters are read directly from calldata (cheaper than copying to memory)
2. No internal call overhead
3. Slightly smaller bytecode

Functions that could be optimized:
- `getPatientConsents()` (line 1061)
- `getPatientRequests()` (line 1076)
- `getConsentRecord()` (line 1091)
- `getBatchConsentRecord()` (line 1112)
- `getAccessRequest()` (line 1132)
- `getExpiredConsents()` (line 1148)
- `isConsentExpired()` (line 964)

## Impact
- **Minor Gas Savings**: ~5-10 gas per call (negligible but best practice)
- **Code Quality**: Follows Solidity best practices
- **No Functional Impact**: Behavior remains identical

## Recommendation
Change `public` to `external` for view functions that are not called internally:

```solidity
// Before
function getPatientConsents(address patient) 
    public  // ❌ Should be external
    view 
    returns (uint256[] memory) 
{
    return patientConsents[patient];
}

// After
function getPatientConsents(address patient) 
    external  // ✅ More gas-efficient
    view 
    returns (uint256[] memory) 
{
    return patientConsents[patient];
}
```

## Code Example

### Before
```solidity
function getPatientConsents(address patient) 
    public 
    view 
    returns (uint256[] memory) 
{
    return patientConsents[patient];
}

function getAccessRequest(uint256 requestId) 
    public 
    view 
    returns (AccessRequest memory) 
{
    if (!_requestExists[requestId]) revert RequestNotFound();
    return accessRequests[requestId];
}
```

### After
```solidity
function getPatientConsents(address patient) 
    external  // ✅ Changed to external
    view 
    returns (uint256[] memory) 
{
    return patientConsents[patient];
}

function getAccessRequest(uint256 requestId) 
    external  // ✅ Changed to external
    view 
    returns (AccessRequest memory) 
{
    if (!_requestExists[requestId]) revert RequestNotFound();
    return accessRequests[requestId];
}
```

## Note
The `hasActiveConsent()` function should remain `public` if it might be called internally in the future, or if there's a design reason to allow internal calls. However, if it's only called externally, it should also be `external`.

## References
- [Solidity Documentation: Function Visibility](https://docs.soliditylang.org/en/latest/contracts.html#function-visibility)
- [Consensys Best Practices: Function Visibility](https://consensys.github.io/smart-contract-best-practices/development-recommendations/solidity-specific/external-vs-public-best-practices/)

