# API Overview

The HealthChains backend provides a REST API for querying blockchain data and patient/provider information.

## Base URL

```
Development: http://localhost:3001
Production: <your-backend-url>
```

## Authentication

The API uses **JWT (JSON Web Token) authentication** for all protected endpoints. Authentication is based on MetaMask signature verification.

### Authentication Flow

1. **Get Sign Message**: Client requests a message to sign
   ```
   GET /api/auth/message?address=0x...
   ```

2. **Sign with MetaMask**: User signs the message with their private key

3. **Login**: Client sends signature to get JWT token
   ```
   POST /api/auth/login
   {
     "address": "0x...",
     "signature": "0x...",
     "timestamp": 1234567890
   }
   ```

4. **Use Token**: Include token in Authorization header for protected endpoints
   ```
   Authorization: Bearer <jwt_token>
   ```

### Protected Endpoints

All endpoints except `/health` and `/api/contract/info` require authentication. The following endpoints are protected:

- All `/api/patients/*` endpoints
- All `/api/providers/*` endpoints
- All `/api/consent/*` endpoints
- All `/api/requests/*` endpoints
- All `/api/events/*` endpoints
- `/api/user/role`
- `/api/data-types`
- `/api/purposes`

### Development Mode

For development/testing, authentication can be disabled by setting:
```
AUTH_REQUIRED=false
```

**Warning**: Never disable authentication in production!

### Write Operations

Write operations (grant consent, revoke consent, request access, approve/deny requests) are **not** handled via REST API. These operations are performed directly through MetaMask on the frontend by calling the smart contract functions. The backend API is read-only for security and decentralization.

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "blockNumber": 12345,
    "network": "localhost",
    "chainId": 1337
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

## Endpoints

### Health & Info

#### GET /health

Check backend health status.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "patients": 10,
    "providers": 10
  }
}
```

#### GET /api/contract/info

Get contract information.

**Response**:
```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "network": "localhost",
    "chainId": 1337
  }
}
```

### Patients

#### GET /api/patients

Get all patients.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "PAT-000001",
      "walletAddress": "0x...",
      "demographics": { ... },
      "medicalHistory": [ ... ]
    }
  ]
}
```

#### GET /api/patients/:patientId

Get specific patient by ID.

**Path Parameters**:
- `patientId`: Patient ID (e.g., "PAT-000001")

**Response**:
```json
{
  "success": true,
  "data": {
    "patientId": "PAT-000001",
    "walletAddress": "0x...",
    "demographics": { ... },
    "medicalHistory": [ ... ]
  }
}
```

#### GET /api/patients/:patientId/data/:dataType

Get patient data by type (with optional consent checking).

**Path Parameters**:
- `patientId`: Patient ID
- `dataType`: Type of data (e.g., "medical_records", "genetic_data")

**Query Parameters**:
- `providerAddress` (optional): Provider address for consent verification

**Response**:
```json
{
  "success": true,
  "data": { ... },
  "hasConsent": true
}
```

### Providers

#### GET /api/providers

Get all providers.

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "providerId": "PROV-000001",
      "walletAddress": "0x...",
      "organizationName": "...",
      "providerType": "..."
    }
  ]
}
```

#### GET /api/providers/:providerId

Get specific provider by ID.

**Path Parameters**:
- `providerId`: Provider ID (e.g., "PROV-000001")

**Response**:
```json
{
  "success": true,
  "data": {
    "providerId": "PROV-000001",
    "walletAddress": "0x...",
    "organizationName": "..."
  }
}
```

#### GET /api/provider/:providerAddress/consents

Get all consents for a provider.

**Path Parameters**:
- `providerAddress`: Provider wallet address

**Query Parameters**:
- `includeExpired` (optional): Include expired consents (default: false)

#### GET /api/provider/:providerAddress/patients

Get all patients with active consents for a provider.

**Path Parameters**:
- `providerAddress`: Provider wallet address

#### GET /api/provider/:providerAddress/pending-requests

Get all pending access requests created by a provider.

**Path Parameters**:
- `providerAddress`: Provider wallet address

#### GET /api/provider/:providerAddress/patient/:patientId/data

Get patient data for a provider (with consent verification).

**Path Parameters**:
- `providerAddress`: Provider wallet address
- `patientId`: Patient ID

**Query Parameters**:
- `dataType` (optional): Filter by data type

### Consents

#### GET /api/consent/status

Check consent status between patient and provider for a specific data type.

**Query Parameters**:
- `patientAddress` (required): Patient wallet address
- `providerAddress` (required): Provider wallet address
- `dataType` (required): Data type string (e.g., "medical_records")

**Response**:
```json
{
  "success": true,
  "data": {
    "hasConsent": true,
    "consentId": 123,
    "isExpired": false,
    "expirationTime": "2024-12-31T23:59:59.000Z"
  }
}
```

#### GET /api/consent/:consentId

Get consent record by ID.

#### GET /api/consent/patient/:patientAddress

Get all consents for a patient.

#### GET /api/consent/provider/:providerAddress

Get all consents for a provider.

### Access Requests

#### GET /api/requests/:requestId

Get access request by ID.

#### GET /api/requests/patient/:patientAddress

Get all access requests for a patient.

**Path Parameters**:
- `patientAddress`: Patient wallet address

**Query Parameters**:
- `status` (optional): Filter by status ('pending', 'approved', 'denied', 'all') (default: 'all')

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "requestId": 1,
      "requester": "0x...",
      "patientAddress": "0x...",
      "dataTypes": ["medical_records"],
      "purposes": ["treatment"],
      "status": "pending",
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ],
  "metadata": {
    "statusFilter": "all",
    "count": 1
  }
}
```

### User & Data Types

#### GET /api/user/role

Get user role (patient or provider) by wallet address.

**Query Parameters**:
- `address` (required): Wallet address

**Response**:
```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "role": "patient",
    "id": "PAT-000001"
  }
}
```

#### GET /api/data-types

Get all available data types.

**Response**:
```json
{
  "success": true,
  "data": [
    "medical_records",
    "genetic_data",
    "lab_results",
    ...
  ]
}
```

#### GET /api/purposes

Get all available purposes.

**Response**:
```json
{
  "success": true,
  "data": [
    "treatment",
    "research",
    "billing",
    ...
  ]
}
```

### Patient Endpoints

#### GET /api/patient/:patientAddress/consents

Get all consents for a patient.

**Path Parameters**:
- `patientAddress`: Patient wallet address

**Query Parameters**:
- `includeExpired` (optional): Include expired consents (default: false)

#### GET /api/patient/:patientAddress/pending-requests

Get all pending access requests for a patient.

**Path Parameters**:
- `patientAddress`: Patient wallet address

### Authentication Endpoints

#### GET /api/auth/message

Get a message to sign with MetaMask for authentication.

**Query Parameters**:
- `address` (required): Ethereum address

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Sign this message to authenticate...",
    "timestamp": 1234567890
  }
}
```

#### POST /api/auth/login

Authenticate with MetaMask signature and receive JWT token.

**Body**:
```json
{
  "address": "0x...",
  "signature": "0x...",
  "timestamp": 1234567890
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "address": "0x...",
    "expiresIn": "1h"
  }
}
```

#### POST /api/auth/verify

Verify JWT token validity (protected endpoint).

**Headers**:
- `Authorization: Bearer <token>`

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Token is valid",
    "user": {
      "address": "0x..."
    }
  }
}
```

### Events

#### GET /api/events/consent

Query consent events.

**Query Parameters**:
- `patient`: Patient address (indexed)
- `provider`: Provider address (indexed)
- `consentId`: Consent ID (indexed)
- `fromBlock`: Starting block number
- `toBlock`: Ending block number

#### GET /api/events/requests

Query access request events.

**Query Parameters**:
- `patient`: Patient address (indexed)
- `requester`: Requester address (indexed)
- `requestId`: Request ID (indexed)
- `fromBlock`: Starting block number
- `toBlock`: Ending block number

## Error Codes

| Code | Description |
|------|-------------|
| `AUTHENTICATION_REQUIRED` | JWT token required |
| `TOKEN_EXPIRED` | JWT token has expired |
| `INVALID_TOKEN` | Invalid JWT token |
| `ACCESS_DENIED` | User does not have permission to access resource |
| `INVALID_ADDRESS` | Invalid Ethereum address |
| `CONSENT_NOT_FOUND` | Consent ID does not exist |
| `REQUEST_NOT_FOUND` | Request ID does not exist |
| `CONTRACT_ERROR` | Smart contract error |
| `NETWORK_ERROR` | Blockchain network error |
| `VALIDATION_ERROR` | Input validation failed |

## Rate Limiting

Currently not implemented. May be added for production.

## CORS

CORS is enabled for frontend domain. Configure in backend for production.

## Write Operations

**Note**: Write operations (grant consent, revoke consent, request access, approve/deny requests) are **not** handled via REST API. These operations are performed directly through MetaMask on the frontend by calling the smart contract functions. The backend API is read-only for security and decentralization.

## See Also

- [Backend README](../../backend/README.md) - Backend-specific docs
- [Smart Contract Design](../architecture/smart-contract-design.md) - Contract function reference

