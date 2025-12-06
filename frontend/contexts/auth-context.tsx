'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { useWallet } from './wallet-context';
import { getAuthMessage, login, storeToken, getToken, clearToken, isTokenExpired } from '@/lib/auth';
import { toast } from 'sonner';

/**
 * Auth Context - Manages JWT authentication state
 * 
 * Automatically authenticates when wallet connects
 */

interface AuthState {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  token: string | null;
  error: string | null;
}

interface AuthContextType extends AuthState {
  authenticate: () => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { account, getSigner, isConnected } = useWallet();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isAuthenticating: false,
    token: null,
    error: null,
  });
  // Track if wallet has ever been connected (to distinguish between "not yet connected" and "disconnected")
  const hasBeenConnectedRef = useRef(false);
  // Track previous account to detect account changes
  const previousAccountRef = useRef<string | null>(null);

  /**
   * Check for existing valid token on mount and when wallet connects
   */
  useEffect(() => {
    // Only check token if wallet is connected or we're checking on initial mount
    const existingToken = getToken();
    if (existingToken && !isTokenExpired()) {
      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        token: existingToken,
      }));
    } else if (existingToken) {
      // Token expired, clear it
      clearToken();
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        token: null,
      }));
    }
  }, [account, isConnected]); // Re-check when wallet connects

  /**
   * Authenticate with MetaMask signature
   */
  const authenticate = useCallback(async () => {
    if (!account || !isConnected) {
      setState((prev) => ({
        ...prev,
        error: 'Wallet not connected',
      }));
      return;
    }

    // Check if we already have a valid token
    const existingToken = getToken();
    if (existingToken && !isTokenExpired()) {
      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        token: existingToken,
        error: null,
      }));
      return;
    }

    // Don't authenticate if already authenticating
    if (state.isAuthenticating) {
      return;
    }

    setState((prev) => ({
      ...prev,
      isAuthenticating: true,
      error: null,
    }));

    try {
      // Step 1: Get message to sign
      const { message, timestamp } = await getAuthMessage(account);

      // Step 2: Sign message with MetaMask
      const signer = await getSigner();
      if (!signer) {
        throw new Error('Failed to get signer');
      }

      const signature = await signer.signMessage(message);

      // Step 3: Login and get JWT token
      const authToken = await login(account, signature, message, timestamp);

      // Step 4: Store token
      storeToken(authToken.token, authToken.expiresIn);

      setState({
        isAuthenticated: true,
        isAuthenticating: false,
        token: authToken.token,
        error: null,
      });

      // Don't show toast on automatic authentication
      // Only show on manual authentication attempts
    } catch (error) {
      console.error('Authentication error:', error);
      clearToken();
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      
      setState({
        isAuthenticated: false,
        isAuthenticating: false,
        token: null,
        error: errorMessage,
      });

      // Only show toast for actual errors (not silent failures)
      if (errorMessage.includes('User rejected') || errorMessage.includes('denied')) {
        // User rejected signature, don't show error
        return;
      }
      
      // For other errors, show toast
      toast.error(`Authentication failed: ${errorMessage}`);
    }
  }, [account, isConnected, getSigner, state.isAuthenticating]);

  /**
   * Refresh authentication (re-authenticate)
   */
  const refreshAuth = useCallback(async () => {
    clearToken();
    await authenticate();
  }, [authenticate]);

  /**
   * Logout and clear token
   */
  const logout = useCallback(() => {
    clearToken();
    setState({
      isAuthenticated: false,
      isAuthenticating: false,
      token: null,
      error: null,
    });
  }, []);

  /**
   * Automatically authenticate when wallet connects (only if no valid token exists)
   */
  useEffect(() => {
    // Check if we already have a valid token first
    const existingToken = getToken();
    if (existingToken && !isTokenExpired()) {
      // We have a valid token, don't re-authenticate
      return;
    }

    // Only authenticate if wallet is connected and we don't have a valid token
    if (account && isConnected && !state.isAuthenticated && !state.isAuthenticating) {
      // Small delay to ensure wallet is fully connected
      const timer = setTimeout(() => {
        authenticate();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [account, isConnected, state.isAuthenticated, state.isAuthenticating, authenticate]);

  /**
   * Detect account changes and clear token + re-authenticate
   */
  useEffect(() => {
    // Skip on initial mount (when previousAccountRef is null)
    if (previousAccountRef.current === null) {
      previousAccountRef.current = account;
      return;
    }

    // Account changed to a different address
    if (account && previousAccountRef.current && account.toLowerCase() !== previousAccountRef.current.toLowerCase()) {
      console.log('[AuthContext] Account changed, clearing token and re-authenticating');
      // Clear old token
      clearToken();
      setState({
        isAuthenticated: false,
        isAuthenticating: false,
        token: null,
        error: null,
      });
      // Update previous account
      previousAccountRef.current = account;
      // Re-authenticate with new account (will be handled by auto-authenticate effect)
      return;
    }

    // Account disconnected
    if (!account && previousAccountRef.current) {
      console.log('[AuthContext] Account disconnected, clearing token');
      clearToken();
      setState({
        isAuthenticated: false,
        isAuthenticating: false,
        token: null,
        error: null,
      });
      previousAccountRef.current = null;
      hasBeenConnectedRef.current = false;
      return;
    }

    // Account connected (first time or after disconnect)
    if (account && !previousAccountRef.current) {
      previousAccountRef.current = account;
      hasBeenConnectedRef.current = true;
    }
  }, [account, isConnected]);

  /**
   * Check token expiration periodically
   */
  useEffect(() => {
    if (!state.token) return;

    const checkExpiration = () => {
      if (isTokenExpired()) {
        clearToken();
        setState((prev) => ({
          ...prev,
          isAuthenticated: false,
          token: null,
        }));
        // Re-authenticate if wallet is still connected
        if (account && isConnected) {
          authenticate();
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkExpiration, 60 * 1000);
    return () => clearInterval(interval);
  }, [state.token, account, isConnected, authenticate]);

  const value: AuthContextType = {
    ...state,
    authenticate,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

