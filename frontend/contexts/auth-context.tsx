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
      console.log('[AuthContext] authenticate() BLOCKED - ref already set (duplicate call prevented)');
      return;
    }
    
    // If state says authenticating but ref doesn't, we might be in account change flow
    // Allow it to proceed if we're handling account change (explicit call)
    // Otherwise, skip to be safe
    if (state.isAuthenticating && !isHandlingAccountChangeRef.current) {
      console.log('[AuthContext] authenticate() BLOCKED - state.isAuthenticating=true but not handling account change');
      return;
    }
    
    console.log('[AuthContext] authenticate() PROCEEDING - setting ref now');

    // CRITICAL: Set ref FIRST (atomically) to prevent any other calls from proceeding
    // Double-check one more time right before setting (defense in depth against race conditions)
    if (isAuthenticatingRef.current) {
      console.log('[AuthContext] Ref check failed - already authenticating, aborting');
      return;
    }
    
    // Set ref immediately (atomic operation) - this prevents ALL other calls
    isAuthenticatingRef.current = true;
    
    // Update state (only if not already set to avoid unnecessary re-renders)
    if (!state.isAuthenticating) {
      setState((prev) => ({
        ...prev,
        isAuthenticating: true,
        error: null,
      }));
    }

    try {
      console.log('[AuthContext] authenticate() - Step 1: Getting message to sign');
      // Step 1: Get message to sign
      const { message, timestamp } = await getAuthMessage(account);
      console.log('[AuthContext] authenticate() - Step 1 complete, got message');

      // Step 2: Sign message with MetaMask
      console.log('[AuthContext] authenticate() - Step 2: Getting signer');
      const signer = await getSigner();
      if (!signer) {
        throw new Error('Failed to get signer');
      }
      console.log('[AuthContext] authenticate() - Step 2 complete, got signer');
      console.log('[AuthContext] authenticate() - Signer address:', await signer.getAddress());

      // Double-check ref one more time before signing (defense in depth)
      if (!isAuthenticatingRef.current) {
        console.log('[AuthContext] authenticate() - Ref was cleared before signing, aborting');
        return;
      }

      console.log('[AuthContext] authenticate() - Step 3: Requesting signature from MetaMask');
      console.log('[AuthContext] authenticate() - Message to sign:', message.substring(0, 50) + '...');
      const signature = await signer.signMessage(message);
      console.log('[AuthContext] authenticate() - Step 3 complete, got signature:', signature.substring(0, 20) + '...');

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
      console.log('[AuthContext] Auto-authenticate effect skipped - account change in progress');
      return;
    }

    // Skip if already authenticating (ref check)
    if (isAuthenticatingRef.current) {
      console.log('[AuthContext] Auto-authenticate effect skipped - already authenticating (ref)');
      return;
    }

    // Skip if state says authenticating
    if (state.isAuthenticating) {
      console.log('[AuthContext] Auto-authenticate effect skipped - already authenticating (state)');
      return;
    }

    // Check if we already have a valid token first
    const existingToken = getToken();
    if (existingToken && !isTokenExpired()) {
      // We have a valid token, don't re-authenticate
      return;
    }

    // Only authenticate if wallet is connected and we don't have a valid token
    if (account && isConnected && !state.isAuthenticated) {
      console.log('[AuthContext] Auto-authenticate effect setting up timer');
      // Small delay to ensure wallet is fully connected
      const timer = setTimeout(() => {
        // Final check: flag, ref, and state (account change might have happened during delay)
        if (isHandlingAccountChangeRef.current) {
          console.log('[AuthContext] Auto-authenticate timer skipped - account change detected');
          return;
        }
        if (isAuthenticatingRef.current) {
          console.log('[AuthContext] Auto-authenticate timer skipped - already authenticating (ref)');
          return;
        }
        if (state.isAuthenticating) {
          console.log('[AuthContext] Auto-authenticate timer skipped - already authenticating (state)');
          return;
        }
        console.log('[AuthContext] Auto-authenticate timer firing - calling authenticate()');
        authenticate();
      }, 500);

      return () => {
        console.log('[AuthContext] Auto-authenticate timer cleared');
        clearTimeout(timer);
      };
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
      // Prevent duplicate account change handling (React Strict Mode can cause double renders)
      if (isHandlingAccountChangeRef.current) {
        console.log('[AuthContext] Account change already being handled, skipping duplicate');
        previousAccountRef.current = account; // Update ref but don't process again
        return;
      }
      
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
      console.log('[AuthContext] Account change handler - setting up timer to call authenticate()');
      setTimeout(async () => {
        console.log('[AuthContext] Account change handler - timer fired, calling authenticate()');
        try {
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

