# PM2 Setup Guide

## Overview

Both backend and frontend services are managed by PM2 for process management, auto-restart, and logging.

## Current Status

Check status:
```bash
pm2 list
```

View logs:
```bash
pm2 logs                    # All services
pm2 logs healthchains-backend
pm2 logs healthchains-frontend
```

## Services

### Backend (`healthchains-backend`)
- **Port**: 3001
- **Script**: `backend/server.js`
- **Status**: Running
- **Logs**: `backend/logs/backend-out.log` and `backend/logs/backend-error.log`

### Frontend (`healthchains-frontend`)
- **Port**: 3000
- **Script**: `npm start` (Next.js production server)
- **Status**: Running
- **Logs**: `frontend/logs/frontend-out.log` and `frontend/logs/frontend-error.log`

## Commands

### Start Services
```bash
pm2 start ecosystem.config.js
```

### Stop Services
```bash
pm2 stop all
# Or individually:
pm2 stop healthchains-backend
pm2 stop healthchains-frontend
```

### Restart Services
```bash
pm2 restart all
# Or individually:
pm2 restart healthchains-backend
pm2 restart healthchains-frontend
```

### View Status
```bash
pm2 status
pm2 info healthchains-backend
pm2 info healthchains-frontend
```

### View Logs
```bash
pm2 logs                    # All services (live)
pm2 logs --lines 50         # Last 50 lines
pm2 logs healthchains-backend --lines 100
```

### Monitor
```bash
pm2 monit                   # Real-time monitoring dashboard
```

### Save Configuration
```bash
pm2 save                    # Save current process list
```

### Auto-start on Boot
```bash
pm2 startup                 # Generate startup script
pm2 save                    # Save current process list
```

## Environment Variables

Edit `ecosystem.config.js` to set environment variables, or use `.env` files:

### Backend Environment
- `RPC_URL` - Blockchain RPC endpoint (default: `http://127.0.0.1:8545`)
- `CONTRACT_ADDRESS` - Contract address (optional, loads from deployment.json)
- `NETWORK_NAME` - Network identifier (default: `localhost`)
- `PORT` - Server port (default: `3001`)

### Frontend Environment
- `NEXT_PUBLIC_API_BASE_URL` - Backend API URL (default: `http://localhost:3001`)
- `NEXT_PUBLIC_CHAIN_ID` - Expected chain ID (default: `1337`)

## Prerequisites

Before starting services with PM2:

1. **Hardhat Node**: Must be running
   ```bash
   cd backend
   npx hardhat node
   ```

2. **Contract Deployed**: Contract must be deployed
   ```bash
   cd backend
   npm run deploy:local
   ```

3. **Contract ABI**: Frontend needs ABI file
   ```bash
   cp backend/artifacts/contracts/PatientConsentManager.sol/PatientConsentManager.json \
      frontend/public/contract-abi.json
   ```

4. **Frontend Built**: Frontend must be built
   ```bash
   cd frontend
   npm run build
   ```

## Troubleshooting

### Service Not Starting

1. Check logs:
   ```bash
   pm2 logs --err
   ```

2. Check if ports are in use:
   ```bash
   lsof -i :3000  # Frontend
   lsof -i :3001  # Backend
   ```

3. Verify prerequisites (Hardhat node, contract deployed, ABI copied)

### Service Crashing

1. Check error logs:
   ```bash
   pm2 logs healthchains-backend --err
   pm2 logs healthchains-frontend --err
   ```

2. Check restart count:
   ```bash
   pm2 list
   ```

3. Increase memory limit in `ecosystem.config.js` if needed

### Backend Can't Connect to Blockchain

- Ensure Hardhat node is running: `npx hardhat node`
- Check `RPC_URL` in environment
- Verify contract is deployed

### Frontend Can't Load Contract ABI

- Ensure `frontend/public/contract-abi.json` exists
- Rebuild frontend: `cd frontend && npm run build`
- Restart PM2: `pm2 restart healthchains-frontend`

## Health Checks

### Backend
```bash
curl http://localhost:3001/health
```

### Frontend
```bash
curl http://localhost:3000
```

## Production Considerations

1. **Environment Variables**: Set all required env vars in `ecosystem.config.js` or `.env` files
2. **Log Rotation**: Configure log rotation for production
3. **Monitoring**: Set up monitoring (PM2 Plus, or external monitoring)
4. **SSL/HTTPS**: Use reverse proxy (nginx) for HTTPS in production
5. **Resource Limits**: Adjust `max_memory_restart` based on server capacity

