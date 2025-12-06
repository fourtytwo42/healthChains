# RPC Connection Issues Troubleshooting

## Overview

This document helps troubleshoot RPC (Remote Procedure Call) connection issues with the HealthChains application.

## Current Configuration

### RPC Endpoints

- **Localhost** (`127.0.0.1:3000` or `localhost:3000`):
  - Frontend uses: `http://127.0.0.1:8545` (local Hardhat node)
  - Backend uses: `http://127.0.0.1:8545` (local Hardhat node)

- **Production** (`app.qrmk.us`):
  - Frontend uses: `https://rpc.qrmk.us` (Cloudflare tunnel)
  - Backend uses: `https://rpc.qrmk.us` (Cloudflare tunnel)
  - Tunnel target: `http://192.168.50.242:8545`

## Common Issues

### Issue 1: "RPC endpoint returned too many errors"

**Symptoms:**
- MetaMask shows: "RPC endpoint returned too many errors, retrying in X minutes"
- Transactions fail
- Cannot fetch chain ID

**Causes:**
1. RPC endpoint is down or unreachable
2. Tunnel is not working (502 Bad Gateway)
3. Hardhat node is not running
4. Network connectivity issues

**Solutions:**

#### For Localhost:
1. **Check if Hardhat node is running:**
   ```bash
   ps aux | grep hardhat
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
     http://127.0.0.1:8545
   ```

2. **If not running, start it:**
   ```bash
   cd backend
   npm run node
   ```

3. **Verify it's listening:**
   ```bash
   netstat -tlnp | grep 8545
   # Should show: 127.0.0.1:8545
   ```

#### For Production (rpc.qrmk.us):
1. **Check tunnel status:**
   - Verify Cloudflare tunnel is running
   - Check tunnel logs for connection errors
   - Ensure tunnel target (`192.168.50.242:8545`) is accessible

2. **Verify target RPC node:**
   ```bash
   # From the server running the tunnel
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
     http://192.168.50.242:8545
   ```

3. **Check if Hardhat node on target machine is:**
   - Running
   - Listening on all interfaces (not just localhost)
   - Accessible from the tunnel server

### Issue 2: "Could not fetch chain ID"

**Symptoms:**
- MetaMask cannot determine the network
- Network switching fails
- Error: "RPC endpoint could not fetch chain ID"

**Causes:**
- RPC endpoint is completely unreachable
- Network timeout
- CORS issues (unlikely for RPC)

**Solutions:**
1. **Test RPC endpoint directly:**
   ```bash
   # For localhost
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
     http://127.0.0.1:8545
   
   # For production
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
     https://rpc.qrmk.us
   ```

2. **Check network connectivity:**
   - Firewall rules
   - Network routing
   - DNS resolution

### Issue 3: ETH Balance Not Updating

**Symptoms:**
- MetaMask shows old balance
- Balance doesn't reflect transactions
- "Still connecting to Hardhat" message

**Causes:**
- RPC endpoint is slow or timing out
- Too many RPC requests causing rate limiting
- Network connection issues

**Solutions:**
1. **Check RPC response time:**
   ```bash
   time curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x...","latest"],"id":1}' \
     http://127.0.0.1:8545
   ```

2. **Reduce RPC request frequency:**
   - Check for excessive polling in the frontend
   - Implement request debouncing
   - Use React Query's `staleTime` to cache responses

3. **Check Hardhat node logs:**
   - Look for errors or warnings
   - Check if node is processing requests

## Configuration Files

### Frontend RPC Configuration

**File:** `frontend/lib/env-config.ts`

```typescript
export function getRpcUrl(): string {
  // Override with environment variable if set
  if (process.env.NEXT_PUBLIC_RPC_URL) {
    return process.env.NEXT_PUBLIC_RPC_URL;
  }

  // Auto-detect based on hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:8545';
    }
    
    if (hostname === 'app.qrmk.us' || hostname.endsWith('.qrmk.us')) {
      return 'https://rpc.qrmk.us';
    }
  }
  
  return 'https://rpc.qrmk.us'; // Default
}
```

### Backend RPC Configuration

**File:** `backend/utils/env-config.js`

```javascript
function getRpcUrl() {
  if (process.env.RPC_URL) {
    return process.env.RPC_URL;
  }

  const isProduction = process.env.PRODUCTION === 'true' || 
                       process.env.NODE_ENV === 'production';
  const isCloudflareTunnel = process.env.CLOUDFLARE_TUNNEL === 'true' ||
                              process.env.API_DOMAIN === 'api.qrmk.us';

  if (isProduction || isCloudflareTunnel) {
    return 'https://rpc.qrmk.us';
  }

  return 'http://127.0.0.1:8545';
}
```

## Environment Variables

### Frontend (.env.local)

```env
# Override RPC URL (optional)
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545

# Network configuration
NEXT_PUBLIC_NETWORK_NAME=Hardhat
NEXT_PUBLIC_CHAIN_ID=1337
```

### Backend (.env)

```env
# Override RPC URL (optional)
RPC_URL=http://127.0.0.1:8545

# Production flags
PRODUCTION=true
CLOUDFLARE_TUNNEL=true
API_DOMAIN=api.qrmk.us
```

## Testing RPC Connectivity

### Test Script

```bash
#!/bin/bash

# Test localhost RPC
echo "Testing localhost RPC..."
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  http://127.0.0.1:8545

echo -e "\n\nTesting production RPC..."
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  https://rpc.qrmk.us
```

### Expected Responses

**Success:**
```json
{"jsonrpc":"2.0","id":1,"result":"0x539"}
```

**Failure (502 Bad Gateway):**
```
error code: 502
```

**Failure (Connection Refused):**
```
curl: (7) Failed to connect to 192.168.50.242 port 8545
```

## Hardhat Node Setup

### Starting Hardhat Node

```bash
cd backend
npm run node
```

### Making Hardhat Node Accessible on Network

By default, Hardhat node only listens on `127.0.0.1`. To make it accessible on the network:

1. **Option 1: Use hostname flag**
   ```bash
   npx hardhat node --hostname 0.0.0.0
   ```

2. **Option 2: Update hardhat.config.js**
   ```javascript
   networks: {
     hardhat: {
       hostname: "0.0.0.0" // Listen on all interfaces
     }
   }
   ```

3. **Option 3: Use reverse proxy/port forwarding**

## Cloudflare Tunnel Setup

### Tunnel Configuration

The tunnel `rpc.qrmk.us` should point to:
- **Target:** `http://192.168.50.242:8545`
- **Protocol:** HTTP
- **Type:** Public hostname

### Verifying Tunnel

1. **Check tunnel status:**
   ```bash
   cloudflared tunnel info rpc-tunnel
   ```

2. **Test tunnel endpoint:**
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
     https://rpc.qrmk.us
   ```

3. **Check tunnel logs:**
   ```bash
   cloudflared tunnel logs rpc-tunnel
   ```

## Quick Fixes

### For Localhost Issues

1. **Restart Hardhat node:**
   ```bash
   pkill -f "hardhat node"
   cd backend && npm run node
   ```

2. **Clear browser cache and MetaMask network:**
   - Remove "Hardhat" network from MetaMask
   - Clear browser cache
   - Re-add network

3. **Check PM2 services:**
   ```bash
   pm2 list
   pm2 restart healthchains-backend
   pm2 restart healthchains-frontend
   ```

### For Production Issues

1. **Check tunnel server:**
   - Verify tunnel process is running
   - Check tunnel configuration
   - Verify target RPC node is accessible

2. **Check target RPC node:**
   - Verify Hardhat node is running on `192.168.50.242:8545`
   - Check firewall rules
   - Verify network connectivity

3. **Restart services:**
   ```bash
   # On tunnel server
   systemctl restart cloudflared
   
   # On RPC node server
   systemctl restart hardhat-node
   ```

## Debugging Steps

1. **Check RPC endpoint directly:**
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
     <RPC_URL>
   ```

2. **Check browser console:**
   - Look for RPC errors
   - Check network tab for failed requests
   - Verify RPC URL being used

3. **Check backend logs:**
   ```bash
   pm2 logs healthchains-backend --lines 50
   ```

4. **Check frontend logs:**
   ```bash
   pm2 logs healthchains-frontend --lines 50
   ```

5. **Verify environment variables:**
   ```bash
   # Frontend
   cat frontend/.env.local
   
   # Backend
   cat backend/.env
   ```

## Prevention

1. **Monitor RPC endpoint health:**
   - Set up health checks
   - Monitor response times
   - Alert on failures

2. **Implement fallback RPC:**
   - Use multiple RPC endpoints
   - Failover logic
   - Retry with exponential backoff

3. **Rate limiting:**
   - Implement request throttling
   - Cache responses
   - Reduce unnecessary requests

4. **Error handling:**
   - User-friendly error messages
   - Automatic retry logic
   - Clear instructions for manual fixes

