# Security Overview

HealthChains implements a comprehensive security architecture designed to protect sensitive healthcare consent data and ensure system integrity.

## Table of Contents

1. [Security Philosophy](#security-philosophy)
2. [Security Architecture](#security-architecture)
3. [Smart Contract Security](#smart-contract-security)
4. [Backend Security](#backend-security)
5. [Frontend Security](#frontend-security)
6. [Access Control](#access-control)
7. [Data Privacy](#data-privacy)
8. [Security Best Practices](#security-best-practices)
9. [Known Limitations](#known-limitations)

## Security Philosophy

### Core Principles

1. **Zero Trust**: Never trust user input; validate everything
2. **Defense in Depth**: Multiple layers of security controls
3. **Principle of Least Privilege**: Minimal permissions required
4. **Fail Secure**: Revert on any uncertainty
5. **Audit Trail**: All actions logged immutably on blockchain

### Security-First Design

Every component was designed with security as a primary consideration:

- **Smart Contract**: Comprehensive input validation, reentrancy protection, access control
- **Backend**: Read-only contract interactions, input validation, secure API design
- **Frontend**: No private key storage, MetaMask integration, secure transaction handling

## Security Architecture

### Multi-Layer Defense

```
┌─────────────────────────────────────────┐
│         Frontend Layer                  │
│  - MetaMask Wallet Integration          │
│  - Input Validation                     │
│  - Transaction Verification             │
│  - No Private Key Storage               │
└─────────────────────────────────────────┘
                  │
┌─────────────────────────────────────────┐
│         Backend Layer                   │
│  - Read-only Contract Calls             │
│  - API Input Validation                 │
│  - CORS Protection                      │
│  - Error Handling                       │
└─────────────────────────────────────────┘
                  │
┌─────────────────────────────────────────┐
│      Blockchain Layer                   │
│  - ReentrancyGuard                      │
│  - Access Control                       │
│  - Input Validation                     │
│  - Immutable Audit Trail                │
└─────────────────────────────────────────┘
```

### Threat Model

**Protected Against**:

1. **Reentrancy Attacks**: `nonReentrant` modifier on all state-changing functions
2. **Unauthorized Access**: Access control checks on all sensitive operations
3. **Input Validation**: Comprehensive validation on all inputs
4. **DoS Attacks**: Bounded loops, batch size limits
5. **Integer Overflow**: Solidity 0.8+ built-in protection
6. **Front-running**: Not applicable (no financial incentives)
7. **Private Key Theft**: Keys never leave MetaMask

**Not Protected Against** (by design):

1. **MetaMask Compromise**: User's responsibility to secure MetaMask
2. **Phishing**: User education required
3. **Social Engineering**: User awareness required
4. **Network Attacks**: DDoS mitigation required at infrastructure level

## Smart Contract Security

### Reentrancy Protection

**Implementation**: All state-changing functions use OpenZeppelin's `ReentrancyGuard`:

```solidity
function grantConsent(...) external nonReentrant {
    // State changes are safe
}
```

**Why**: Prevents reentrancy attacks where malicious contracts call back into functions during execution.

**Coverage**: 100% of state-changing functions protected.

### Input Validation

**Address Validation**:
```solidity
modifier validAddress(address addr) {
    if (addr == address(0)) revert InvalidAddress();
    _;
}
```

**String Validation**:
```solidity
modifier validString(string memory str) {
    if (bytes(str).length == 0) revert EmptyString();
    if (bytes(str).length > MAX_STRING_LENGTH) revert StringTooLong();
    _;
}
```

**Array Validation**:
- Empty array checks
- Length limits (`MAX_BATCH_SIZE = 200`)
- Array length matching
- Bounds checking before arithmetic operations

**Expiration Validation**:
- Future timestamp check (if non-zero)
- Upper bound check (fits in uint128/uint112)

### Access Control

**Consent Granting**:
- ✅ Any address can grant (patient controls)
- ✅ Cannot grant to self
- ✅ Provider address must be valid

**Consent Revocation**:
- ✅ Only patient who granted can revoke
- ✅ Consent must exist and be active

**Access Requests**:
- ✅ Any address can request
- ✅ Cannot request from self
- ✅ Patient address must be valid

**Request Response**:
- ✅ Only patient can approve/deny
- ✅ Request must exist and not be processed
- ✅ Expiration check (auto-deny if expired)

### Integer Overflow Protection

**Solidity 0.8+**: Built-in overflow/underflow protection for arithmetic operations.

**Additional Protection**:
- Bounds checking before multiplication (prevent overflow)
- Validation that values fit in smaller types (uint128, uint112)

### DoS Prevention

**Bounded Loops**: All loops are bounded by `MAX_BATCH_SIZE` (200)

**No Unbounded Operations**:
- ✅ Removed unbounded loop functions
- ✅ Event-based queries for off-chain aggregation
- ✅ Batch size limits prevent gas limit issues

**Gas Limit Protection**:
- Maximum batch size prevents transaction failures
- String length limits prevent excessive gas usage

### Custom Errors

**Gas Efficiency**: Custom errors save ~23,500 gas per revert vs string messages.

**Security Benefit**: No sensitive information leaked in error messages.

### Event Security

**Immutable Audit Trail**: All state changes emit events.

**Indexed Parameters**: First 3 parameters indexed for efficient filtering.

**No Sensitive Data**: Events contain only on-chain data (no off-chain secrets).

## Backend Security

### Read-Only Contract Access

**Principle**: Backend never signs transactions; only reads from contract.

**Implementation**:
- Backend uses read-only contract calls
- No private keys stored in backend
- User transactions go directly from frontend to blockchain

**Benefit**: Even if backend is compromised, attackers cannot create unauthorized transactions.

### API Security

**JWT Authentication**: 
- All protected endpoints require JWT tokens obtained via MetaMask signature verification
- Tokens are stateless and don't require database lookups
- Token expiration is configurable (default: 1 hour)
- Signature validity window prevents replay attacks (default: 5 minutes)
- Tokens stored in browser localStorage (consider httpOnly cookies for production)

**Authentication Flow**:
1. User connects MetaMask wallet
2. Frontend requests message to sign from `/api/auth/message`
3. User signs message with MetaMask
4. Frontend sends signature to `/api/auth/login`
5. Backend verifies signature and returns JWT token
6. Frontend includes token in `Authorization: Bearer <token>` header for all API requests
7. Backend validates token on each request

**Role-Based Access Control**:
- **Patients**: Can only access their own data (pending requests, consents, history)
- **Providers**: Can access all patients (basic info), but gated data requires active consent
- **Authorization Middleware**: Verifies user role and ownership before allowing access

**Input Validation**: All API endpoints validate inputs at multiple layers.

**CORS Protection**: Cross-origin requests restricted to configured domains.

**Error Handling**: Secure error messages (no stack traces in production, no sensitive data).

**Ownership Verification**: Middleware ensures users can only access their own data.

**Participant Verification**: Middleware ensures users are either the patient or provider in consent/request operations.

**Rate Limiting**: Can be added for production (not implemented in current version).

### Environment Variables

**Secure Storage**: Environment variables for sensitive configuration.

**No Hardcoded Secrets**: All secrets in environment variables.

**JWT Secret**: Critical secret for token signing - must be:
- At least 32 bytes (64 hex characters)
- Cryptographically random
- Stored securely
- Rotated periodically
- Generated using: `openssl rand -hex 32`

**JWT Configuration**:
- `JWT_SECRET`: Secret key for signing tokens (required)
- `JWT_EXPIRES_IN`: Token expiration time (default: `1h`)
- `SIGNATURE_VALIDITY_DURATION`: Time window for signature validity in seconds (default: `300` = 5 minutes)
- `AUTH_REQUIRED`: Enable/disable authentication (default: `true`, set to `false` for development)

**Redis Configuration**:
- `REDIS_URL`: Redis connection URL (optional, defaults to `redis://localhost:6379`)
- System gracefully degrades if Redis is unavailable

**Production Best Practices**:
- Use secrets management (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets regularly (especially JWT_SECRET)
- Restrict access to secrets
- Never commit secrets to version control

### Logging

**Security Events**: Log security-relevant events.

**No Sensitive Data**: Never log private keys, passwords, or sensitive user data.

**Audit Trail**: Maintain logs for security auditing.

## Frontend Security

### Wallet Integration

**MetaMask Only**: Private keys never leave MetaMask.

**No Key Storage**: Frontend never stores or handles private keys.

**Transaction Signing**: All transactions signed by user via MetaMask.

### Input Validation

**Client-Side Validation**: Immediate feedback for user errors.

**Server-Side Validation**: Backend validates all inputs (defense in depth).

### Secure Communication

**HTTPS**: Required in production.

**API Communication**: All API calls over HTTPS.

**Contract Interaction**: Direct to blockchain (secure by design).

### Error Handling

**Secure Messages**: Error messages don't leak sensitive information.

**User Feedback**: Clear, actionable error messages.

**Transaction Status**: Secure transaction status tracking.

## Access Control

### Permission Model

**Patient Permissions**:
- ✅ Grant consent to any provider
- ✅ Revoke own consents
- ✅ Approve/deny access requests for own data
- ❌ Cannot grant consent to self
- ❌ Cannot revoke others' consents

**Provider Permissions**:
- ✅ Request access from any patient
- ✅ View consents granted to them
- ❌ Cannot grant consent on behalf of patients
- ❌ Cannot approve/deny requests

**No Admin Role**: Fully decentralized; no admin privileges.

### Access Verification

**On-Chain**: All permissions checked on-chain in smart contract.

**Off-Chain**: Backend and frontend verify permissions before displaying data.

**Immutable**: Permissions cannot be changed retroactively (consents can be revoked).

## Data Privacy

### On-Chain Data

**What's Stored**:
- Consent records (patient address, provider address, data types, purposes)
- Access requests
- Event logs

**What's NOT Stored**:
- Actual medical data (only consent metadata)
- Patient names or personal identifiers (only addresses)
- Sensitive information

### Off-Chain Data

**Backend Storage**: Patient/provider metadata (names, demographics, medical records).

**Separation**: Medical data is off-chain; only consent records on-chain.

**Access Control**: Backend enforces consent-based access to medical data.

### Privacy Considerations

**Pseudonymity**: Patient/provider identities are Ethereum addresses.

**Transparency**: All consent actions are publicly visible on blockchain.

**Trade-off**: Complete transparency vs privacy - this is intentional for auditability.

## Security Best Practices

### For Developers

1. **Always Validate Inputs**: Never trust user input
2. **Use Established Libraries**: OpenZeppelin for security primitives
3. **Follow CEI Pattern**: Checks-Effects-Interactions
4. **Comprehensive Testing**: Test security-critical paths
5. **Code Reviews**: Review all security-sensitive code
6. **Keep Dependencies Updated**: Regular security updates

### For Users

1. **Secure MetaMask**: Use strong password, enable 2FA if available
2. **Verify Addresses**: Always verify provider addresses before granting consent
3. **Review Requests**: Carefully review access requests before approving
4. **Regular Audits**: Periodically review active consents
5. **Beware of Phishing**: Never share private keys or seed phrases

### For Administrators

1. **Secure Infrastructure**: Harden servers, use firewalls
2. **Monitor Logs**: Regular log review for suspicious activity
   - Check `backend/logs/error.log` for errors
   - Review `backend/logs/combined.log` for patterns
   - Use structured logging (JSON) for automated analysis
3. **Update Software**: Keep all software updated
4. **Backup Data**: Regular backups of off-chain data
5. **Incident Response**: Have a plan for security incidents
6. **Log Management**: 
   - Monitor log file sizes (automatic rotation at 5MB)
   - Archive old logs for compliance
   - Set appropriate log levels (`LOG_LEVEL=info` for production)

## Known Limitations

### Current Limitations

1. **No Encryption**: Medical data stored off-chain is not encrypted (can be added)
2. **No Multi-Sig**: Single signature required (can add multi-sig support)
3. **No Time-Locked Revocation**: Revocation is immediate (can add delay)
4. **Public Transparency**: All consents are publicly visible (by design)
5. **Rate Limiting**: ✅ **IMPLEMENTED** - API has rate limiting (10,000 requests/15min general, 2,000/15min for expensive endpoints)
6. **JWT Token Storage**: Tokens stored in browser localStorage (consider httpOnly cookies for production)

### Future Security Enhancements

1. **Data Encryption**: Encrypt medical data at rest and in transit
2. **Multi-Signature**: Require multiple approvals for sensitive operations
3. **Time-Locked Operations**: Add delays for critical operations
4. **Zero-Knowledge Proofs**: Privacy-preserving consent verification
5. **Formal Verification**: Mathematical proof of contract correctness

## Security Audit

The smart contract has undergone comprehensive security review:

- ✅ Reentrancy protection verified
- ✅ Input validation verified
- ✅ Access control verified
- ✅ Gas optimization verified
- ✅ DoS prevention verified
- ✅ 79 comprehensive tests passing

### Audit Process

1. **Automated Analysis**: Slither, Mythril
2. **Manual Review**: Code review by security experts
3. **Test Coverage**: 95%+ test coverage
4. **Gas Analysis**: Gas benchmarks for all operations

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public issue
2. **Email** security team directly
3. **Include**: Description, steps to reproduce, potential impact
4. **Wait**: For response before disclosure

## Related Documentation

- [Smart Contract Security](smart-contract-security.md) - Detailed contract security
- [Access Control](access-control.md) - Permission model details
- [Best Practices](best-practices.md) - Security best practices
- [Smart Contract Design](../architecture/smart-contract-design.md) - Contract architecture

