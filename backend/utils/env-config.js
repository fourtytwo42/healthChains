/**
 * Environment Configuration Utility
 * 
 * Detects the current environment and returns the appropriate
 * API and RPC endpoints for the backend.
 */

/**
 * Get the RPC URL based on environment variables
 * - If RPC_URL is set, use it
 * - Otherwise, check NODE_ENV or custom env vars to determine production vs local
 * - Production (app.qrmk.us) → https://rpc.qrmk.us
 * - Local → http://127.0.0.1:8545
 */
function getRpcUrl() {
  // If RPC_URL is explicitly set, use it
  if (process.env.RPC_URL) {
    return process.env.RPC_URL;
  }

  // Check if we're in production mode
  // You can set PRODUCTION=true or NODE_ENV=production
  const isProduction = process.env.PRODUCTION === 'true' || 
                       process.env.NODE_ENV === 'production' ||
                       process.env.ENVIRONMENT === 'production';

  // Check if we're behind the Cloudflare tunnel
  // You can set CLOUDFLARE_TUNNEL=true or check for specific hostname
  const isCloudflareTunnel = process.env.CLOUDFLARE_TUNNEL === 'true' ||
                              process.env.API_DOMAIN === 'api.qrmk.us';

  if (isProduction || isCloudflareTunnel) {
    return 'https://rpc.qrmk.us';
  }

  // Default to localhost
  return 'http://127.0.0.1:8545';
}

/**
 * Get the API base URL (for CORS and other purposes)
 * - Local → http://localhost:3001
 * - Production → https://api.qrmk.us
 */
function getApiBaseUrl() {
  // If API_BASE_URL is explicitly set, use it
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }

  // Check if we're in production mode
  const isProduction = process.env.PRODUCTION === 'true' || 
                       process.env.NODE_ENV === 'production' ||
                       process.env.ENVIRONMENT === 'production';

  // Check if we're behind the Cloudflare tunnel
  const isCloudflareTunnel = process.env.CLOUDFLARE_TUNNEL === 'true' ||
                              process.env.API_DOMAIN === 'api.qrmk.us';

  if (isProduction || isCloudflareTunnel) {
    return 'https://api.qrmk.us';
  }

  // Default to localhost
  return 'http://localhost:3001';
}

module.exports = {
  getRpcUrl,
  getApiBaseUrl,
};

