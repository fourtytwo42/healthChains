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
- **Redis** (recommended for caching, optional) - See [Redis Setup](#step-6-set-up-redis-recommended-for-caching) below
- **PostgreSQL** (optional, for event indexing) - See [PostgreSQL Setup](#step-7-set-up-postgresql-optional-for-event-indexing) below

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
4. **Automatically copy the ABI to `frontend/public/contract-abi.json`** (wrapped in `{abi: [...]}` format)
5. Display the contract address

**Important**: 
- Note the contract address for configuration
- The ABI is automatically copied to the frontend, so you don't need to manually copy it

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

# PostgreSQL Configuration (for event indexing - optional)
POSTGRES_ENABLED=false  # Set to 'true' to enable PostgreSQL event indexing
POSTGRES_HOST=localhost  # PostgreSQL host
POSTGRES_PORT=5432  # PostgreSQL port
POSTGRES_DATABASE=healthchains_events  # Database name
POSTGRES_USER=healthchains  # Database user
POSTGRES_PASSWORD=healthchains123  # Database password

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

### Step 5: Contract ABI (Automatic)

**The deployment script automatically copies the contract ABI to the frontend**, so you typically don't need to do this manually.

The ABI is copied to `frontend/public/contract-abi.json` in the correct format:
```json
{
  "abi": [...]
}
```

**If you need to manually copy the ABI** (e.g., if deployment script fails or you're updating after a contract change):

```bash
# From project root
cd backend
npx hardhat compile

# Copy ABI to frontend (wrapped in {abi: [...]} format)
cat artifacts/contracts/PatientConsentManager.sol/PatientConsentManager.json | \
  jq '{abi: .abi}' > ../frontend/public/contract-abi.json
```

**Important**: The ABI file must be wrapped in an object with an `abi` property (not just an array), as the frontend expects this structure.

### Step 6: Set Up Redis (Recommended for Caching)

**Redis is optional but highly recommended** for production deployments. It significantly improves performance by caching frequently accessed data.

#### Why Redis?

- **Performance**: Reduces API response times from 200-500ms to 10-50ms
- **Cost Savings**: Reduces blockchain RPC calls (important on mainnet)
- **Scalability**: Handles high request volumes efficiently
- **User Experience**: Faster page loads and interactions

#### Installation

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

#### Configuration

Redis will automatically connect using the default URL (`redis://localhost:6379`). To use a custom Redis instance, set the `REDIS_URL` environment variable:

```env
REDIS_URL=redis://localhost:6379
# Or for remote Redis:
REDIS_URL=redis://username:password@host:port
```

#### What Gets Cached?

- Consent status queries (5-10 minute TTL)
- Consent records (1-2 minute TTL)
- Event queries (30 seconds - 1 minute TTL)
- Patient/provider lookups (longer TTL, invalidated on updates)

#### Graceful Degradation

**Important**: If Redis is not available or fails to connect, the backend will:
- ✅ Continue operating normally
- ✅ Log a warning about Redis unavailability
- ✅ Fall back to direct blockchain queries
- ✅ Return data without caching

This ensures the system remains functional even if Redis is unavailable, making it safe to deploy without Redis for development or testing.

### Step 7: Set Up PostgreSQL (Optional for Event Indexing)

**PostgreSQL is optional** but recommended for production deployments. It provides long-term event caching and significantly improves query performance by only fetching new events from the blockchain.

#### Why PostgreSQL?

- **Performance**: Only queries new events from blockchain (incremental queries)
- **Scalability**: Handles large block ranges efficiently
- **Cost Savings**: Reduces blockchain RPC calls (important on mainnet)
- **Reliability**: Long-term event storage for audit trails

#### Installation

**On Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**On macOS**:
```bash
brew install postgresql
brew services start postgresql
```

**On Windows**:
Download from https://www.postgresql.org/download/windows/ or use WSL.

#### Database Setup

1. **Create database and user**:
```bash
sudo -u postgres psql
```

2. **In PostgreSQL prompt**:
```sql
CREATE DATABASE healthchains_events;
CREATE USER healthchains WITH PASSWORD 'healthchains123';
ALTER DATABASE healthchains_events OWNER TO healthchains;
GRANT ALL PRIVILEGES ON DATABASE healthchains_events TO healthchains;
\q
```

3. **Grant schema permissions** (run as postgres user):
```bash
sudo -u postgres psql -d healthchains_events -c "GRANT ALL ON SCHEMA public TO healthchains;"
```

3. **Verify connection**:
```bash
psql -h localhost -U healthchains -d healthchains_events
# Enter password when prompted
```

#### Configuration

Enable PostgreSQL in your `backend/.env`:

```env
POSTGRES_ENABLED=true
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=healthchains_events
POSTGRES_USER=healthchains
POSTGRES_PASSWORD=healthchains123
```

#### How It Works

When PostgreSQL is enabled:
- **First Run**: Queries all events from block 0 and stores the last processed block
- **Subsequent Runs**: Only queries new events from the last processed block + 1
- **Block Tracking**: Tracks last processed block per event type (ConsentGranted, ConsentRevoked, AccessRequested, etc.)
- **Automatic Schema**: Database schema is automatically created on first connection

**Important**: If PostgreSQL is not enabled or unavailable, the backend will:
- ✅ Continue operating normally
- ✅ Log a warning about PostgreSQL unavailability
- ✅ Fall back to direct blockchain queries (querying from block 0)
- ✅ Return data without event indexing

This ensures the system remains functional even if PostgreSQL is unavailable, making it safe to deploy without PostgreSQL for development or testing.

### Step 8: Start Backend Server

In a **new terminal**:

```bash
cd backend
npm run dev
```

The backend will:
- Start on `http://localhost:3001`
- Load mockup data automatically
- Connect to the Hardhat network
- Connect to Redis (if available, with graceful degradation if not)
- Initialize JWT authentication (if `AUTH_REQUIRED=true`)
- Display all available routes

### Step 9: Start Frontend

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
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL for caching (optional, graceful degradation if unavailable) |
| `POSTGRES_ENABLED` | No | `false` | Enable PostgreSQL event indexing (`true` to enable) |
| `POSTGRES_HOST` | No | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | No | `5432` | PostgreSQL port |
| `POSTGRES_DATABASE` | No | `healthchains_events` | PostgreSQL database name |
| `POSTGRES_USER` | No | `healthchains` | PostgreSQL user |
| `POSTGRES_PASSWORD` | No | `healthchains123` | PostgreSQL password |
| `PRIVATE_KEY` | No | - | Private key for automated operations (not recommended) |
| `LOG_LEVEL` | No | `info` | Logging level (`debug`, `info`, `warn`, `error`). Uses Winston logger with file output to `backend/logs/` |

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
    "providers": 10
  },
  "cache": {
    "enabled": true,
    "connected": true,
    "status": "healthy"
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

