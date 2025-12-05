/**
 * Contract Utilities Tests
 */

import { ethers } from 'ethers';
import { getContract, getReadOnlyContract, waitForTransaction } from '@/lib/contract';
import { apiClient } from '@/lib/api-client';

// Mock api-client
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    getContractInfo: jest.fn(),
  },
}));

// Mock fetch for ABI loading
global.fetch = jest.fn();

describe('Contract Utilities', () => {
  const mockABI = [
    {
      inputs: [],
      name: 'consentCounter',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ];

  const mockContractAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock fetch for ABI
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ abi: mockABI }),
    });

    // Mock contract info
    (apiClient.getContractInfo as jest.Mock).mockResolvedValue({
      success: true,
      contract: {
        address: mockContractAddress,
      },
    });
  });

  describe('getContract', () => {
    it('should create contract instance with signer', async () => {
      const mockSigner = {
        getAddress: jest.fn().mockResolvedValue('0x123'),
      } as unknown as ethers.Signer;

      const contract = await getContract(mockSigner);

      expect(contract).toBeInstanceOf(ethers.Contract);
      expect(contract.target).toBe(mockContractAddress);
    });

    it('should load ABI from public folder', async () => {
      const mockSigner = {
        getAddress: jest.fn().mockResolvedValue('0x123'),
      } as unknown as ethers.Signer;

      await getContract(mockSigner);

      expect(global.fetch).toHaveBeenCalledWith('/contract-abi.json');
    });

    it('should throw error if ABI loading fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      const mockSigner = {
        getAddress: jest.fn().mockResolvedValue('0x123'),
      } as unknown as ethers.Signer;

      await expect(getContract(mockSigner)).rejects.toThrow('Failed to load contract ABI');
    });
  });

  describe('getReadOnlyContract', () => {
    it('should create read-only contract instance', async () => {
      const mockProvider = {} as ethers.Provider;

      const contract = await getReadOnlyContract(mockProvider);

      expect(contract).toBeInstanceOf(ethers.Contract);
      expect(contract.target).toBe(mockContractAddress);
    });
  });

  describe('waitForTransaction', () => {
    it('should wait for transaction and return receipt', async () => {
      const mockReceipt = {
        hash: '0x123',
        blockNumber: 1,
        gasUsed: ethers.parseUnits('100000', 'wei'),
        logs: [],
      };

      const mockTx = {
        wait: jest.fn().mockResolvedValue(mockReceipt),
      } as unknown as ethers.ContractTransactionResponse;

      const receipt = await waitForTransaction(mockTx);

      expect(receipt).toEqual(mockReceipt);
      expect(mockTx.wait).toHaveBeenCalledWith(1);
    });

    it('should throw error if receipt is null', async () => {
      const mockTx = {
        wait: jest.fn().mockResolvedValue(null),
      } as unknown as ethers.ContractTransactionResponse;

      await expect(waitForTransaction(mockTx)).rejects.toThrow('Transaction receipt is null');
    });
  });
});

