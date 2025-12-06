# Environment Configuration

This document explains how the application automatically detects the environment (localhost vs production) and configures API and RPC endpoints accordingly.

## Overview

The application automatically detects whether it's running on localhost or the production domain (`app.qrmk.us`) and uses the appropriate endpoints:

- **Localhost/127.0.0.1**: Uses local API, remote RPC
  - API: `http://localhost:3001`
  - RPC: `https://rpc.qrmk.us` (always uses remote)

- **app.qrmk.us**: Uses Cloudflare tunnel endpoints
  - API: `https://api.qrmk.us`
  - RPC: `https://rpc.qrmk.us` (always uses remote)

**Note**: All RPC connections now use the remote endpoint (`rpc.qrmk.us`) regardless of hostname. The network is always configured as "Hardhat Remote".

## Frontend Configuration

### Automatic Detection

The frontend automatically detects the hostname and uses the appropriate endpoints:

**File: `frontend/lib/env-config.ts`**

```typescript
// Detects hostname and returns appropriate API URL
getApiBaseUrl() → 'http://localhost:3001' or 'https://api.qrmk.us'

// Detects hostname and returns appropriate RPC URL
getRpcUrl() → 'http://127.0.0.1:8545' or 'https://rpc.qrmk.us'
```

### Usage

The following files automatically use the dynamic configuration:

1. **`frontend/lib/api-client.ts`** - API client uses `getApiBaseUrl()`
2. **`frontend/lib/auth.ts`** - Authentication uses `getApiBaseUrl()`
3. **`frontend/lib/network-config.ts`** - Network config uses `getRpcUrl()`

### Environment Variables (Optional)

You can still override the automatic detection using environment variables:

```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

**Note**: If environment variables are set, they take precedence over automatic detection.

## Backend Configuration

### Automatic Detection

The backend uses environment variables to determine the environment:

**File: `backend/utils/env-config.js`**

```javascript
// Detects environment and returns appropriate RPC URL
getRpcUrl() → 'http://127.0.0.1:8545' or 'https://rpc.qrmk.us'
```

### Environment Variables

Set these environment variables to configure the backend:

```env
# .env (backend)

# Option 1: Explicit RPC URL (takes precedence)
RPC_URL=https://rpc.qrmk.us

# Option 2: Use environment detection
PRODUCTION=true
# OR
NODE_ENV=production
# OR
CLOUDFLARE_TUNNEL=true
# OR
API_DOMAIN=api.qrmk.us
```

### Priority Order

1. **`RPC_URL`** - If set, this is used directly (highest priority)
2. **Environment flags** - `PRODUCTION`, `NODE_ENV`, `CLOUDFLARE_TUNNEL`, or `API_DOMAIN`
3. **Default** - Falls back to `http://127.0.0.1:8545`

## CORS Configuration

The backend CORS is configured to allow requests from:

- `localhost` and `127.0.0.1` (any port)
- `app.qrmk.us` and any `*.qrmk.us` subdomain

**File: `backend/server.js`**

```javascript
app.use(cors({
  origin: (origin, callback) => {
    // Allows localhost, 127.0.0.1, and *.qrmk.us
  },
  credentials: true,
}));
```

## Cloudflare Tunnel Setup

When using Cloudflare Tunnel, configure it to route:

- **Frontend**: `app.qrmk.us` → Frontend server (port 3000)
- **Backend API**: `api.qrmk.us` → Backend server (port 3001)
- **RPC**: `rpc.qrmk.us` → Hardhat/Blockchain node (port 8545)

### Example Cloudflare Tunnel Configuration

```yaml
tunnel: your-tunnel-id
credentials-file: /path/to/credentials.json

ingress:
  # Frontend
  - hostname: app.qrmk.us
    service: http://localhost:3000
  
  # Backend API
  - hostname: api.qrmk.us
    service: http://localhost:3001
  
  # RPC
  - hostname: rpc.qrmk.us
    service: http://localhost:8545
  
  # Catch-all
  - service: http_status:404
```

## Testing

### Local Development

1. Start Hardhat node: `npm run node` (in backend directory)
2. Deploy contract: `npm run deploy`
3. Start backend: `npm start` (in backend directory)
4. Start frontend: `npm run dev` (in frontend directory)
5. Access: `http://localhost:3000`

The app will automatically use:
- API: `http://localhost:3001`
- RPC: `http://127.0.0.1:8545`

### Production Testing

1. Set environment variables on the server:
   ```bash
   export PRODUCTION=true
   export CLOUDFLARE_TUNNEL=true
   ```

2. Or set in `backend/.env`:
   ```env
   PRODUCTION=true
   CLOUDFLARE_TUNNEL=true
   ```

3. Restart backend: `pm2 restart healthchains-backend`

4. Access: `https://app.qrmk.us`

The app will automatically use:
- API: `https://api.qrmk.us`
- RPC: `https://rpc.qrmk.us`

## Troubleshooting

### Frontend not connecting to API

1. Check browser console for errors
2. Verify the hostname detection:
   ```javascript
   console.log('Hostname:', window.location.hostname);
   console.log('API URL:', getApiBaseUrl());
   ```

### Backend not connecting to RPC

1. Check backend logs:
   ```bash
   pm2 logs healthchains-backend
   ```

2. Verify RPC URL:
   ```javascript
   // In backend/utils/env-config.js, add logging:
   console.log('RPC URL:', getRpcUrl());
   ```

3. Test RPC connection:
   ```bash
   curl -X POST https://rpc.qrmk.us \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
   ```

### CORS Errors

1. Verify the origin is allowed in `backend/server.js`
2. Check browser console for CORS error details
3. Ensure `credentials: true` is set in CORS config

## Migration Notes

If you're migrating from static configuration:

1. **Frontend**: No changes needed - automatic detection works immediately
2. **Backend**: Set `RPC_URL` environment variable or use production flags
3. **PM2**: Update `ecosystem.config.js` if needed (optional)

The application is backward compatible - existing environment variables still work.

