# Unbounded Array Returns in View Functions

**Severity**: 🟢 **LOW**  
**Category**: Gas / UX  
**Location**: `getPatientConsents()` - Line 917, `getPatientRequests()` - Line 932

## Description

The view functions `getPatientConsents()` and `getPatientRequests()` return unbounded arrays that could grow indefinitely over time. While these are view functions (not state-changing), they can cause:

1. **High gas costs** for queries if arrays grow very large
2. **RPC provider issues** if arrays exceed response size limits
3. **Poor user experience** when trying to query patients with many consents/requests

## Current Implementation

```solidity
function getPatientConsents(address patient) 
    external 
    view 
    returns (uint256[] memory) 
{
    return patientConsents[patient];
}

function getPatientRequests(address patient) 
    external 
    view 
    returns (uint256[] memory) 
{
    return patientRequests[patient];
}
```

## Impact

### Gas Costs
- **Small arrays (< 100 items)**: Negligible impact
- **Medium arrays (100-1000 items)**: ~50,000-500,000 gas per query
- **Large arrays (> 1000 items)**: Could exceed reasonable query limits

### Practical Impact
- **Low in practice**: Most patients won't have thousands of consents
- **Long-term concern**: Arrays never shrink (revoked consents remain in arrays)
- **RPC limitations**: Some RPC providers limit response sizes

### Example Scenario
A patient who grants 10 consents per month for 5 years would have:
- 10 consents/month × 12 months × 5 years = 600 consent IDs
- Each query would return all 600 IDs, even if many are revoked/inactive

## Code Analysis

### Array Growth Pattern
Arrays only grow, never shrink:
- `patientConsents[patient].push(consentId)` - Line 409, 782, 861
- `patientRequests[patient].push(requestId)` - Line 669
- Revoked consents remain in arrays (marked inactive, but still in array)

### Bounded by User Behavior
- Arrays are bounded by actual user actions
- No way to force unbounded growth through contract calls
- Growth is linear with consent/request creation

## Recommendation

### Option 1: Add Pagination (Recommended for Future)
Implement pagination to limit array sizes returned:

```solidity
function getPatientConsents(
    address patient,
    uint256 offset,
    uint256 limit
) external view returns (uint256[] memory) {
    uint256[] storage allConsents = patientConsents[patient];
    uint256 length = allConsents.length;
    
    if (offset >= length) {
        return new uint256[](0);
    }
    
    uint256 end = offset + limit;
    if (end > length) {
        end = length;
    }
    
    uint256[] memory result = new uint256[](end - offset);
    for (uint256 i = offset; i < end; ) {
        result[i - offset] = allConsents[i];
        unchecked { i++; }
    }
    
    return result;
}

function getPatientConsentsCount(address patient) 
    external 
    view 
    returns (uint256) 
{
    return patientConsents[patient].length;
}
```

### Option 2: Filter Active Consents Only
Add a function that returns only active consents:

```solidity
function getActivePatientConsents(address patient) 
    external 
    view 
    returns (uint256[] memory) 
{
    uint256[] storage allConsents = patientConsents[patient];
    uint256[] memory activeConsents = new uint256[](allConsents.length);
    uint256 activeCount = 0;
    
    for (uint256 i = 0; i < allConsents.length; ) {
        uint256 consentId = allConsents[i];
        if (isBatchConsent[consentId]) {
            BatchConsentRecord memory batch = batchConsentRecords[consentId];
            if (batch.isActive && (batch.expirationTime == 0 || batch.expirationTime >= block.timestamp)) {
                activeConsents[activeCount] = consentId;
                unchecked { activeCount++; }
            }
        } else {
            ConsentRecord memory consent = consentRecords[consentId];
            if (consent.isActive && (consent.expirationTime == 0 || consent.expirationTime >= block.timestamp)) {
                activeConsents[activeCount] = consentId;
                unchecked { activeCount++; }
            }
        }
        unchecked { i++; }
    }
    
    // Resize array to actual active count
    uint256[] memory result = new uint256[](activeCount);
    for (uint256 i = 0; i < activeCount; ) {
        result[i] = activeConsents[i];
        unchecked { i++; }
    }
    
    return result;
}
```

**Note**: This would require an unbounded loop, which we removed for security. Better to use event-based filtering off-chain.

### Option 3: Keep Current Implementation (Acceptable)
- Current implementation is acceptable for MVP
- Document the limitation clearly
- Use event-based queries for large datasets
- Consider pagination in future version

## Current Documentation

The code already acknowledges this limitation:

```solidity
/**
 * @notice Gets all consent IDs for a patient
 * @dev Returns full array of consent IDs. For patients with many consents,
 *      consider implementing pagination in a future version.
 */
```

## Gas Impact

- **Current**: O(n) gas cost where n = array length
- **With pagination**: O(limit) gas cost, bounded by page size
- **Savings**: Significant for large arrays, minimal for small arrays

## Priority

**LOW** - This is a known limitation that's acceptable for the current implementation. The documentation acknowledges it, and event-based queries can be used for large datasets off-chain.

## References

- [Solidity Arrays](https://docs.soliditylang.org/en/latest/types.html#arrays)
- [Ethereum Gas Costs](https://ethereum.org/en/developers/docs/gas/)
- Best practice: Use events for large datasets, on-chain queries for small datasets

