/**
 * Authentication Service - JWT token management with MetaMask signature
 * 
 * Handles authentication flow: get message, sign with MetaMask, get JWT token
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
const TOKEN_STORAGE_KEY = 'healthchains_jwt_token';
const TOKEN_EXPIRY_KEY = 'healthchains_jwt_expiry';

export interface AuthMessage {
  message: string;
  timestamp: number;
}

export interface AuthToken {
  token: string;
  address: string;
  expiresIn: string;
}

/**
 * Get authentication message from backend
 */
export async function getAuthMessage(address: string): Promise<AuthMessage> {
  const response = await fetch(`${API_BASE_URL}/api/auth/message?address=${encodeURIComponent(address)}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to get auth message');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Login with MetaMask signature and get JWT token
 */
export async function login(address: string, signature: string, message: string, timestamp: number): Promise<AuthToken> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      address,
      signature,
      message,
      timestamp,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Authentication failed');
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Store JWT token in localStorage
 */
export function storeToken(token: string, expiresIn: string): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  
  // Calculate expiry time (expiresIn is like "1h", "24h", etc.)
  const expiryMs = parseExpiresIn(expiresIn);
  const expiryTime = Date.now() + expiryMs;
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
}

/**
 * Get stored JWT token
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  
  // Check if token is expired
  if (token && expiry) {
    const expiryTime = parseInt(expiry, 10);
    if (Date.now() >= expiryTime) {
      // Token expired, remove it
      clearToken();
      return null;
    }
  }
  
  return token;
}

/**
 * Clear stored token
 */
export function clearToken(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(): boolean {
  if (typeof window === 'undefined') return true;
  
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return true;
  
  const expiryTime = parseInt(expiry, 10);
  return Date.now() >= expiryTime;
}

/**
 * Parse expiresIn string (e.g., "1h", "24h", "30m") to milliseconds
 */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    // Default to 1 hour if can't parse
    return 60 * 60 * 1000;
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  
  return value * (multipliers[unit] || 1000);
}

