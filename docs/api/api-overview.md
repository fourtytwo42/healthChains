# API Overview

The HealthChains backend provides a REST API for querying blockchain data and patient/provider information.

## Base URL

```
Development: http://localhost:3001
Production: <your-backend-url>
```

## Authentication

Currently, the API does not require authentication for read operations. Write operations are handled directly through MetaMask on the frontend.

**Future**: API authentication may be added for production deployments.

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

#### GET /api/patients/:id

Get specific patient by ID.

#### GET /api/patients/address/:address

Get patient by wallet address.

### Providers

#### GET /api/providers

Get all providers.

#### GET /api/providers/:id

Get specific provider by ID.

#### GET /api/providers/address/:address

Get provider by wallet address.

### Consents

#### GET /api/consent/status

Check consent status.

**Query Parameters**:
- `patient`: Patient address
- `provider`: Provider address
- `dataType`: Data type hash
- `purpose`: Purpose hash

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

Get all requests for a patient.

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

## See Also

- [Endpoints Reference](endpoints.md) - Complete endpoint documentation
- [Error Handling](error-handling.md) - Error codes and handling
- [Backend README](../../backend/README.md) - Backend-specific docs

