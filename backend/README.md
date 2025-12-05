# Backend Server - Healthcare Blockchain Integration

## Overview

Express.js backend server with Web3 integration for the Healthcare Blockchain Assessment. Provides REST API endpoints for patient/provider data and blockchain-based consent management.

## Features

- **REST API** for patient and provider data
- **Web3 Integration** using ethers.js v6 (read-only operations)
- **Consent Management** endpoints for blockchain data queries
- **Event Querying** for consent and access request events
- **Comprehensive Error Handling** with structured error responses
- **Input Validation** for all endpoints
- **Comprehensive Testing** (unit and integration tests)

**Note**: The backend performs **read-only** blockchain operations. Write operations (grant, revoke, approve, deny) are handled directly by the frontend via MetaMask signing. This follows Web3 best practices where users control their own transactions.

## Project Structure

```
backend/
├── services/              # Business logic services
│   ├── web3Service.js    # Web3 provider and contract initialization
│   └── consentService.js # Consent management service
├── routes/               # Express route handlers
│   └── consentRoutes.js # Consent management routes
├── middleware/           # Express middleware
│   ├── validation.js     # Input validation middleware
│   └── errorHandler.js  # Error handling middleware
├── utils/                # Utility functions
│   ├── errors.js        # Custom error classes
│   └── addressUtils.js  # Address validation/normalization
├── test/                 # Test files
│   ├── services/        # Unit tests for services
│   └── integration/     # Integration tests for routes
├── contracts/            # Solidity smart contracts
├── data/                # Mockup data files (read-only)
├── scripts/              # Deployment scripts
├── server.js            # Main Express server
└── package.json         # Dependencies and scripts
```

## Prerequisites

- Node.js v18 or higher
- npm or yarn
- Hardhat (for contract deployment)
- Local Hardhat node running on `http://127.0.0.1:8545`

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**

Create a `.env` file in the `backend/` directory (see `.env.example` for template):

```bash
# Blockchain RPC Configuration
RPC_URL=http://127.0.0.1:8545

# Contract Address (optional - loads from deployment.json if not set)
CONTRACT_ADDRESS=

# Network identifier
NETWORK_NAME=localhost

# Logging Configuration
LOG_LEVEL=info

# RPC Request Configuration
REQUEST_TIMEOUT=30000
MAX_RETRIES=3

# Server Configuration
PORT=3001
```

## Running the Server

### 1. Start Local Blockchain

In a separate terminal, start Hardhat local node:

```bash
npx hardhat node
```

This starts a local blockchain on `http://127.0.0.1:8545`

### 2. Deploy Smart Contract

In a new terminal:

```bash
npm run deploy:local
```

This deploys the contract and saves the address to `deployment.json`

### 3. Start Backend Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3001` and automatically:
- Load mockup patient and provider data
- Initialize Web3 service and connect to blockchain
- Load contract ABI and create contract instance

## Testing

### Run All Tests

```bash
# Run contract tests
npm run test:contract

# Run backend tests (unit + integration)
npm run test:backend

# Run all tests
npm run test:all
```

### Test Structure

- **Unit Tests** (`test/services/`): Test service functions with mocked dependencies
- **Integration Tests** (`test/integration/`): Test API endpoints against real Hardhat network

### Test Coverage

Tests cover:
- ✅ All service functions
- ✅ All API endpoints
- ✅ Error handling and validation
- ✅ Edge cases and boundary conditions
- ✅ Event querying
- ✅ Data transformation (BigInt, addresses, timestamps)

## API Documentation

See [API.md](./API.md) for complete API documentation including:
- All available endpoints
- Request/response formats
- Error codes
- Query parameters
- Example requests

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RPC_URL` | Blockchain RPC endpoint | `http://127.0.0.1:8545` |
| `CONTRACT_ADDRESS` | Deployed contract address | Loads from `deployment.json` |
| `NETWORK_NAME` | Network identifier | `localhost` |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `REQUEST_TIMEOUT` | RPC request timeout (ms) | `30000` |
| `MAX_RETRIES` | Maximum RPC retries | `3` |
| `PORT` | Server port | `3001` |

## Key Endpoints

### Consent Management

- `GET /api/consent/status` - Check consent status
- `GET /api/consent/:consentId` - Get consent record
- `GET /api/consent/patient/:patientAddress` - Get patient consents
- `GET /api/consent/provider/:providerAddress` - Get provider consents

### Access Requests

- `GET /api/requests/:requestId` - Get access request
- `GET /api/requests/patient/:patientAddress` - Get patient requests

### Event Queries

- `GET /api/events/consent` - Query consent events
- `GET /api/events/requests` - Query access request events

See [API.md](./API.md) for complete documentation.

## Architecture

### Web3 Service (`services/web3Service.js`)

Centralized service for blockchain interactions:
- Initializes ethers.js provider
- Loads contract ABI from compiled artifacts
- Loads contract address from `deployment.json` or environment
- Provides connection health checks
- Handles connection errors and retries

### Consent Service (`services/consentService.js`)

High-level service wrapping contract interactions:
- Consent operations (status, records, history)
- Access request operations
- Event querying
- Data transformation (BigInt → string, address normalization, timestamp formatting)

### Validation Middleware (`middleware/validation.js`)

Reusable validation functions:
- Ethereum address validation
- Numeric ID validation
- Data type and purpose validation
- Block range validation

### Error Handling (`middleware/errorHandler.js`)

Centralized error handling:
- Maps custom errors to HTTP status codes
- Sanitizes error messages for clients
- Logs full error details server-side
- Handles Web3/contract errors gracefully

## Security Considerations

- ✅ **No private keys in code** - All secrets via environment variables
- ✅ **Read-only operations** - Backend performs read operations only (no write transactions)
- ✅ **No user private keys** - Users sign transactions directly via MetaMask in frontend
- ✅ **Input validation** - All user inputs validated and sanitized
- ✅ **Error sanitization** - Internal errors not exposed to clients
- ✅ **Connection resilience** - RPC failures handled with retries
- ✅ **Block range limits** - Prevents DoS from large queries
- ✅ **Request timeouts** - Prevents hanging requests

**Architecture**: The backend never signs user transactions. All write operations are handled by the frontend with MetaMask, ensuring users maintain full control of their private keys.

## Development

### Code Style

Follow the patterns established in:
- `.cursor/rules/backend-best-practices.mdc` - Backend best practices
- `.cursor/rules/solidity-best-practices.mdc` - Solidity best practices

### Adding New Endpoints

1. Add route handler in `routes/consentRoutes.js`
2. Add service method in `services/consentService.js` if needed
3. Add validation middleware if needed
4. Write tests (unit + integration)
5. Update `API.md` documentation

### Debugging

Set `LOG_LEVEL=debug` in `.env` for verbose logging:

```bash
LOG_LEVEL=debug npm run dev
```

## Troubleshooting

### Web3 Service Not Initializing

- Ensure Hardhat node is running: `npx hardhat node`
- Check `RPC_URL` in `.env` matches Hardhat node URL
- Verify contract is deployed: `npm run deploy:local`
- Check `deployment.json` exists and has valid address

### Contract Calls Failing

- Verify contract is deployed and address is correct
- Check contract ABI is compiled: `npm run compile:contract`
- Ensure contract address in `deployment.json` matches deployed address
- Check RPC connection: `GET /api/contract/info`

### Tests Failing

- Ensure Hardhat node is running for integration tests
- Check contract is deployed before running integration tests
- Verify all dependencies are installed: `npm install`

## Deployment

### Production Considerations

1. **Environment Variables**: Set all required environment variables
2. **RPC Endpoint**: Use production RPC endpoint (Infura, Alchemy, etc.)
3. **Contract Address**: Set `CONTRACT_ADDRESS` environment variable
4. **Rate Limiting**: Consider implementing rate limiting for public endpoints
5. **Authentication**: Implement authentication for production
6. **HTTPS**: Use HTTPS for all API endpoints
7. **Monitoring**: Set up monitoring and logging
8. **Error Tracking**: Implement error tracking (Sentry, etc.)

## License

MIT

