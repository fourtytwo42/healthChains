/**
 * Contract Utilities - Direct smart contract interaction via MetaMask
 * 
 * Provides utilities for creating contract instances with MetaMask signer
 * and interacting with the PatientConsentManager contract.
 */

import { ethers } from 'ethers';
import { apiClient } from './api-client';

/**
 * Contract ABI - Loaded from public folder
 */
let contractABI: ethers.InterfaceAbi | null = null;
let contractAddress: string | null = null;

/**
 * Load contract ABI from public folder
 */
async function loadContractABI(): Promise<ethers.InterfaceAbi> {
  if (contractABI) return contractABI;

  try {
    // Load ABI from public folder
    const response = await fetch('/contract-abi.json');
    if (!response.ok) {
      throw new Error('Failed to load contract ABI');
    }
    const artifact = await response.json();
    if (!artifact.abi) {
      throw new Error('ABI not found in artifact');
    }
    contractABI = artifact.abi;
    
    if (!contractABI) {
      throw new Error('Failed to load contract ABI');
    }
    return contractABI;
  } catch (error) {
    console.error('Failed to load contract ABI:', error);
    throw new Error('Failed to load contract ABI. Make sure contract-abi.json exists in public folder.');
  }
}

/**
 * Get contract address from backend
 */
async function getContractAddress(): Promise<string> {
  if (contractAddress) return contractAddress;

  try {
    const contractInfo = await apiClient.getContractInfo();
    if (contractInfo.success && contractInfo.data?.contract?.address) {
      contractAddress = contractInfo.data.contract.address;
      return contractAddress;
    }
    throw new Error('Contract address not found');
  } catch (error) {
    console.error('Failed to get contract address:', error);
    throw new Error('Failed to get contract address. Make sure the contract is deployed.');
  }
}

/**
 * Create a contract instance with MetaMask signer
 * 
 * @param signer - Ethers signer from MetaMask
 * @returns Contract instance ready for write operations
 */
export async function getContract(signer: ethers.Signer): Promise<ethers.Contract> {
  const abi = await loadContractABI();
  const address = await getContractAddress();
  
  return new ethers.Contract(address, abi, signer);
}

/**
 * Create a read-only contract instance (no signer needed)
 * 
 * @param provider - Ethers provider (can be from MetaMask or RPC)
 * @returns Read-only contract instance
 */
export async function getReadOnlyContract(provider: ethers.Provider): Promise<ethers.Contract> {
  const abi = await loadContractABI();
  const address = await getContractAddress();
  
  return new ethers.Contract(address, abi, provider);
}

/**
 * Create a contract instance from MetaMask window.ethereum
 * 
 * @returns Contract instance with MetaMask signer
 */
export async function getContractFromMetaMask(): Promise<ethers.Contract> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed or not available');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  return getContract(signer);
}

/**
 * Helper to wait for transaction confirmation
 */
export async function waitForTransaction(
  tx: ethers.ContractTransactionResponse,
  confirmations: number = 1
): Promise<ethers.ContractTransactionReceipt> {
  const receipt = await tx.wait(confirmations);
  if (!receipt) {
    throw new Error('Transaction receipt is null');
  }
  return receipt;
}

