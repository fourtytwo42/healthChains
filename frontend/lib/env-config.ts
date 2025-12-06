/**
 * Environment Configuration Utility
 * 
 * Detects the current environment (localhost vs production) and returns
 * the appropriate API and RPC endpoints.
 */

/**
 * Get the API base URL based on the current hostname
 * - localhost/127.0.0.1 → http://localhost:3001
 * - app.qrmk.us → https://api.qrmk.us
 */
export function getApiBaseUrl(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side: use environment variable or default
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  }

  // Client-side: detect from hostname
  const hostname = window.location.hostname.toLowerCase();
  
  // Check for localhost or 127.0.0.1
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
  }
  
  // Check for production domain
  if (hostname === 'app.qrmk.us' || hostname.endsWith('.qrmk.us')) {
    return 'https://api.qrmk.us';
  }
  
  // Default: use environment variable or localhost
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
}

/**
 * Get the RPC URL - always uses Hardhat Remote (rpc.qrmk.us)
 * No longer uses localhost RPC - all connections go through the remote endpoint
 */
export function getRpcUrl(): string {
  // Always use the remote RPC endpoint
  // Can be overridden with environment variable if needed
  return process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.qrmk.us';
}

