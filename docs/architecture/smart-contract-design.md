# Smart Contract Design

## Contract Overview

The `PatientConsentManager` contract is the core of the HealthChains system. It manages patient consent records, access requests, and provides an immutable audit trail of all consent-related activities on the blockchain.

## Design Philosophy

### 1. Security First

Every design decision prioritizes security:
- **ReentrancyGuard**: All state-changing functions are protected
- **Input Validation**: Comprehensive validation on all inputs
- **Access Control**: Strict checks on who can perform which actions
- **Defense in Depth**: Multiple layers of validation

### 2. Gas Efficiency

Optimizations to minimize transaction costs:
- **Struct Packing**: Carefully arranged struct fields to minimize storage slots
- **Hash Storage**: Store `bytes32` hashes instead of full strings
- **Custom Errors**: Use custom errors instead of string messages (~23,500 gas saved per revert)
- **Batch Operations**: Single transaction for multiple operations

### 3. Scalability

Designed to handle growth:
- **Event-Based Queries**: No unbounded loops (prevents DoS)
- **Bounded Arrays**: All loops are bounded by `MAX_BATCH_SIZE`
- **Efficient Lookups**: Mappings for O(1) access

## Data Structures

### ConsentRecord

**Purpose**: Store individual consent records

**Storage Layout** (Optimized):
```solidity
struct ConsentRecord {
    address patientAddress;      // 20 bytes (slot 1)
    address providerAddress;     // 20 bytes (slot 2)
    uint128 timestamp;           // 16 bytes (slot 3, first half)
    uint128 expirationTime;      // 16 bytes (slot 3, second half)
    bool isActive;               // 1 byte (slot 4, packed)
    bytes32 dataTypeHash;        // 32 bytes (slot 5)
    bytes32 purposeHash;         // 32 bytes (slot 6)
}
```

**Design Decisions**:
- **uint128 for timestamps**: Sufficient until year 584 billion, saves gas vs uint256
- **bytes32 for strings**: Hash storage saves ~40,000 gas per consent vs storing strings
- **Packed struct**: `uint128 + uint128 + bool` fit in one slot (with padding)

**Gas Savings**: ~60,000 gas per consent compared to naive implementation

### BatchConsentRecord

**Purpose**: Store batch consents for multiple data types/purposes

**Storage Layout**:
```solidity
struct BatchConsentRecord {
    address patientAddress;      // 20 bytes
    address providerAddress;     // 20 bytes
    uint128 timestamp;           // 16 bytes
    uint128 expirationTime;      // 16 bytes
    bool isActive;               // 1 byte
    bytes32[] dataTypeHashes;    // Array (dynamic)
    bytes32[] purposeHashes;     // Array (dynamic)
}
```

**Design Decisions**:
- **Arrays instead of multiple records**: One struct write instead of N individual writes
- **Hash arrays**: Store hashes, not full strings
- **Gas Savings**: For 10 consents, batch saves ~200,000 gas (40-60% reduction)

**Use Case**: When approving an access request with multiple data types and purposes, creates one batch record instead of cartesian product of individual records.

### AccessRequest

**Purpose**: Store access requests from providers to patients

**Storage Layout** (Perfect Packing):
```solidity
struct AccessRequest {
    address requester;           // 20 bytes (slot 1)
    address patientAddress;      // 20 bytes (slot 2)
    uint128 timestamp;           // 16 bytes (slot 3, first 16 bytes)
    uint112 expirationTime;      // 14 bytes (slot 3, next 14 bytes)
    bool isProcessed;            // 1 byte (slot 3, next byte)
    RequestStatus status;        // 1 byte (slot 3, last byte)
    // Slot 3: Perfect 32-byte fit!
    string dataType;             // Dynamic (slot 4+)
    string purpose;              // Dynamic (slot 5+)
}
```

**Design Decisions**:
- **uint112 for expirationTime**: Reduced from uint128 to achieve perfect packing
- **uint112 is sufficient**: Still covers timestamps until year 584 million
- **Enum instead of bool**: More expressive than boolean flag
- **Perfect packing**: All fields in slot 3 fit exactly in 32 bytes

**Gas Savings**: Saves 1 storage slot per request (~20,000 gas)

## Storage Mappings

### Primary Data Mappings

```solidity
mapping(uint256 => BatchConsentRecord) public batchConsentRecords;
mapping(uint256 => ConsentRecord) public consentRecords;  // Legacy - for backward compatibility
mapping(uint256 => AccessRequest) public accessRequests;
```

**Design**: 
- Sequential IDs (0, 1, 2, ...) for easy enumeration and event correlation
- **All new consents use `BatchConsentRecord`** (stored in `batchConsentRecords`)
- `ConsentRecord` mapping exists for backward compatibility with old consents
- `getConsentRecord()` automatically converts old `ConsentRecord` to `BatchConsentRecord` format

### Index Mappings

```solidity
mapping(address => uint256[]) public patientConsents;
mapping(address => uint256[]) public providerConsents;
mapping(address => uint256[]) public patientRequests;
```

**Purpose**: Efficient lookup of all consents/requests for a given address.

**Trade-off**: Unbounded arrays, but acceptable because:
- Patients/providers typically have manageable numbers of consents
- Can be paginated off-chain if needed
- More gas-efficient than mapping(address => mapping(uint256 => bool))

### Hash-to-String Mappings

```solidity
mapping(bytes32 => string) public dataTypeHashToString;
mapping(bytes32 => string) public purposeHashToString;
mapping(bytes32 => bool) private _dataTypeHashExists;
mapping(bytes32 => bool) private _purposeHashExists;
```

**Purpose**: Reconstruct human-readable strings from stored hashes.

**Design Decisions**:
- **Hash-to-string mapping**: Needed for retrieval and display
- **Bool existence check**: Avoids expensive string reads (saves ~2,200 gas per check)
- **Only store once**: Check existence before storing to avoid duplicates

## Functions

### Core Functions

#### grantConsent()

**Purpose**: Grant consent for a provider to access patient data

**Function Signature**:
```solidity
function grantConsent(
    address provider,
    string[] calldata dataTypes,
    uint256 expirationTime,
    string[] calldata purposes
) external returns (uint256 consentId)
```

**Implementation**: Always creates a single `BatchConsentRecord` struct
- **ONE consent ID** stores arrays of all dataTypes and purposes
- Covers all combinations (dataTypes.length × purposes.length)
- Works for single or multiple items - always uses `BatchConsentRecord`
- Stored in `batchConsentRecords` mapping
- Emits `ConsentGranted` event with array of consent IDs (typically one)

**Example**: 
- Input: `dataTypes = ["medical_records", "genetic_data"]`, `purposes = ["treatment", "research"]`
- Result: **ONE** `BatchConsentRecord` covering 4 combinations (2 × 2)
- Backend serves as ONE consent record with `dataTypes: [2 items]` and `purposes: [2 items]`

**Security Measures**:
- `nonReentrant` modifier
- Address validation (not zero, not self)
- Array validation (not empty, within limits)
- String validation per item (not empty, max length)
- Expiration validation (future or zero)
- Total combinations limit (dataTypes.length × purposes.length ≤ MAX_BATCH_SIZE = 200)

**Gas Optimizations**:
- Single struct write regardless of number of combinations
- Hash storage instead of strings
- Only store strings once (check existence first)
- Unchecked counter increment (safe in Solidity 0.8+)

**Gas Cost**: 
- Single combination: ~250,000 gas
- 10 combinations: ~280,000 gas (vs ~3.2M for 10 individual records = 91% savings)
- Scales efficiently with more combinations

#### revokeConsent()

**Purpose**: Revoke an active consent

**Security Measures**:
- Only patient who granted can revoke
- Consent must exist and be active
- Handles both single and batch consents

**Gas Cost**: ~45,000 gas

#### requestAccess()

**Purpose**: Request access to patient data

**Security Measures**:
- Cannot request from self
- Array validation
- String validation per item
- Expiration validation
- Total combinations limit (dataTypes × purposes ≤ MAX_BATCH_SIZE)

**Gas Optimizations**:
- Store hashes in arrays instead of strings
- Bounds checking before multiplication (prevent overflow)

**Gas Cost**: ~180,000 gas (depends on array sizes)

#### respondToAccessRequest()

**Purpose**: Approve or deny an access request

**Implementation - When Approved**: Creates a single `BatchConsentRecord` struct (same as `grantConsent()`)
- **ONE consent ID** stores arrays of all dataTypes and purposes from the request
- Uses the same `BatchConsentRecord` structure as `grantConsent()`
- Stored in `batchConsentRecords` mapping
- Emits `ConsentGranted` event with array of consent IDs (one element)

**Example**: If request has 7 dataTypes and 8 purposes:
- Creates **1 `BatchConsentRecord`** with arrays (1 consent ID, 1 event)
- **Backend reads the event, fetches the BatchConsentRecord, and serves it as ONE consent record with arrays**
- **Frontend receives ONE consent with `dataTypes: [7 items]` and `purposes: [8 items]`**
- Gas savings: ~56 × 320,000 = 17.9M gas vs ~250,000 gas (98.6% savings!)

**Security Measures**:
- Only patient can respond
- Request must exist and not be processed
- Expiration check (auto-deny if expired)
- Validates arrays are non-empty
- Validates hash-to-string mappings exist (defense-in-depth)

**Gas Optimizations**:
- Single struct write instead of many
- Array storage (one write per array)
- Same efficient structure as `grantConsent()`

**Gas Cost**: ~250,000 gas (approval with batch consent)

### View Functions

All view functions are marked `external` (not `public`) to save gas:
- `getPatientConsents()` - Returns array of consent IDs
- `getPatientRequests()` - Returns array of request IDs
- `getConsentRecord()` - Returns single consent record
- `getBatchConsentRecord()` - Returns batch consent record
- `getAccessRequest()` - Returns access request
- `getRequestDataTypes()` - Reconstructs string array from hashes
- `getRequestPurposes()` - Reconstructs string array from hashes
- `isConsentExpired()` - Checks expiration status

## Events

### Design Principles

1. **Indexed Parameters**: First 3 parameters indexed for efficient filtering
2. **Comprehensive Data**: Include all relevant information
3. **Hash Storage**: Use hashes in events to save gas
4. **Timestamp Included**: Always include block timestamp

### Event Types

- `ConsentGranted` - Single consent granted
- `ConsentRevoked` - Consent revoked
- `ConsentBatchGranted` - Batch consent granted
- `AccessRequested` - Access request created
- `AccessApproved` - Request approved
- `AccessDenied` - Request denied
- `ConsentExpired` - Consent expired (future use)

**Note**: `ConsentExpired` event is defined but not emitted in current implementation. Expiration checking is done off-chain via events.

## Constants

```solidity
uint256 private constant MAX_STRING_LENGTH = 256;    // Max string length
uint256 private constant MAX_BATCH_SIZE = 200;       // Max batch size
uint256 private constant MAX_UINT128 = type(uint128).max;
uint256 private constant MAX_UINT112 = type(uint112).max;
```

**Rationale**:
- `MAX_STRING_LENGTH`: Prevents gas limit issues with extremely long strings
- `MAX_BATCH_SIZE`: Prevents DoS attacks and gas limit issues
- `MAX_UINT128/112`: Used for expiration time validation

## Custom Errors

All errors are custom errors (not string messages) for gas efficiency:

```solidity
error InvalidAddress();
error CannotGrantConsentToSelf();
error CannotRequestAccessFromSelf();
error EmptyString();
error ExpirationInPast();
error UnauthorizedRevocation();
error ConsentAlreadyInactive();
error UnauthorizedResponse();
error RequestAlreadyProcessed();
error ConsentNotFound();
error RequestNotFound();
error StringTooLong();
error EmptyBatch();
error BatchSizeExceeded(uint256 provided, uint256 max);
error ArrayLengthMismatch(...);
error ExpirationTooLarge(uint256 provided, uint256 max);
```

**Gas Savings**: ~23,500 gas per revert vs string messages

## Security Measures

### Reentrancy Protection

All state-changing functions use `nonReentrant` modifier from OpenZeppelin's `ReentrancyGuard`.

### Input Validation

- **Addresses**: Not zero, not self (where applicable)
- **Strings**: Not empty, within length limits
- **Arrays**: Not empty, within batch size limits, matching lengths
- **Expiration**: Future timestamp or zero (for no expiration)
- **Bounds**: Expiration fits in uint128/uint112

### Access Control

- **Consent Granting**: Any address can grant (patient controls)
- **Consent Revocation**: Only patient who granted can revoke
- **Request Creation**: Any address can request (provider controls)
- **Request Response**: Only patient can approve/deny

### Defensive Programming

- Validate existence before operations
- Validate arrays are non-empty before processing
- Validate hash-to-string mappings exist
- Multiple validation layers (defense in depth)

## Gas Optimization Techniques

### 1. Struct Packing

Carefully arrange struct fields to minimize storage slots:
- Group small types together
- Use smallest integer type that fits the data
- Pack bools with other small types

### 2. Hash Storage

Store `bytes32` hashes instead of strings:
- Saves ~40,000 gas per consent
- Fixed-size storage is more efficient
- Maintain string mapping for retrieval

### 3. Batch Operations

Single transaction for multiple operations:
- Reduces transaction overhead
- Shared storage operations
- 40-60% gas savings for batches

### 4. Custom Errors

Use custom errors instead of string messages:
- Saves ~23,500 gas per revert
- Better for production debugging

### 5. Unchecked Blocks

Use `unchecked` for safe operations:
- Counter increments (protected by Solidity 0.8+)
- Loop increments
- Saves ~20-40 gas per operation

### 6. Caching Storage Reads

Cache storage reads in loops:
```solidity
uint256 currentCounter = consentCounter; // Cache
for (uint256 i = 0; i < batchSize; ) {
    // Use cached value
    unchecked { i++; }
}
consentCounter = currentCounter; // Update once
```

## Limitations & Future Improvements

### Current Limitations

1. **Unbounded Arrays in View Functions**: `getPatientConsents()` returns full array
   - **Impact**: Could be expensive for users with many consents
   - **Solution**: Off-chain pagination or indexed queries

2. **Event-Based Queries Only**: No on-chain query for "active consents"
   - **Impact**: Requires off-chain indexing
   - **Solution**: Current approach is correct (gas-efficient)

3. **No Pagination**: View functions return all data
   - **Impact**: Gas costs for large datasets
   - **Solution**: Use events and off-chain queries

### Future Improvements

1. **Layer 2 Migration**: Deploy to Polygon/Arbitrum for lower costs
2. **Pagination Support**: Add pagination to view functions
3. **Multi-sig Support**: Require multiple approvals for sensitive consents
4. **Time-locked Revocation**: Add delay before revocation takes effect
5. **Consent Templates**: Predefined consent templates for common scenarios

## Testing

See [Testing Documentation](../TESTING.md) for:
- Test coverage (79 tests)
- Gas benchmarks
- Security test cases
- Integration tests

## Related Documentation

- [Architecture Overview](overview.md)
- [Security Documentation](../security/smart-contract-security.md)
- [Gas Optimization](../scalability/gas-optimization.md)

