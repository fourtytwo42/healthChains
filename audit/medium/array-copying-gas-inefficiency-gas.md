# Array Copying from Calldata to Storage - Gas Inefficiency

## Severity
Medium

## Type
Gas

## Location
- File: `backend/contracts/PatientConsentManager.sol`
- Function: `requestAccess()`
- Lines: 654-663

## Description
The `requestAccess()` function copies arrays from `calldata` to `storage` using a loop with `push()` operations. This is gas-inefficient because:
1. Each `push()` operation performs a storage write (20,000 gas for first write, 5,000 gas for subsequent writes)
2. The arrays are stored in storage mappings, which is expensive
3. The data is already available in calldata, which is cheaper to read

For a request with 10 data types and 10 purposes, this results in 20 storage writes, costing approximately 20,000 + (19 × 5,000) = 115,000 gas just for array copying.

## Impact
- **High Gas Costs**: Each array element copied costs ~5,000-20,000 gas
- **Scalability**: Large requests become prohibitively expensive
- **Unnecessary Storage**: Arrays are stored in storage when they could be derived from events or stored more efficiently

## Recommendation

### Option 1: Store Only Hashes (Recommended)
Instead of storing full string arrays, store only the hashes and reconstruct from events if needed:

```solidity
// Remove these mappings:
// mapping(uint256 => string[]) public requestDataTypes;
// mapping(uint256 => string[]) public requestPurposes;

// Add these instead:
mapping(uint256 => bytes32[]) public requestDataTypeHashes;
mapping(uint256 => bytes32[]) public requestPurposeHashes;

function requestAccess(
    address patient,
    string[] calldata dataTypes,
    string[] calldata purposes,
    uint256 expirationTime
) external nonReentrant validAddress(patient) returns (uint256 requestId) {
    // ... existing validation ...
    
    // Store hashes instead of strings (much cheaper)
    bytes32[] memory dataTypeHashes = new bytes32[](dataTypes.length);
    bytes32[] memory purposeHashes = new bytes32[](purposes.length);
    
    for (uint256 i = 0; i < dataTypes.length; ) {
        dataTypeHashes[i] = keccak256(bytes(dataTypes[i]));
        unchecked { i++; }
    }
    
    for (uint256 i = 0; i < purposes.length; ) {
        purposeHashes[i] = keccak256(bytes(purposes[i]));
        unchecked { i++; }
    }
    
    // Store hashes (one write per array, not per element)
    requestDataTypeHashes[requestId] = dataTypeHashes;
    requestPurposeHashes[requestId] = purposeHashes;
    
    // Original strings are in the event, can be retrieved from there if needed
    emit AccessRequested(
        requestId,
        msg.sender,
        patient,
        dataTypes, // Still emit original strings
        purposes,
        uint128(expirationTime),
        uint128(block.timestamp)
    );
}
```

### Option 2: Use Memory Arrays and Retrieve from Events
Don't store arrays at all - retrieve from events when needed:

```solidity
// Remove storage mappings entirely
// Clients can parse events to get the arrays

function requestAccess(...) external ... {
    // ... validation ...
    
    // Don't store arrays, just emit event
    emit AccessRequested(
        requestId,
        msg.sender,
        patient,
        dataTypes, // Emit original arrays
        purposes,
        uint128(expirationTime),
        uint128(block.timestamp)
    );
    
    // In respondToAccessRequest, read from event or require caller to pass arrays again
}
```

### Option 3: Batch Storage Write
If arrays must be stored, use a more efficient pattern:

```solidity
// Store arrays more efficiently
function requestAccess(...) external ... {
    // ... validation ...
    
    // Pre-allocate arrays in memory
    string[] memory storedDataTypes = new string[](dataTypes.length);
    string[] memory storedPurposes = new string[](purposes.length);
    
    // Copy to memory first (cheaper)
    for (uint256 i = 0; i < dataTypes.length; ) {
        storedDataTypes[i] = dataTypes[i];
        unchecked { i++; }
    }
    
    for (uint256 i = 0; i < purposes.length; ) {
        storedPurposes[i] = purposes[i];
        unchecked { i++; }
    }
    
    // Single storage write per array (if Solidity supports it)
    // Note: This may not be possible with current Solidity, but worth exploring
}
```

## Code Example

### Before
```solidity
// Copy dataTypes array
for (uint256 i = 0; i < dataTypes.length; ) {
    storedDataTypes.push(dataTypes[i]); // ❌ Expensive: 5,000-20,000 gas per push
    unchecked { i++; }
}

// Copy purposes array
for (uint256 i = 0; i < purposes.length; ) {
    storedPurposes.push(purposes[i]); // ❌ Expensive: 5,000-20,000 gas per push
    unchecked { i++; }
}
```

### After (Option 1 - Store Hashes)
```solidity
// Compute hashes (cheap: ~30 gas per hash)
bytes32[] memory dataTypeHashes = new bytes32[](dataTypes.length);
bytes32[] memory purposeHashes = new bytes32[](purposes.length);

for (uint256 i = 0; i < dataTypes.length; ) {
    dataTypeHashes[i] = keccak256(bytes(dataTypes[i])); // ✅ Cheap computation
    unchecked { i++; }
}

for (uint256 i = 0; i < purposes.length; ) {
    purposeHashes[i] = keccak256(bytes(purposes[i])); // ✅ Cheap computation
    unchecked { i++; }
}

// Store hashes (one write per array)
requestDataTypeHashes[requestId] = dataTypeHashes; // ✅ One storage write
requestPurposeHashes[requestId] = purposeHashes; // ✅ One storage write

// Original strings available in event
emit AccessRequested(requestId, msg.sender, patient, dataTypes, purposes, ...);
```

## Gas Savings Estimate
- **Current**: ~115,000 gas for 20 array elements (10 data types + 10 purposes)
- **With Hashes**: ~60,000 gas (computation + 2 storage writes)
- **Savings**: ~55,000 gas per request (~48% reduction)

## References
- [Solidity Gas Optimization: Storage vs Memory](https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html)
- [Ethereum Gas Costs](https://ethereum.org/en/developers/docs/gas/)

