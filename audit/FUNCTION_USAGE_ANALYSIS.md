# Function Usage Analysis - Unbounded Loop Functions

## Summary

All three functions with unbounded loops are **`external`** (not called internally in the contract). Here's their usage status:

| Function | Visibility | Called Internally? | Called from Backend? | Called from Frontend? | Can Be Avoided? |
|----------|-----------|-------------------|---------------------|----------------------|-----------------|
| `hasActiveConsent()` | `external view` | ❌ No | ✅ Yes (line 176) | ❌ No | ✅ Yes - Use events |
| `checkAndExpireConsents()` | `external` | ❌ No | ⚠️ Stub only | ❌ No | ✅ Yes - Not needed |
| `getExpiredConsents()` | `external view` | ❌ No | ❌ No | ❌ No | ✅ Yes - Not needed |

## Detailed Analysis

### 1. `hasActiveConsent()` - **USED, BUT REPLACEABLE**

**Location**: `backend/services/consentService.js:176`

**Current Usage**:
```javascript
// Backend service calls this function
result = await contract.hasActiveConsent(normalizedPatient, normalizedProvider, dataType);
```

**Can Be Replaced**: ✅ **YES**

**Replacement Strategy**:
- The frontend already reads events via `usePatientConsentHistory()` and `useProviderConsentHistory()`
- Instead of calling `hasActiveConsent()`, you can:
  1. Read all `ConsentGranted` events for the patient
  2. Filter by provider and dataType
  3. Check if consent is active and not expired (client-side)
  4. Use `ConsentRevoked` and `ConsentExpired` events to track status

**Events Available**:
- `ConsentGranted` - Contains: `consentId`, `patient`, `provider`, `dataTypeHash`, `purposeHash`, `expirationTime`, `timestamp`
- `ConsentRevoked` - Contains: `consentId`, `patient`, `timestamp`
- `ConsentExpired` - Contains: `consentId`, `patient`, `timestamp`

**Recommendation**: Replace `hasActiveConsent()` calls with event-based lookups. The frontend already has the infrastructure for this!

---

### 2. `checkAndExpireConsents()` - **NOT USED (STUB ONLY)**

**Location**: `backend/services/consentService.js:618`

**Current Usage**:
```javascript
// Backend has a stub that just returns 0
async checkAndExpireConsents(patientAddress) {
  console.warn('checkAndExpireConsents requires write access - not implemented in read-only mode');
  return 0;
}
```

**Can Be Replaced**: ✅ **YES - Already Not Used**

**Replacement Strategy**:
- This function is a state-changing function (requires write access)
- It's not actually being called
- Expiration checking can be done client-side by:
  1. Reading `ConsentGranted` events with `expirationTime`
  2. Comparing `expirationTime` with current block timestamp
  3. Filtering out expired consents client-side

**Recommendation**: Keep the stub or remove it entirely. No changes needed - it's already not being used.

---

### 3. `getExpiredConsents()` - **NOT USED**

**Location**: No usage found in codebase

**Can Be Replaced**: ✅ **YES - Not Used**

**Replacement Strategy**:
- This function is not called anywhere
- Expired consents can be determined client-side by:
  1. Reading all `ConsentGranted` events
  2. Filtering by `expirationTime < block.timestamp` and `isActive = true`
  3. Or using `ConsentExpired` events if they've been marked

**Recommendation**: This function is not needed if you're using events. No changes needed.

---

## Frontend Event Usage (Already Implemented!)

The frontend is **already using events** to populate data:

### `usePatientConsentHistory()` (frontend/hooks/use-api.ts:1260)
```typescript
// Fetches consent events and access request events
const [consentEventsResponse, requestEventsResponse] = await Promise.all([
  apiClient.getConsentEvents(normalizedAddress),
  apiClient.getAccessRequestEvents(normalizedAddress),
]);
```

### `useProviderConsentHistory()` (frontend/hooks/use-api.ts:1120)
```typescript
// Fetches all consent events and access request events
const [consentEventsResponse, requestEventsResponse] = await Promise.all([
  apiClient.getConsentEvents(), // Get all events, filter by provider client-side
  apiClient.getAccessRequestEvents(), // Get all events, filter by requester client-side
]);
```

**This is the correct approach!** ✅

---

## Recommendations

### Immediate Actions

1. **Replace `hasActiveConsent()` backend call**:
   - Remove or deprecate the `getConsentStatus()` function in `consentService.js`
   - Use event-based lookups instead
   - The frontend already has the infrastructure for this

2. **Remove unused functions** (optional):
   - `checkAndExpireConsents()` - Already a stub, can be removed
   - `getExpiredConsents()` - Not used, can be removed

3. **Update backend API** (if needed):
   - If `getConsentStatus()` endpoint is used, update it to use events
   - Or deprecate it and document the event-based approach

### Event-Based Consent Checking

Instead of calling `hasActiveConsent()`, use this pattern:

```typescript
// 1. Get all ConsentGranted events for patient
const consentEvents = await apiClient.getConsentEvents(patientAddress);

// 2. Filter by provider and dataType
const matchingConsents = consentEvents.filter(event => 
  event.provider === providerAddress &&
  event.dataTypeHash === keccak256(dataType)
);

// 3. Get all ConsentRevoked and ConsentExpired events
const revokedEvents = await apiClient.getConsentEvents(patientAddress);
const revokedIds = revokedEvents
  .filter(e => e.type === 'ConsentRevoked' || e.type === 'ConsentExpired')
  .map(e => e.consentId);

// 4. Filter out revoked/expired consents
const activeConsents = matchingConsents.filter(consent => 
  !revokedIds.includes(consent.consentId) &&
  (consent.expirationTime === 0 || consent.expirationTime > Date.now() / 1000)
);

// 5. Return the first active consent (or all of them)
return activeConsents.length > 0;
```

---

## Security Benefits

By avoiding these functions:
- ✅ **No DoS risk** - No unbounded loops called from frontend
- ✅ **Better performance** - Event queries are more efficient
- ✅ **Off-chain filtering** - Can filter/process data client-side
- ✅ **No gas costs** - Event queries are free (read-only)

---

## Conclusion

**Good news**: Your frontend is already using events! 🎉

**Action needed**: 
- Replace the one `hasActiveConsent()` call in the backend service
- The other two functions are already not being used

**Result**: You can completely avoid calling any of the unbounded loop functions, eliminating the DoS risk entirely!

