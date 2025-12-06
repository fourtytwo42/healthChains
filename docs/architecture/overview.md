# Architecture Overview

## System Architecture

HealthChains is a decentralized patient consent management system that leverages blockchain technology to provide transparent, secure, and auditable healthcare data access permissions. The architecture follows a three-tier design pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Tier                          │
│  Next.js 16 | React | TypeScript | Tailwind CSS | shadcn/ui │
│  - User Interface                                           │
│  - MetaMask Wallet Integration                              │
│  - Direct Contract Interaction (write operations)           │
│  - Backend API Integration (read operations)                │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼────────┐    ┌────────▼────────┐
        │  Backend Tier  │    │ MetaMask Wallet │
        │ Node.js/Express│    │  (User Signer)  │
        │  - REST API    │    │                 │
        │  - JWT Auth    │    │  Direct to      │
        │  - Redis Cache │    │  Blockchain     │
        │  - Read-only   │    │                 │
        │    Contract    │    │                 │
        │    Calls       │    │                 │
        └───────┬────────┘    └────────┬────────┘
                │                       │
                └───────────┬───────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │         Blockchain Tier               │
        │  Hardhat Network | Ethereum Compatible│
        │  - Smart Contract (PatientConsentManager)│
        │  - Immutable Consent Records          │
        │  - Event Logging                      │
        └───────────────────────────────────────┘
```

## Architecture Decisions

### 1. Why Separate Read and Write Paths?

**Decision**: Read operations go through the backend API, while write operations go directly from frontend to blockchain via MetaMask.

**Rationale**:
- **Security**: User private keys never leave MetaMask. The backend never has access to user wallets.
- **User Control**: Patients and providers maintain full control over their transactions.
- **Efficiency**: Read operations don't require transaction fees; only writes do.
- **Scalability**: Backend can cache and aggregate read data, reducing blockchain queries.
- **Flexibility**: Backend can provide enriched data (combining blockchain data with off-chain metadata).

**Trade-offs**:
- ✅ Pro: Maximum security - no centralized key management
- ✅ Pro: True decentralization - users control their own keys
- ⚠️ Con: Requires MetaMask installation and user interaction for writes
- ⚠️ Con: More complex error handling in frontend

### 2. Why Event-Based Queries Instead of On-Chain Loops?

**Decision**: Removed unbounded loops from the smart contract; use event-based queries for off-chain data aggregation.

**Rationale**:
- **Gas Efficiency**: Looping through arrays on-chain is extremely expensive
- **DoS Prevention**: Unbounded loops can cause transaction failures or excessive gas costs
- **Scalability**: Events are indexed by the blockchain, making queries efficient
- **Best Practice**: Industry standard for querying blockchain history

**Implementation**:
- Smart contract emits events for all state changes
- Backend service queries events and maintains off-chain indexes
- Frontend queries backend API for consent status and history

**Trade-offs**:
- ✅ Pro: No gas limits on queries
- ✅ Pro: Prevents DoS attacks
- ✅ Pro: More scalable as data grows
- ⚠️ Con: Requires off-chain indexer (backend service)
- ⚠️ Con: Slight delay for new events to be indexed

### 3. Why Hash-Based String Storage?

**Decision**: Store `bytes32` hashes of data types and purposes instead of full strings in consent records.

**Rationale**:
- **Gas Savings**: Storing `bytes32` (32 bytes) vs `string` (variable, often 64+ bytes) saves ~40,000 gas per consent
- **Storage Efficiency**: Fixed-size storage slots are more efficient
- **Query Performance**: Hash lookups are faster than string comparisons
- **Backward Compatibility**: Maintains string mapping for retrieval

**Implementation**:
- Consent records store `dataTypeHash` and `purposeHash`
- Separate mappings store `hash → string` for retrieval
- Helper functions reconstruct strings from hashes when needed

**Trade-offs**:
- ✅ Pro: ~48% gas savings on array storage
- ✅ Pro: More efficient storage layout
- ⚠️ Con: Additional complexity in contract
- ⚠️ Con: Requires hash-to-string lookup for human-readable output

### 4. Why Batch Operations?

**Decision**: Implemented batch consent operations alongside individual operations, with two different batch approaches.

**Rationale**:
- **Gas Efficiency**: Single transaction overhead for multiple operations
- **User Experience**: Providers often need to request multiple data types/purposes
- **Network Efficiency**: Fewer transactions = less network congestion
- **Cost Savings**: Up to 40-60% gas savings for batch of 10 consents

**Implementation - Unified Batch Approach**:

**`grantConsent()`**: Always creates a single `BatchConsentRecord` struct
   - **ONE consent ID** stores arrays of dataTypes and purposes
   - **ONE struct represents all combinations** (e.g., 2 data types × 3 purposes = 6 combinations in ONE record)
   - Works for single or multiple items - always uses `BatchConsentRecord`
   - **Emits ONE `ConsentGranted` event** with array containing the consent ID
   - **Backend reads the event, fetches the BatchConsentRecord, and serves it as ONE consent record with arrays**
   - Frontend receives ONE consent with `dataTypes: []` and `purposes: []` arrays
   - Much more gas-efficient: ~250,000 gas vs ~3.2M gas for 10 individual records (92% savings)

**`respondToAccessRequest()` (when approved)**: Creates a single `BatchConsentRecord` struct (same structure)
   - Uses the same `BatchConsentRecord` structure as `grantConsent()`
   - ONE consent ID stores arrays from the access request
   - Same gas efficiency and structure

**Why Unified Approach?**:
- **Simpler API**: One function signature, one data structure
- **Consistent behavior**: All consents work the same way
- **Maximum gas efficiency**: Single struct write regardless of number of combinations
- **Better UX**: Frontend always receives arrays, making it easy to display all data types/purposes

**Trade-offs**:
- ✅ Pro: Significant gas savings (especially BatchConsentRecord)
- ✅ Pro: Better UX for complex consent scenarios
- ⚠️ Con: More complex validation logic
- ⚠️ Con: Two different data structures to handle

### 5. Why Next.js App Router?

**Decision**: Use Next.js 16 with App Router instead of Pages Router or create-react-app.

**Rationale**:
- **Modern Architecture**: App Router is the future of Next.js
- **Server Components**: Better performance with React Server Components
- **File-Based Routing**: Intuitive routing structure
- **TypeScript Support**: First-class TypeScript support
- **Built-in Optimizations**: Automatic code splitting, image optimization

**Trade-offs**:
- ✅ Pro: Better performance out of the box
- ✅ Pro: Modern React patterns
- ✅ Pro: Better developer experience
- ⚠️ Con: Newer API (less community resources)

### 6. Why Ethers.js v6 Instead of v5?

**Decision**: Use Ethers.js v6 for blockchain interactions.

**Rationale**:
- **Modern API**: Cleaner, promise-based API
- **Tree-Shakable**: Better bundle size
- **TypeScript First**: Better TypeScript support
- **Active Development**: Latest version with ongoing improvements

**Trade-offs**:
- ✅ Pro: Better TypeScript support
- ✅ Pro: Smaller bundle sizes
- ⚠️ Con: Breaking changes from v5 (requires migration)

## Component Interaction Flow

### Granting Consent Flow

```
User (Patient)                    Frontend              MetaMask         Smart Contract
    │                                │                     │                    │
    │─── Click "Grant Consent" ────▶│                     │                    │
    │                                │                     │                    │
    │                                │─── getProvider() ──▶│                    │
    │                                │◀── providerAddress ─│                    │
    │                                │                     │                    │
    │                                │─── grantConsent() ──┼───────────────────▶│
    │                                │                     │                    │
    │                                │                     │─── Sign TX ───────▶│
    │                                │                     │                    │
    │                                │◀──── TX Hash ───────┼────────────────────│
    │                                │                     │                    │
    │                                │─── Wait for Confirmation ──────────────▶│
    │                                │                     │                    │
    │                                │◀─── Event Emitted ──────────────────────│
    │                                │                     │                    │
    │◀─── Success Toast ─────────────│                     │                    │
    │                                │                     │                    │
    │─── Refresh Data ──────────────▶│─── API Call ──────────────────────────▶│
    │                                │                     │                    │
    │◀─── Updated UI ────────────────│◀─── Event Data ────────────────────────│
```

### Requesting Access Flow

```
User (Provider)                   Frontend              MetaMask         Smart Contract
    │                                │                     │                    │
    │─── Click "Request Access" ────▶│                     │                    │
    │                                │                     │                    │
    │                                │─── getPatient() ───▶│                    │
    │                                │◀── patientAddress ──│                    │
    │                                │                     │                    │
    │                                │─── requestAccess() ─┼───────────────────▶│
    │                                │                     │                    │
    │                                │                     │─── Sign TX ───────▶│
    │                                │                     │                    │
    │                                │◀──── TX Hash ───────┼────────────────────│
    │                                │                     │                    │
    │                                │─── Wait for Confirmation ──────────────▶│
    │                                │                     │                    │
    │                                │◀─── Event Emitted ──────────────────────│
    │                                │                     │                    │
    │◀─── Success Toast ─────────────│                     │                    │
    │                                │                     │                    │
    │─── Check Requests ────────────▶│─── API Call ──────────────────────────▶│
    │                                │                     │                    │
    │◀─── Request List ──────────────│◀─── Request Data ──────────────────────│
```

## Data Models

### On-Chain Data (Smart Contract)

**Consent Storage**:

**BatchConsentRecord**: The standard consent record structure
   - Arrays of data types and purposes in ONE record
   - Created by `grantConsent()` (always creates BatchConsentRecord)
   - Also created by `respondToAccessRequest()` when approved
   - More gas-efficient for large combinations
   - ONE consent ID covers all combinations (dataTypes.length × purposes.length)
   - Works for single or multiple items - always uses BatchConsentRecord

**Note**: The old `ConsentRecord` struct exists for backward compatibility with legacy consents, but all new consents use `BatchConsentRecord`. The `getConsentRecord()` function automatically handles both types.

**Other Data**:
- **AccessRequest**: Request for access with requester, patient, data types, purposes, status
- **Events**: Immutable logs of all consent actions

### Off-Chain Data (Backend)

- **Patient Demographics**: Name, DOB, address, contact info
- **Medical Records**: History, lab results, imaging, genetic data
- **Provider Information**: Organization details, staff, facilities
- **Event Indexes**: Queryable indexes of blockchain events

## Security Architecture

### Multi-Layer Security

1. **Smart Contract Layer**:
   - ReentrancyGuard on all state-changing functions
   - Input validation on all parameters
   - Access control checks
   - Custom errors for gas-efficient reverts

2. **Backend Layer**:
   - JWT authentication (MetaMask signature-based)
   - Read-only contract interactions
   - Input validation on API endpoints
   - CORS protection
   - Redis caching for performance
   - Rate limiting (can be added)

3. **Frontend Layer**:
   - MetaMask signature verification
   - Transaction confirmation waiting
   - Error handling and user feedback
   - No private key storage

### Key Security Principles

- **Zero Trust**: Never trust user input
- **Defense in Depth**: Multiple layers of validation
- **Principle of Least Privilege**: Minimal permissions required
- **Fail Secure**: Revert on any uncertainty
- **Audit Trail**: All actions logged on blockchain

## Scalability Considerations

### Current Architecture

- **On-Chain**: Consent records, access requests, events
- **Off-Chain**: Patient/provider metadata, event indexes
- **Hybrid**: Best of both worlds

### Scaling Strategies

1. **Layer 2 Solutions**: Can migrate to Polygon, Arbitrum, Optimism for lower costs
2. **Event Indexing**: Current backend indexes events; can scale with database
3. **Caching**: Backend can cache frequently accessed data
4. **Pagination**: API supports pagination for large datasets
5. **Batch Operations**: Reduces transaction count

### Limitations

- **Gas Costs**: Mainnet transactions are expensive
- **Throughput**: Ethereum mainnet ~15 TPS
- **Query Performance**: Complex queries require off-chain indexing

See [Scalability Documentation](docs/scalability/overview.md) for more details.

## Technology Choices Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Smart Contracts | Solidity ^0.8.20 | Latest stable, built-in overflow protection |
| Blockchain Framework | Hardhat | Best developer experience, comprehensive tooling |
| Security Libraries | OpenZeppelin | Industry standard, audited contracts |
| Backend Framework | Express | Simple, lightweight, well-documented |
| Web3 Library | Ethers.js v6 | Modern API, TypeScript support |
| Frontend Framework | Next.js 16 | Server components, excellent performance |
| UI Library | shadcn/ui + Tailwind | Modern, customizable, accessible |
| State Management | React Query | Excellent data fetching and caching |
| Testing Framework | Hardhat/Mocha + Jest + Playwright | Comprehensive testing coverage |
| Process Management | PM2 | Production-ready process management |

## Next Steps

- Read [Smart Contract Design](smart-contract-design.md) for contract architecture details
- Read [Data Flow](data-flow.md) for detailed interaction flows
- Read [Technology Stack](technology-stack.md) for deeper technology rationale

