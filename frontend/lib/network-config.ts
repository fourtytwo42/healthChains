/**
 * Network Configuration
 * 
 * Centralized network configuration that can be changed via environment variables.
 * Currently defaults to localhost, but can be easily changed to production networks.
 */

import { getRpcUrl } from './env-config';

export interface NetworkConfig {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  currencySymbol: string;
  currencyName: string;
  blockExplorerUrl: string | null;
}

/**
 * Get network configuration
 * Uses RPC URL from environment variable (NEXT_PUBLIC_RPC_URL)
 * Network name defaults to "Hardhat" but can be overridden
 */
export function getNetworkConfig(): NetworkConfig {
  // Get RPC URL from env-config (which respects NEXT_PUBLIC_RPC_URL)
  const rpcUrl = typeof window !== 'undefined' ? getRpcUrl() : (process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.qrmk.us');
  
  // Use "Hardhat" as the default network name (can be overridden with env var)
  const chainName = process.env.NEXT_PUBLIC_NETWORK_NAME || 'Hardhat';
  
  return {
    chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '1337', 10),
    chainName,
    rpcUrl,
    currencySymbol: process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'ETH',
    currencyName: process.env.NEXT_PUBLIC_CURRENCY_NAME || 'Ether',
    blockExplorerUrl: process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || null,
  };
}

/**
 * Get network configuration formatted for MetaMask wallet_addEthereumChain
 */
export function getMetaMaskNetworkConfig(): {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[] | null;
} {
  const config = getNetworkConfig();
  
  return {
    chainId: `0x${config.chainId.toString(16)}`,
    chainName: config.chainName,
    nativeCurrency: {
      name: config.currencyName,
      symbol: config.currencySymbol,
      decimals: 18,
    },
    rpcUrls: [config.rpcUrl],
    blockExplorerUrls: config.blockExplorerUrl ? [config.blockExplorerUrl] : null,
  };
}

