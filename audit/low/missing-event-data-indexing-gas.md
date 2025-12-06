# Missing Indexed Parameters in Events

## Severity
Low

## Type
Gas / Code Quality

## Location
- File: `backend/contracts/PatientConsentManager.sol`
- Events: `ConsentBatchGranted`, `ConsentExpired`
- Lines: 235-239, 291-295

## Description
Some events are missing `indexed` parameters that would be useful for filtering. While this doesn't affect security, it impacts gas efficiency and queryability:

1. **`ConsentBatchGranted`**: Missing `indexed` on `consentIds` array (though arrays can't be indexed, individual IDs could be emitted separately)
2. **`ConsentExpired`**: All parameters are indexed, which is good

Actually, looking more closely:
- `ConsentBatchGranted` has `address indexed patient` and `uint256[] consentIds` (arrays can't be indexed)
- `ConsentExpired` has `uint256 indexed consentId` and `address indexed patient` - this is good

The issue is that `ConsentBatchGranted` emits an array of consent IDs, but for efficient filtering, we might want individual events or a different structure.

## Impact
- **Query Efficiency**: Filtering by consent ID in batch events requires parsing the array
- **Gas Cost**: Minimal impact (events are relatively cheap)
- **Code Quality**: Could be more query-friendly

## Recommendation
For `ConsentBatchGranted`, consider emitting individual `ConsentGranted` events for each consent ID in the batch, or keep the current structure if batch queries are more important.

**Current approach is acceptable** - emitting a batch event is more gas-efficient than multiple individual events. The trade-off is query complexity.

## Code Example

### Current (Acceptable)
```solidity
event ConsentBatchGranted(
    address indexed patient,
    uint256[] consentIds,  // Array cannot be indexed
    uint128 timestamp
);
```

### Alternative (If Individual Queries Are Important)
```solidity
// Emit individual events for each consent (more gas, but better queryability)
for (uint256 i = 0; i < consentIds.length; ) {
    emit ConsentGranted(
        consentIds[i],
        msg.sender,
        provider,
        dataTypeHash,
        expirationTime,
        purposeHash,
        uint128(block.timestamp)
    );
    unchecked { i++; }
}
```

**Recommendation**: Keep current approach - batch events are more gas-efficient and the frontend can parse the array.

## References
- [Solidity Events Documentation](https://docs.soliditylang.org/en/latest/contracts.html#events)
- [Event Indexing Best Practices](https://consensys.github.io/smart-contract-best-practices/development-recommendations/solidity-specific/events/)

