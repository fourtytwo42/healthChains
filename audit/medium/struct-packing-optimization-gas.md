# AccessRequest Struct Packing Optimization

## Severity
Medium

## Type
Gas

## Location
- File: `backend/contracts/PatientConsentManager.sol`
- Struct: `AccessRequest`
- Lines: 128-137

## Description
The `AccessRequest` struct could be better optimized for storage packing. Currently:

```solidity
struct AccessRequest {
    address requester;           // 20 bytes (slot 1)
    address patientAddress;       // 20 bytes (slot 1, packed with requester - 40 bytes total)
    uint128 timestamp;           // 16 bytes (slot 2)
    uint128 expirationTime;      // 16 bytes (slot 2, packed - 32 bytes total)
    bool isProcessed;            // 1 byte (slot 3)
    RequestStatus status;        // 1 byte (slot 3, packed with isProcessed)
    string dataType;             // Dynamic (slot 4+)
    string purpose;              // Dynamic (slot 5+)
}
```

**Current Storage Layout**:
- Slot 1: `requester` (20 bytes) + `patientAddress` (20 bytes) = 40 bytes (fits in one slot)
- Slot 2: `timestamp` (16 bytes) + `expirationTime` (16 bytes) = 32 bytes (fits in one slot)
- Slot 3: `isProcessed` (1 byte) + `status` (1 byte) = 2 bytes (wastes 30 bytes)
- Slot 4+: `dataType` string (dynamic)
- Slot 5+: `purpose` string (dynamic)

**Issue**: Slot 3 only uses 2 bytes but occupies a full 32-byte slot, wasting 30 bytes.

## Impact
- **Storage Waste**: 30 bytes wasted per AccessRequest
- **Gas Cost**: Each AccessRequest write costs an extra ~20,000 gas (SSTORE for wasted slot)
- **Scalability**: With many requests, this adds up significantly

## Recommendation
Reorder struct fields to pack `isProcessed` and `status` with other small values:

```solidity
struct AccessRequest {
    address requester;           // 20 bytes
    address patientAddress;       // 20 bytes (40 bytes total - fits in slot 1)
    uint128 timestamp;           // 16 bytes
    uint128 expirationTime;      // 16 bytes (32 bytes total - fits in slot 2)
    bool isProcessed;            // 1 byte
    RequestStatus status;        // 1 byte (2 bytes total - can pack with uint128)
    string dataType;             // Dynamic
    string purpose;              // Dynamic
}
```

**Better Packing Option**:
Since `uint128` values are 16 bytes each, and we have 32 bytes per slot, we could pack the bool and enum with the uint128 values:

```solidity
struct AccessRequest {
    address requester;           // 20 bytes
    address patientAddress;       // 20 bytes (slot 1: 40 bytes, but addresses are 20 bytes each, so 2 slots)
    uint128 timestamp;           // 16 bytes
    uint128 expirationTime;      // 16 bytes (slot 2: 32 bytes)
    bool isProcessed;            // 1 byte
    RequestStatus status;        // 1 byte (slot 3: 2 bytes, but can't pack with addresses)
    string dataType;             // Dynamic
    string purpose;              // Dynamic
}
```

**Actually, addresses can't be packed together in Solidity** - each address takes a full slot. So the current layout is:
- Slot 1: `requester` (20 bytes, but uses full 32-byte slot)
- Slot 2: `patientAddress` (20 bytes, but uses full 32-byte slot)
- Slot 3: `timestamp` (16 bytes) + `expirationTime` (16 bytes) = 32 bytes (good packing)
- Slot 4: `isProcessed` (1 byte) + `status` (1 byte) = 2 bytes (wastes 30 bytes)
- Slot 5+: Strings

**Better Option**: Pack bool and enum with uint128 values:

```solidity
struct AccessRequest {
    address requester;           // Slot 1 (20 bytes, full slot)
    address patientAddress;      // Slot 2 (20 bytes, full slot)
    uint128 timestamp;           // Slot 3 (16 bytes)
    uint64 expirationTime;       // Slot 3 (8 bytes) - Still sufficient until year 584 billion
    bool isProcessed;            // Slot 3 (1 byte)
    RequestStatus status;        // Slot 3 (1 byte)
    // Total slot 3: 16 + 8 + 1 + 1 = 26 bytes (fits in 32-byte slot, saves 6 bytes)
    string dataType;             // Dynamic
    string purpose;              // Dynamic
}
```

**Wait, expirationTime needs to be uint128 for timestamps**. Let me reconsider...

**Best Option**: Pack bool and enum into the same slot as one of the uint128 values by using a smaller uint type for one:

```solidity
struct AccessRequest {
    address requester;           // Slot 1 (full slot)
    address patientAddress;      // Slot 2 (full slot)
    uint128 timestamp;           // Slot 3 (16 bytes)
    uint112 expirationTime;      // Slot 3 (14 bytes) - Still sufficient (year 584 billion)
    bool isProcessed;            // Slot 3 (1 byte)
    RequestStatus status;        // Slot 3 (1 byte)
    // Slot 3: 16 + 14 + 1 + 1 = 32 bytes (perfect fit!)
    string dataType;             // Dynamic
    string purpose;              // Dynamic
}
```

However, changing `expirationTime` from `uint128` to `uint112` might not be worth the complexity. The current waste is acceptable.

## Code Example

### Current (Acceptable)
```solidity
struct AccessRequest {
    address requester;           // Slot 1
    address patientAddress;      // Slot 2
    uint128 timestamp;           // Slot 3 (16 bytes)
    uint128 expirationTime;      // Slot 3 (16 bytes) - 32 bytes total
    bool isProcessed;            // Slot 4 (1 byte) - wastes 31 bytes
    RequestStatus status;        // Slot 4 (1 byte) - wastes 30 bytes
    string dataType;             // Dynamic
    string purpose;              // Dynamic
}
```

### Optimized (If Willing to Change uint128)
```solidity
struct AccessRequest {
    address requester;           // Slot 1
    address patientAddress;      // Slot 2
    uint128 timestamp;           // Slot 3 (16 bytes)
    uint112 expirationTime;      // Slot 3 (14 bytes) - Still sufficient for timestamps
    bool isProcessed;            // Slot 3 (1 byte)
    RequestStatus status;        // Slot 3 (1 byte)
    // Slot 3: 32 bytes (perfect fit!)
    string dataType;             // Dynamic
    string purpose;              // Dynamic
}
```

## Impact Analysis
- **Current Waste**: 30 bytes per AccessRequest = ~20,000 gas per request write
- **With Optimization**: Saves 1 storage slot = ~20,000 gas per request
- **For 1000 Requests**: Saves ~20,000,000 gas total

## Recommendation
**Keep current implementation** unless gas optimization is critical. The change from `uint128` to `uint112` for `expirationTime`:
- Reduces maximum timestamp from year 584 billion to year 584 million (still sufficient)
- Saves 1 storage slot per request
- Adds complexity and potential for confusion

**Priority**: **LOW-MEDIUM** - The optimization is possible but the current implementation is acceptable for most use cases.

## References
- [Solidity Storage Layout](https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html)
- [Struct Packing Best Practices](https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html#storage-inplace-encoding)

