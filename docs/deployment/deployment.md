# Deployment Guide

This guide covers deploying HealthChains to various environments, from local development to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Deployment](#local-development-deployment)
3. [Production Deployment](#production-deployment)
4. [PM2 Process Management](#pm2-process-management)
5. [Environment Configuration](#environment-configuration)
6. [Verification](#verification)

## Prerequisites

Before deploying, ensure you have:

- **Node.js** v18 or higher
- **npm** or **yarn**
- **Hardhat** (for smart contract deployment)
- **MetaMask** (for frontend interactions)
- **PM2** (for production process management) - `npm install -g pm2`
- **Redis** (for caching) - See [Redis Setup](#redis-setup) below

## Local Development Deployment

### Step 1: Install Dependencies

```bash
# Root directory
npm install

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Step 2: Start Hardhat Blockchain

In a terminal, start the local Hardhat network:

```bash
cd backend
npx hardhat node
```

This starts a local Ethereum network on `http://127.0.0.1:8545` with:
- Chain ID: 1337
- Pre-funded accounts (10,000 ETH each)
- Network ID: 31337

**Keep this terminal running** - the blockchain must be running for the application to work.

### Step 3: Deploy Smart Contract

In a **new terminal**, deploy the contract:

```bash
cd backend

# Deploy to Hardhat network
npm run deploy:hardhat

# OR deploy to localhost (if you have a persistent node running)
npm run deploy:local
```

The deployment script will:
1. Compile the contract
2. Deploy to the network
3. Save the contract address to `deployment.json`
4. Display the contract address

**Important**: Note the contract address for configuration.

### Step 4: Configure Environment Variables

#### Backend Configuration

Create `backend/.env` (if not exists):

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Blockchain Configuration
RPC_URL=http://127.0.0.1:8545
NETWORK_NAME=localhost
CHAIN_ID=1337

# Contract Configuration (auto-loaded from deployment.json)
# CONTRACT_ADDRESS is read from deployment.json

# Authentication Configuration
JWT_SECRET=your_jwt_secret_here  # Generate a secure random string
JWT_EXPIRES_IN=1h  # Token expiration time
SIGNATURE_VALIDITY_DURATION=300  # Signature validity in seconds (5 minutes)
AUTH_REQUIRED=true  # Set to 'false' for development/testing without auth

# Redis Configuration (for caching)
REDIS_URL=redis://localhost:6379  # Redis connection URL

# Optional: Private key for automated operations (not recommended for production)
# PRIVATE_KEY=your_private_key_here

# Logging
LOG_LEVEL=info
```

**Important**: Generate a secure JWT_SECRET for production:
```bash
# Generate a secure random secret
openssl rand -hex 32
```

#### Frontend Configuration

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=1337
```

### Step 5: Copy Contract ABI

The frontend needs the contract ABI for direct contract interactions:

```bash
# From project root
cd backend
npx hardhat compile

# Copy ABI to frontend
cat artifacts/contracts/PatientConsentManager.sol/PatientConsentManager.json | \
  jq -r '.abi' | \
  jq '{abi: .}' > ../frontend/public/contract-abi.json
```

Or manually copy the ABI from `backend/artifacts/contracts/PatientConsentManager.sol/PatientConsentManager.json` to `frontend/public/contract-abi.json` with the structure:

```json
{
  "abi": [...]
}
```

### Step 6: Set Up Redis (for Caching)

Redis is used for caching to improve performance. Install and start Redis:

**On Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**On macOS**:
```bash
brew install redis
brew services start redis
```

**On Windows**:
Download from https://redis.io/download or use WSL.

**Verify Redis is running**:
```bash
redis-cli ping
# Should return: PONG
```

**Note**: If Redis is not available, the backend will gracefully degrade and continue operating without caching.

### Step 7: Start Backend Server

In a **new terminal**:

```bash
cd backend
npm run dev
```

The backend will:
- Start on `http://localhost:3001`
- Load mockup data automatically
- Connect to the Hardhat network
- Connect to Redis (if available)
- Display all available routes

### Step 8: Start Frontend

In a **new terminal**:

```bash
cd frontend

# Development mode
npm run dev

# OR build and start production mode
npm run build
npm start
```

The frontend will start on `http://localhost:3000`.

### Step 9: Configure MetaMask

1. **Install MetaMask** browser extension
2. **Add Network**:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `1337`
   - Currency Symbol: `ETH`
3. **Import Test Account**: Use a private key from [Test Accounts](../TEST_ACCOUNTS.md)
4. **Switch to Hardhat Local** network

## Production Deployment

### Architecture Considerations

For production, consider:

1. **Blockchain Network**: Deploy to a production network (Ethereum mainnet, Polygon, Arbitrum)
2. **Infrastructure**: Use cloud providers (AWS, Azure, GCP)
3. **Monitoring**: Set up monitoring and alerting
4. **Backup**: Regular backups of off-chain data
5. **Security**: Secure private keys, environment variables, API keys

### Step 1: Deploy Smart Contract to Production Network

#### Configure Hardhat for Production

Create/update `backend/hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 1337
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 1
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 137
    },
    // ... other networks
  }
};
```

#### Deploy Contract

```bash
cd backend

# Deploy to mainnet
npx hardhat run scripts/deploy.js --network mainnet

# OR deploy to Polygon (recommended for lower gas costs)
npx hardhat run scripts/deploy.js --network polygon
```

**Important**: 
- Store the contract address securely
- Verify contract on Etherscan/Polygonscan
- Test thoroughly on testnets first

### Step 2: Set Up Backend Infrastructure

#### Option A: Server Deployment

```bash
# On your server
git clone <repository>
cd healthChains/backend
npm install --production
npm run build

# Set environment variables
export NODE_ENV=production
export RPC_URL=<your_rpc_url>
export NETWORK_NAME=mainnet
export CHAIN_ID=1
export CONTRACT_ADDRESS=<deployed_contract_address>

# Start with PM2 (see PM2 section below)
pm2 start ecosystem.config.js --only healthchains-backend
```

#### Option B: Container Deployment (Docker)

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ ./

EXPOSE 3001

CMD ["node", "server.js"]
```

Build and run:

```bash
docker build -t healthchains-backend .
docker run -p 3001:3001 \
  -e NODE_ENV=production \
  -e RPC_URL=<rpc_url> \
  -e CONTRACT_ADDRESS=<contract_address> \
  healthchains-backend
```

### Step 3: Set Up Frontend Infrastructure

#### Build for Production

```bash
cd frontend
npm install
npm run build
```

#### Deploy Options

**Option A: Static Hosting (Vercel, Netlify)**

```bash
# Vercel
npm install -g vercel
vercel --prod

# Netlify
npm install -g netlify-cli
netlify deploy --prod
```

**Option B: Server Deployment**

```bash
# On your server
cd frontend
npm install --production
npm run build

# Set environment variables
export NEXT_PUBLIC_API_BASE_URL=<backend_url>
export NEXT_PUBLIC_CHAIN_ID=<chain_id>

# Start with PM2
pm2 start ecosystem.config.js --only healthchains-frontend
```

**Option C: Container Deployment**

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]
```

## PM2 Process Management

### Installation

```bash
npm install -g pm2
```

### Using PM2 Ecosystem File

The project includes `ecosystem.config.js` for managing both backend and frontend:

```bash
# Start all processes
pm2 start ecosystem.config.js

# Start specific process
pm2 start ecosystem.config.js --only healthchains-backend
pm2 start ecosystem.config.js --only healthchains-frontend

# Stop all
pm2 stop all

# Restart all
pm2 restart all

# View status
pm2 list

# View logs
pm2 logs healthchains-backend
pm2 logs healthchains-frontend

# Monitor
pm2 monit

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### PM2 Commands Reference

```bash
# Status
pm2 list
pm2 status

# Logs
pm2 logs [app-name]
pm2 logs --lines 100
pm2 flush  # Clear logs

# Process Management
pm2 restart [app-name]
pm2 reload [app-name]  # Zero-downtime reload
pm2 stop [app-name]
pm2 delete [app-name]

# Monitoring
pm2 monit
pm2 describe [app-name]

# Saving & Startup
pm2 save
pm2 startup  # Generate startup script
```

See [PM2_SETUP.md](../../PM2_SETUP.md) for detailed PM2 setup.

## Environment Configuration

### Backend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Backend server port |
| `NODE_ENV` | Yes | - | `development` or `production` |
| `RPC_URL` | Yes | - | Blockchain RPC endpoint |
| `NETWORK_NAME` | Yes | - | Network name (`localhost`, `mainnet`, `polygon`) |
| `CHAIN_ID` | Yes | - | Chain ID (`1337`, `1`, `137`) |
| `CONTRACT_ADDRESS` | Yes* | - | Deployed contract address (*auto-loaded from deployment.json if not set) |
| `JWT_SECRET` | Yes | - | Secret key for JWT token signing (generate with `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | No | `1h` | JWT token expiration time |
| `SIGNATURE_VALIDITY_DURATION` | No | `300` | MetaMask signature validity in seconds (5 minutes) |
| `AUTH_REQUIRED` | No | `true` | Require JWT authentication (`false` for development) |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL for caching |
| `PRIVATE_KEY` | No | - | Private key for automated operations (not recommended) |
| `LOG_LEVEL` | No | `info` | Logging level (`debug`, `info`, `warn`, `error`) |

### Frontend Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | - | Backend API URL |
| `NEXT_PUBLIC_CHAIN_ID` | Yes | - | Expected blockchain chain ID |

**Note**: `NEXT_PUBLIC_*` variables are exposed to the browser.

## Verification

### Verify Backend Deployment

```bash
# Health check
curl http://localhost:3001/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-...",
  "data": {
    "patients": 10,
    "providers": 10,
    "redis": {
      "connected": true,
      "message": "Redis is up and running"
    }
  }
}

# Check contract info (no auth required)
curl http://localhost:3001/api/contract/info

# Test authentication (requires MetaMask signature)
# 1. Get message to sign
curl "http://localhost:3001/api/auth/message?address=0x..."

# 2. Sign message with MetaMask, then login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"address":"0x...","signature":"0x...","timestamp":1234567890}'
```

### Verify Frontend Deployment

```bash
# Check if frontend is running
curl http://localhost:3000

# Should return HTML (200 status)
```

### Verify Smart Contract

```bash
cd backend

# Verify contract on Etherscan/Polygonscan
npx hardhat verify --network mainnet <CONTRACT_ADDRESS>

# Check contract functions
npx hardhat console --network mainnet
> const contract = await ethers.getContractAt("PatientConsentManager", "<CONTRACT_ADDRESS>")
> await contract.consentCounter()
```

### Verify Integration

1. **Connect MetaMask** to the correct network
2. **Import test account** (if on testnet)
3. **Connect wallet** in frontend
4. **Try basic operations**:
   - Grant consent
   - Request access
   - Approve request
5. **Check blockchain** for transactions
6. **Check events** in frontend Events page

## Troubleshooting

### Backend Won't Start

- Check if port 3001 is available: `lsof -i :3001`
- Verify RPC_URL is accessible
- Check contract address in deployment.json
- Review logs: `pm2 logs healthchains-backend`

### Frontend Won't Connect

- Verify backend is running and accessible
- Check `NEXT_PUBLIC_API_BASE_URL` environment variable
- Check browser console for errors
- Verify contract ABI file exists: `frontend/public/contract-abi.json`

### Contract Deployment Fails

- Verify network RPC URL is correct
- Check deployer account has enough funds for gas
- Verify Solidity compiler version matches
- Review Hardhat network configuration

### MetaMask Connection Issues

- Verify network is added correctly (Chain ID must match)
- Check if MetaMask is unlocked
- Clear browser cache and reload
- Try importing account again

## Next Steps

- [Frontend User Guide](../guides/frontend-usage.md)
- [API Documentation](../api/api-overview.md)
- [Security Best Practices](../security/best-practices.md)

