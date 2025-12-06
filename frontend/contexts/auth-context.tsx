'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { useWallet } from './wallet-context';
import { getAuthMessage, login, storeToken, getToken, clearToken, isTokenExpired } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
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
  // Track if we're currently handling an account change to prevent duplicate authentication
  const isHandlingAccountChangeRef = useRef(false);
  // Track if authentication is in progress (using ref to prevent race conditions)
  const isAuthenticatingRef = useRef(false);

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
      // Clear flag if we had a valid token
      isHandlingAccountChangeRef.current = false;
      return;
    }

    // Don't authenticate if already authenticating
    // Check ref first (atomic check) - this is the primary guard
    // If ref is set, authenticate() is already running
    if (isAuthenticatingRef.current) {
      console.log('[AuthContext] Already authenticating (ref check), skipping duplicate call');
      return;
    }
    
    // If state.isAuthenticating is true but ref isn't, it means we're in the account change flow
    // where state was set to block auto-authenticate effect, but authenticate() hasn't started yet
    // In this case, allow it to proceed - authenticate() will set the ref below

    // Set both state and ref immediately to prevent race conditions
    isAuthenticatingRef.current = true;
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

      // Clear ref first, then update state
      isAuthenticatingRef.current = false;
      setState({
        isAuthenticated: true,
        isAuthenticating: false,
        token: authToken.token,
        error: null,
      });

      // Invalidate all queries to refetch data with new authentication
      // This ensures the page updates automatically after authentication
      // Use a small delay to ensure state is fully updated first
      setTimeout(() => {
        queryClient.invalidateQueries();
        // Also refetch all active queries to ensure immediate update
        queryClient.refetchQueries();
      }, 100);
      
      // Clear the account change flag after successful authentication
      isHandlingAccountChangeRef.current = false;
      
      // Don't show toast on automatic authentication
      // Only show on manual authentication attempts
    } catch (error) {
      console.error('Authentication error:', error);
      clearToken();
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      
      // Clear ref first, then update state
      isAuthenticatingRef.current = false;
      setState({
        isAuthenticated: false,
        isAuthenticating: false,
        token: null,
        error: errorMessage,
      });
      
      // Clear the account change flag on error so user can retry
      isHandlingAccountChangeRef.current = false;

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
   * This effect is skipped if we're handling an account change (to prevent duplicate requests)
   */
  useEffect(() => {
    // Skip if we're handling an account change (that effect will handle authentication)
    if (isHandlingAccountChangeRef.current) {
      return;
    }

    // Check if we already have a valid token first
    const existingToken = getToken();
    if (existingToken && !isTokenExpired()) {
      // We have a valid token, don't re-authenticate
      return;
    }

    // Only authenticate if wallet is connected and we don't have a valid token
    // Also check the flag and ref to prevent duplicate authentication during account changes
    if (account && isConnected && !state.isAuthenticated && !state.isAuthenticating && !isHandlingAccountChangeRef.current && !isAuthenticatingRef.current) {
      // Small delay to ensure wallet is fully connected
      const timer = setTimeout(() => {
        // Double-check the flag and ref haven't changed (account change might have happened during delay)
        if (!isHandlingAccountChangeRef.current && !isAuthenticatingRef.current) {
          authenticate();
        } else {
          console.log('[AuthContext] Auto-authenticate skipped - account change in progress or already authenticating');
        }
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
      
      // Set flag to prevent auto-authenticate effect from also triggering
      isHandlingAccountChangeRef.current = true;
      
      // Clear old token
      clearToken();
      
      // Set isAuthenticating immediately to prevent auto-authenticate effect from triggering
      // Use state to block auto-authenticate effect, but DON'T set the ref yet
      // The ref will be set inside authenticate() when it actually starts
      setState({
        isAuthenticated: false,
        isAuthenticating: true, // Set to true immediately to block auto-authenticate effect
        token: null,
        error: null,
      });
      
      // Update previous account
      previousAccountRef.current = account;
      
      // Re-authenticate with new account after a short delay
      // This ensures the state is fully updated before authentication
      // Keep the flag set until authentication completes (it will be cleared in authenticate())
      setTimeout(async () => {
        try {
          // Clear the ref check temporarily so authenticate() can proceed
          // authenticate() will set it itself when it starts
          await authenticate();
          // Flag is cleared in authenticate() after success
        } catch (error) {
          // Flag is cleared in authenticate() after error
        }
      }, 300);
      
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

  /**
   * Refetch queries when authentication state changes from false to true
   * This ensures data loads automatically after successful authentication
   */
  useEffect(() => {
    if (state.isAuthenticated && state.token) {
      // Authentication just completed, invalidate and refetch all queries
      // This triggers automatic data loading after account change + authentication
      // Use a small delay to ensure state is fully propagated
      setTimeout(() => {
        queryClient.invalidateQueries();
        queryClient.refetchQueries();
      }, 150);
    }
  }, [state.isAuthenticated, state.token, queryClient]);

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

