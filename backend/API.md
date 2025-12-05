# Backend API Documentation

## Overview

This document describes the REST API endpoints for the Healthcare Blockchain Backend. The API provides **read-only** access to patient and provider data, as well as blockchain-based consent management data.

**Important**: Write operations (grant, revoke, approve, deny) are handled directly by the frontend via MetaMask signing. The backend does not sign user transactions. See [frontend/README.md](../frontend/README.md) for information on direct contract calls.

## Base URL

```
http://localhost:3001/api
```

## Response Format

All API responses follow a consistent structure:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "timestamp": "2025-12-04T...",
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

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `MISSING_PARAMETER` | 400 | Required parameter is missing |
| `INVALID_INPUT` | 400 | Input validation failed |
| `INVALID_ADDRESS` | 400 | Invalid Ethereum address format |
| `INVALID_ID` | 400 | Invalid numeric ID |
| `NOT_FOUND` | 404 | Resource not found |
| `RPC_CONNECTION_FAILED` | 503 | Blockchain connection failed |
| `CONTRACT_ERROR` | 500 | Contract interaction failed |
| `INTERNAL_SERVER_ERROR` | 500 | Internal server error |

## Endpoints

### Health Check

#### GET /health
Check server health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-04T...",
  "data": {
    "patients": 10,
    "providers": 5
  }
}
```

---

### Patient Data

#### GET /api/patients
Get all patients.

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "metadata": { ... }
}
```

#### GET /api/patients/:patientId
Get patient by ID.

**Path Parameters:**
- `patientId` (string, required): Patient identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "patientId": "...",
    "demographics": { ... },
    "medicalHistory": { ... }
  }
}
```

#### GET /api/patients/:patientId/data/:dataType
Get patient data by type.

**Path Parameters:**
- `patientId` (string, required): Patient identifier
- `dataType` (string, required): Type of data (e.g., `medical_records`, `genetic_data`)

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "dataType": "medical_records",
  "patientId": "..."
}
```

---

### Provider Data

#### GET /api/providers
Get all providers.

#### GET /api/providers/:providerId
Get provider by ID.

---

### Consent Management (Web3 - Read-Only)

> **Note**: All endpoints in this section are **read-only**. They query blockchain data but do not modify the blockchain state. Write operations (grant, revoke, approve, deny) are handled directly by the frontend via MetaMask signing.

#### GET /api/consent/status
Check if active consent exists between patient and provider.

**Query Parameters:**
- `patientAddress` (string, required): Ethereum address of patient
- `providerAddress` (string, required): Ethereum address of provider
- `dataType` (string, required): Type of data (e.g., `medical_records`)

**Example Request:**
```
GET /api/consent/status?patientAddress=0x123...&providerAddress=0x456...&dataType=medical_records
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hasConsent": true,
    "consentId": 1,
    "isExpired": false,
    "expirationTime": "2025-12-05T12:00:00.000Z"
  },
  "metadata": {
    "timestamp": "2025-12-04T...",
    "blockNumber": 12345,
    "network": "localhost",
    "chainId": 1337
  }
}
```

#### GET /api/consent/:consentId
Get consent record by ID.

**Path Parameters:**
- `consentId` (number, required): Consent ID

**Response:**
```json
{
  "success": true,
  "data": {
    "consentId": 1,
    "patientAddress": "0x123...",
    "providerAddress": "0x456...",
    "timestamp": "2025-12-04T...",
    "expirationTime": "2025-12-05T...",
    "isActive": true,
    "dataType": "medical_records",
    "purpose": "treatment",
    "isExpired": false
  }
}
```

#### GET /api/consent/patient/:patientAddress
Get all consents for a patient.

**Path Parameters:**
- `patientAddress` (string, required): Ethereum address of patient

**Query Parameters:**
- `includeExpired` (boolean, optional): Include expired consents (default: `false`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "consentId": 1,
      "patientAddress": "0x123...",
      "providerAddress": "0x456...",
      ...
    }
  ],
  "metadata": {
    "count": 5,
    ...
  }
}
```

#### GET /api/consent/provider/:providerAddress
Get all consents for a provider.

**Path Parameters:**
- `providerAddress` (string, required): Ethereum address of provider

**Query Parameters:**
- `includeExpired` (boolean, optional): Include expired consents (default: `false`)

**Note:** Currently returns empty array as contract doesn't expose provider consents directly. Would require event-based querying.

---

### Access Requests (Read-Only)

> **Note**: All endpoints in this section are **read-only**. Write operations (create request, approve, deny) are handled directly by the frontend via MetaMask signing.

#### GET /api/requests/:requestId
Get access request by ID.

**Path Parameters:**
- `requestId` (number, required): Request ID

**Response:**
```json
{
  "success": true,
  "data": {
    "requestId": 1,
    "requester": "0x789...",
    "patientAddress": "0x123...",
    "timestamp": "2025-12-04T...",
    "expirationTime": "2025-12-05T...",
    "isProcessed": false,
    "status": "pending",
    "dataType": "medical_records",
    "purpose": "treatment",
    "isExpired": false
  }
}
```

#### GET /api/requests/patient/:patientAddress
Get all access requests for a patient.

**Path Parameters:**
- `patientAddress` (string, required): Ethereum address of patient

**Query Parameters:**
- `status` (string, optional): Filter by status (`pending`, `approved`, `denied`, `all`) (default: `all`)

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "metadata": {
    "count": 3,
    "statusFilter": "all"
  }
}
```

---

### Event Queries (Read-Only)

> **Note**: These endpoints query blockchain events. They are read-only and do not modify blockchain state.

#### GET /api/events/consent
Query consent events (ConsentGranted, ConsentRevoked).

**Query Parameters:**
- `patientAddress` (string, optional): Filter by patient address
- `fromBlock` (number, optional): Starting block number
- `toBlock` (number, optional): Ending block number (default: latest)

**Constraints:**
- `fromBlock` must be <= `toBlock`
- Block range cannot exceed 10000 blocks

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "ConsentGranted",
      "blockNumber": 100,
      "transactionHash": "0xabc...",
      "consentId": 1,
      "patient": "0x123...",
      "provider": "0x456...",
      "dataType": "medical_records",
      "expirationTime": "2025-12-05T...",
      "purpose": "treatment",
      "timestamp": "2025-12-04T..."
    }
  ],
  "metadata": {
    "count": 10,
    "filters": {
      "patientAddress": "0x123...",
      "fromBlock": 0,
      "toBlock": null
    }
  }
}
```

#### GET /api/events/requests
Query access request events (AccessRequested, AccessApproved, AccessDenied).

**Query Parameters:**
- `patientAddress` (string, optional): Filter by patient address
- `fromBlock` (number, optional): Starting block number
- `toBlock` (number, optional): Ending block number (default: latest)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "type": "AccessRequested",
      "blockNumber": 100,
      "transactionHash": "0xabc...",
      "requestId": 1,
      "requester": "0x789...",
      "patient": "0x123...",
      "dataType": "medical_records",
      "purpose": "treatment",
      "expirationTime": "2025-12-05T...",
      "timestamp": "2025-12-04T..."
    }
  ]
}
```

---

### Contract Information

#### GET /api/contract/info
Get contract deployment information and Web3 connection status.

**Response:**
```json
{
  "success": true,
  "contract": {
    "name": "PatientConsentManager",
    "network": "localhost",
    "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "chainId": 1337,
    "deployed": true
  },
  "deployment": {
    "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "network": "localhost",
    "timestamp": "2025-12-04T..."
  },
  "web3": {
    "connected": true,
    "initialized": true
  }
}
```

---

## Data Types

Available data types for consent and requests:
- `medical_records`
- `diagnostic_data`
- `genetic_data`
- `imaging_data`
- `laboratory_results`
- `prescription_history`
- `vital_signs`
- `treatment_history`

## Purposes

Available purposes for data access:
- `treatment`
- `research`
- `billing`
- `compliance`
- `analytics`

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production deployments.

## Authentication

Currently, no authentication is required. All endpoints are publicly accessible. Consider implementing authentication for production deployments.

## Write Operations (POST/PUT) - DEPRECATED

> **⚠️ IMPORTANT**: These write endpoints are **deprecated**. The frontend now signs transactions directly via MetaMask. These endpoints are kept for backward compatibility but should not be used in production.

### Architecture Change

**Current Architecture (Recommended)**:
- **Reads**: Frontend → Backend API → Smart Contract (read-only)
- **Writes**: Frontend → MetaMask Signer → Smart Contract (direct, user signs)

**Old Architecture (Deprecated)**:
- **Writes**: Frontend → Backend API → Backend Signer → Smart Contract

The old architecture required the backend to have user private keys, which is a security risk. The new architecture follows Web3 best practices where users sign their own transactions via MetaMask.

### Deprecated Endpoints

The following endpoints are deprecated and should not be used:

- `POST /api/consent/grant` - Use direct contract call from frontend
- `PUT /api/consent/:consentId/revoke` - Use direct contract call from frontend
- `POST /api/requests` - Use direct contract call from frontend
- `PUT /api/requests/:requestId/approve` - Use direct contract call from frontend
- `PUT /api/requests/:requestId/deny` - Use direct contract call from frontend

See [frontend/README.md](../frontend/README.md) for information on direct contract calls.

## Examples

### Check Consent Status
```bash
curl "http://localhost:3001/api/consent/status?patientAddress=0x123...&providerAddress=0x456...&dataType=medical_records"
```

### Get Patient Consents
```bash
curl "http://localhost:3001/api/consent/patient/0x123..."
```

### Grant Consent (Deprecated - Use Frontend Direct Contract Call)
```bash
# ⚠️ This endpoint is deprecated. Use frontend MetaMask signing instead.
# See frontend/README.md for direct contract call instructions.
```

### Query Consent Events
```bash
curl "http://localhost:3001/api/events/consent?patientAddress=0x123...&fromBlock=0&toBlock=1000"
```

