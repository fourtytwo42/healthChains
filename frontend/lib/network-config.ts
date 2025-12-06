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
 * Get network configuration from environment variables
 * Network name and RPC URL are dynamically determined based on hostname
 * - localhost/127.0.0.1 → "Hardhat Local" with http://127.0.0.1:8545
 * - app.qrmk.us → "Hardhat Remote" with https://rpc.qrmk.us
 */
export function getNetworkConfig(): NetworkConfig {
  // Get RPC URL dynamically based on hostname
  const rpcUrl = typeof window !== 'undefined' ? getRpcUrl() : (process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545');
  
  // Determine network name based on hostname
  let chainName = process.env.NEXT_PUBLIC_NETWORK_NAME;
  if (!chainName && typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      chainName = 'Hardhat Local';
    } else if (hostname === 'app.qrmk.us' || hostname.endsWith('.qrmk.us')) {
      chainName = 'Hardhat Remote';
    } else {
      chainName = 'Hardhat Local'; // Default
    }
  } else if (!chainName) {
    chainName = 'Hardhat Local'; // Server-side default
  }
  
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

