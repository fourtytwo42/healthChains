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
 * Get network configuration - always uses Hardhat Remote
 * All connections use the remote RPC endpoint (rpc.qrmk.us)
 */
export function getNetworkConfig(): NetworkConfig {
  // Always use the remote RPC URL
  const rpcUrl = typeof window !== 'undefined' ? getRpcUrl() : (process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.qrmk.us');
  
  // Always use "Hardhat Remote" as the network name
  const chainName = process.env.NEXT_PUBLIC_NETWORK_NAME || 'Hardhat Remote';
  
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

