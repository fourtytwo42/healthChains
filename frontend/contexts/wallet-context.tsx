'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ethers } from 'ethers';

/**
 * Wallet Context - Manages MetaMask wallet connection state
 * 
 * Provides:
 * - Wallet connection status
 * - Current account address
 * - Network/chain ID
 * - Connect/disconnect functions
 * - Network validation
 */

interface WalletState {
  isConnected: boolean;
  account: string | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
}

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  checkNetwork: () => Promise<boolean>;
  switchNetwork: (chainId: number) => Promise<void>;
  getSigner: () => Promise<ethers.JsonRpcSigner | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

/**
 * Expected chain ID from environment (defaults to 1337 for Hardhat local)
 */
const EXPECTED_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '1337', 10);

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
   * Check if connected network matches expected network
   */
  const checkNetwork = async (): Promise<boolean> => {
    const chainId = await getChainId();
    return chainId === EXPECTED_CHAIN_ID;
  };

  /**
   * Switch to expected network
   */
  const switchNetwork = async (chainId: number = EXPECTED_CHAIN_ID): Promise<void> => {
    if (!isMetaMaskInstalled() || !window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (switchError: any) {
      // If chain doesn't exist, try to add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${chainId.toString(16)}`,
                chainName: 'Hardhat Local',
                nativeCurrency: {
                  name: 'Ether',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['http://127.0.0.1:8545'],
                blockExplorerUrls: null,
              },
            ],
          });
        } catch (addError) {
          throw new Error('Failed to add network to MetaMask');
        }
      } else {
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

      // Check if network matches
      const networkMatches = chainId !== null && Number(chainId) === EXPECTED_CHAIN_ID;
      if (!networkMatches && chainId !== null) {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          error: `Network mismatch. Current: ${chainId}, Expected: ${EXPECTED_CHAIN_ID}. Please switch to chain ID ${EXPECTED_CHAIN_ID}`,
        }));
        return;
      }

      setState({
        isConnected: true,
        account,
        chainId,
        isConnecting: false,
        error: null,
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
    setState({
      isConnected: false,
      account: null,
      chainId: null,
      isConnecting: false,
      error: null,
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
   * Initialize wallet state on mount
   */
  useEffect(() => {
    const initWallet = async () => {
      if (!isMetaMaskInstalled()) return;

      const account = await getAccount();
      const chainId = await getChainId();

      if (account && chainId !== null) {
        setState({
          isConnected: true,
          account,
          chainId,
          isConnecting: false,
          error: null,
        });
      } else if (chainId !== null) {
        setState((prev) => ({
          ...prev,
          chainId,
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
      const networkMatches = chainId !== null && Number(chainId) === EXPECTED_CHAIN_ID;

      setState((prev) => ({
        ...prev,
        chainId,
        error: networkMatches ? null : `Network mismatch. Current: ${chainId}, Expected: ${EXPECTED_CHAIN_ID}. Please switch to chain ID ${EXPECTED_CHAIN_ID}`,
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
    switchNetwork,
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

