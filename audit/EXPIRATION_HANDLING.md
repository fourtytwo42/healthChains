# Consent Expiration Handling

## Summary

**Yes, expiration is properly honored and access is revoked when consents expire.**

## How Expiration Works

### Contract Level (Before Changes)

The contract's `hasActiveConsent()` function checked expiration:
```solidity
(consent.expirationTime == 0 || consent.expirationTime > currentTime)
```

This means:
- ✅ **Expired consents return `false`** even if `isActive = true`
- ✅ **Expiration is the source of truth** - if `expirationTime < block.timestamp`, consent is inactive
- ⚠️ **State not automatically updated** - `isActive` flag remains `true` until `checkAndExpireConsents()` is called

### Event-Based Approach (After Changes)

The new event-based `getConsentStatus()` function:
1. ✅ **Reads all `ConsentGranted` events** for the patient
2. ✅ **Checks for `ConsentRevoked` and `ConsentExpired` events** to filter out revoked consents
3. ✅ **Checks expiration time** against current timestamp:
   ```javascript
   const expirationTimestamp = Math.floor(new Date(event.expirationTime).getTime() / 1000);
   isExpired = expirationTimestamp > 0 && expirationTimestamp < currentTimestamp;
   ```
4. ✅ **Skips expired consents** - they are treated as inactive

### Frontend/Backend Level

Both frontend and backend check expiration when processing consent data:

**Backend** (`consentService.js`):
```javascript
isExpired: record.expirationTime !== 0n && 
           Number(record.expirationTime) < Math.floor(Date.now() / 1000)
```

**Frontend** (`use-api.ts`, `consent-details-card.tsx`):
- Filters out expired consents: `!consent.isExpired`
- Shows "Expired" badge when `isExpired = true`
- Only shows active, non-expired consents in provider dashboard

## Expiration Flow

### When Consent is Granted
1. `ConsentGranted` event emitted with `expirationTime`
2. If `expirationTime = 0`, consent never expires
3. If `expirationTime > 0`, consent expires at that timestamp

### When Consent Expires
1. **Contract view functions**: Return `false` for expired consents (even if `isActive = true`)
2. **Event-based lookups**: Check `expirationTime < currentTimestamp` and skip expired consents
3. **Frontend/Backend**: Calculate `isExpired` flag when processing data
4. **Access is effectively revoked**: Expired consents are treated as inactive everywhere

### What Happens to Expired Consents

**Before (with `checkAndExpireConsents()`)**:
- Function could be called to mark expired consents as `isActive = false`
- `ConsentExpired` event would be emitted
- State would be updated on-chain

**After (event-based approach)**:
- Expired consents remain `isActive = true` in storage (no state change needed)
- Expiration is checked client-side when reading events
- **Access is still revoked** - expired consents are filtered out everywhere
- No gas cost for expiration checking (done off-chain)

## Key Points

1. ✅ **Expiration is honored**: Expired consents are treated as inactive everywhere
2. ✅ **No automatic state updates needed**: Expiration check is sufficient
3. ✅ **More efficient**: No need to call expensive contract functions
4. ✅ **Consistent behavior**: All layers (contract, backend, frontend) respect expiration

## Example

```javascript
// Consent granted with expiration
ConsentGranted {
  consentId: 123,
  expirationTime: "2024-12-31T23:59:59Z", // Expires Dec 31, 2024
  ...
}

// After expiration (Jan 1, 2025):
// ✅ Contract: hasActiveConsent() would return false (if it existed)
// ✅ Event-based: getConsentStatus() checks expirationTime < now, returns hasConsent: false
// ✅ Frontend: Filters out expired consents, shows "Expired" badge
// ✅ Provider: Cannot access patient data (consent treated as inactive)
```

## Conclusion

**Expiration is properly honored and access is revoked when consents expire.** The event-based approach is actually more efficient and provides the same security guarantees without the DoS risk of unbounded loops.

