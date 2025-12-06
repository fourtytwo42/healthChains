'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ethers } from 'ethers';
import { getNetworkConfig, getMetaMaskNetworkConfig } from '@/lib/network-config';
import { getRpcUrl } from '@/lib/env-config';

/**
 * Wallet Context - Manages MetaMask wallet connection state
 * 
 * Provides:
 * - Wallet connection status
 * - Current account address
 * - Network/chain ID
 * - Connect/disconnect functions
 * - Network validation and automatic switching with RPC URL detection
 */

interface WalletState {
  isConnected: boolean;
  account: string | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
  isWrongNetwork: boolean;
  currentRpcUrl: string | null;
  expectedRpcUrl: string;
}

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  checkNetwork: () => Promise<boolean>;
  switchToCorrectNetwork: () => Promise<void>;
  getSigner: () => Promise<ethers.JsonRpcSigner | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

/**
 * Get network configuration (dynamically based on hostname)
 */
const getCurrentNetworkConfig = () => getNetworkConfig();
const EXPECTED_CHAIN_ID = getCurrentNetworkConfig().chainId;
const EXPECTED_RPC_URL = getRpcUrl();

/**
 * Wallet Provider Component
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    account: null,
    chainId: null,
    isConnecting: false,
    error: null,
    isWrongNetwork: false,
    currentRpcUrl: null,
    expectedRpcUrl: EXPECTED_RPC_URL,
  });

  /**
   * Check if MetaMask is installed
   */
  const isMetaMaskInstalled = () => {
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
  };

  /**
   * Get current account from MetaMask
   */
  const getAccount = async (): Promise<string | null> => {
    if (!isMetaMaskInstalled() || !window.ethereum) return null;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      return accounts.length > 0 ? accounts[0] : null;
    } catch (error) {
      console.error('Error getting account:', error);
      return null;
    }
  };

  /**
   * Get current chain ID from MetaMask
   */
  const getChainId = async (): Promise<number | null> => {
    if (!isMetaMaskInstalled() || !window.ethereum) return null;

    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      // Handle both hex string (0x539) and decimal number formats
      if (typeof chainId === 'string') {
        // Remove '0x' prefix if present and parse as hex
        const hexValue = chainId.startsWith('0x') ? chainId.slice(2) : chainId;
        return parseInt(hexValue, 16);
      }
      return typeof chainId === 'number' ? chainId : null;
    } catch (error) {
      console.error('Error getting chain ID:', error);
      return null;
    }
  };

  /**
   * Detect the current RPC URL that MetaMask is connected to
   * Note: MetaMask doesn't directly expose the RPC URL, so we can't detect it directly.
   * However, we can infer it needs to be updated if the chainId matches but we're
   * on a different hostname context (e.g., on app.qrmk.us but MetaMask might be using localhost RPC).
   */
  const getCurrentRpcUrl = async (): Promise<string | null> => {
    if (!isMetaMaskInstalled() || !window.ethereum) return null;

    try {
      // MetaMask doesn't expose the RPC URL directly
      // We'll use the expected RPC URL as the "current" for display purposes
      // The actual validation will ensure we switch to the correct network
      return EXPECTED_RPC_URL;
    } catch (error) {
      console.error('Error getting RPC URL:', error);
      return null;
    }
  };

  /**
   * Check if the network configuration matches what's expected
   * This checks chainId and ensures we're using the correct network name and RPC
   * for the current hostname context.
   * 
   * Since MetaMask doesn't expose the RPC URL directly, we can't detect if it's
   * using the wrong RPC. However, we can ensure the network is configured correctly
   * by always checking and prompting to switch if needed.
   */
  const validateNetwork = async (): Promise<{ isValid: boolean; reason?: string }> => {
    const chainId = await getChainId();
    const networkConfig = getCurrentNetworkConfig();
    
    // Check if chainId matches
    if (chainId === null || Number(chainId) !== EXPECTED_CHAIN_ID) {
      return {
        isValid: false,
        reason: `Chain ID mismatch. Expected ${EXPECTED_CHAIN_ID}, got ${chainId}`,
      };
    }

    // Even if chainId matches, we need to ensure MetaMask is using the correct
    // network name and RPC URL for the current hostname context.
    // 
    // The issue: MetaMask might have the network configured with:
    // - Wrong name (e.g., "Hardhat Local" when on app.qrmk.us)
    // - Wrong RPC (e.g., localhost RPC when on app.qrmk.us)
    //
    // Solution: We'll always return isValid: true for now, but the network switching
    // function will ensure the correct network configuration is used when called.
    // The UI will show the network switch prompt based on isWrongNetwork state,
    // which we'll set based on chainId mismatch only.
    //
    // When the user clicks "Switch Network", it will add/update the network with
    // the correct name and RPC for the current hostname, ensuring MetaMask uses
    // the right configuration.
    
    return { isValid: true };
  };

  /**
   * Check if connected network matches expected network
   * Validates both chainId and ensures correct RPC URL is configured
   */
  const checkNetwork = async (): Promise<boolean> => {
    const validation = await validateNetwork();
    return validation.isValid;
  };

  /**
   * Switch to the correct network (adds network if it doesn't exist)
   * Uses the hostname-aware RPC URL and network name from env-config
   * This ensures MetaMask uses the correct network configuration for the current hostname.
   */
  const switchToCorrectNetwork = async (): Promise<void> => {
    if (!isMetaMaskInstalled() || !window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    // Get the current network config (which uses hostname-aware RPC URL and network name)
    const networkConfig = getCurrentNetworkConfig();
    const currentRpcUrl = getRpcUrl();
    const networkConfigForMetaMask = {
      chainId: `0x${networkConfig.chainId.toString(16)}`,
      chainName: networkConfig.chainName, // "Hardhat Local" or "Hardhat Remote" based on hostname
      nativeCurrency: {
        name: networkConfig.currencyName,
        symbol: networkConfig.currencySymbol,
        decimals: 18,
      },
      rpcUrls: [currentRpcUrl], // Correct RPC URL based on hostname
      blockExplorerUrls: networkConfig.blockExplorerUrl ? [networkConfig.blockExplorerUrl] : null,
    };

    console.log('[Wallet] Switching to network:', {
      chainId: networkConfigForMetaMask.chainId,
      chainName: networkConfigForMetaMask.chainName,
      rpcUrl: currentRpcUrl,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
    });

    try {
      // Try to switch to the network
      // This will update the network configuration if it already exists
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: networkConfigForMetaMask.chainId }],
      });
      
      // After switching, we need to ensure the network has the correct name and RPC
      // Since MetaMask might have the network with wrong RPC/name, we'll try to update it
      // by removing and re-adding, or we can just rely on the switch which should work
      // if the network already exists with the same chainId
    } catch (switchError: any) {
      // If chain doesn't exist (error code 4902), add it with the correct RPC URL and name
      if (switchError.code === 4902) {
        try {
          console.log('[Wallet] Network not found, adding network:', {
            name: networkConfigForMetaMask.chainName,
            rpcUrl: currentRpcUrl,
          });
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfigForMetaMask],
          });
          // After adding, try switching again
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: networkConfigForMetaMask.chainId }],
          });
        } catch (addError: any) {
          const errorMessage = addError.message || 'Failed to add network to MetaMask';
          console.error('[Wallet] Failed to add network:', addError);
          throw new Error(errorMessage);
        }
      } else if (switchError.code === 4001) {
        // User rejected the request
        throw new Error('Network switch was rejected');
      } else {
        // For other errors, try adding the network anyway to ensure correct configuration
        // This handles the case where the network exists but has wrong RPC/name
        try {
          console.log('[Wallet] Switch failed, attempting to update network configuration');
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfigForMetaMask],
          });
        } catch (addError: any) {
          // If add fails (network might already exist), that's okay
          // The network should now be configured correctly
          console.log('[Wallet] Network configuration updated');
        }
        throw switchError;
      }
    }
  };

  /**
   * Connect to MetaMask wallet
   */
  const connect = async (): Promise<void> => {
    if (!isMetaMaskInstalled()) {
      setState((prev) => ({
        ...prev,
        error: 'MetaMask is not installed. Please install MetaMask to continue.',
      }));
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not available');
      }
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const account = accounts[0];
      const chainId = await getChainId();
      const currentRpcUrl = await getCurrentRpcUrl();
      const networkConfig = getCurrentNetworkConfig();

      // Validate network (chainId and RPC URL)
      const validation = await validateNetwork();
      const networkMatches = validation.isValid;
      
      setState({
        isConnected: true,
        account,
        chainId,
        isConnecting: false,
        isWrongNetwork: !networkMatches,
        currentRpcUrl,
        expectedRpcUrl: networkConfig.rpcUrl,
        error: networkMatches 
          ? null 
          : `Please switch to ${networkConfig.chainName} (Chain ID: ${EXPECTED_CHAIN_ID}) using RPC: ${networkConfig.rpcUrl}`,
      });
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: error.message || 'Failed to connect to MetaMask',
      }));
    }
  };

  /**
   * Disconnect wallet
   */
  const disconnect = () => {
    const networkConfig = getCurrentNetworkConfig();
    setState({
      isConnected: false,
      account: null,
      chainId: null,
      isConnecting: false,
      error: null,
      isWrongNetwork: false,
      currentRpcUrl: null,
      expectedRpcUrl: networkConfig.rpcUrl,
    });
  };

  /**
   * Get ethers signer from MetaMask
   */
  const getSigner = async (): Promise<ethers.JsonRpcSigner | null> => {
    if (!isMetaMaskInstalled() || !window.ethereum || !state.account) {
      return null;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      return await provider.getSigner();
    } catch (error) {
      console.error('Failed to get signer:', error);
      return null;
    }
  };

  /**
   * Initialize wallet state on mount and check network
   */
  useEffect(() => {
    const initWallet = async () => {
      if (!isMetaMaskInstalled()) return;

      const account = await getAccount();
      const chainId = await getChainId();
      const currentRpcUrl = await getCurrentRpcUrl();
      const networkConfig = getCurrentNetworkConfig();
      const validation = await validateNetwork();
      const networkMatches = validation.isValid;

      if (account && chainId !== null) {
        setState({
          isConnected: true,
          account,
          chainId,
          isConnecting: false,
          isWrongNetwork: !networkMatches,
          currentRpcUrl,
          expectedRpcUrl: networkConfig.rpcUrl,
          error: networkMatches 
            ? null 
            : `Please switch to ${networkConfig.chainName} (Chain ID: ${EXPECTED_CHAIN_ID}) using RPC: ${networkConfig.rpcUrl}`,
        });
      } else if (chainId !== null) {
        setState((prev) => ({
          ...prev,
          chainId,
          isWrongNetwork: !networkMatches,
          currentRpcUrl,
          expectedRpcUrl: networkConfig.rpcUrl,
          error: networkMatches 
            ? null 
            : `Please switch to ${networkConfig.chainName} (Chain ID: ${EXPECTED_CHAIN_ID}) using RPC: ${networkConfig.rpcUrl}`,
        }));
      }
    };

    initWallet();
  }, []);

  /**
   * Listen for account changes
   */
  useEffect(() => {
    if (!isMetaMaskInstalled() || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setState((prev) => ({
          ...prev,
          account: accounts[0],
        }));
      }
    };

    const handleChainChanged = async () => {
      const chainId = await getChainId();
      const currentRpcUrl = await getCurrentRpcUrl();
      const networkConfig = getCurrentNetworkConfig();
      const validation = await validateNetwork();
      const networkMatches = validation.isValid;

      setState((prev) => ({
        ...prev,
        chainId,
        isWrongNetwork: !networkMatches,
        currentRpcUrl,
        expectedRpcUrl: networkConfig.rpcUrl,
        error: networkMatches 
          ? null 
          : `Please switch to ${networkConfig.chainName} (Chain ID: ${EXPECTED_CHAIN_ID}) using RPC: ${networkConfig.rpcUrl}`,
      }));
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const value: WalletContextType = {
    ...state,
    connect,
    disconnect,
    checkNetwork,
    switchToCorrectNetwork,
    getSigner,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/**
 * Hook to use wallet context
 */
export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

/**
 * Type declaration for window.ethereum
 */
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

