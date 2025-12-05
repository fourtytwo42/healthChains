/**
 * Mock Contract Utilities
 * 
 * Provides utilities for mocking ethers contract instances in tests
 */

import { ethers } from 'ethers';

/**
 * Create a mock contract instance
 */
export function createMockContract(overrides?: Partial<any>) {
  const defaultMock = {
    address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    interface: {
      parseLog: jest.fn(),
      parseError: jest.fn(),
    },
    filters: {
      ConsentGranted: jest.fn(),
      ConsentRevoked: jest.fn(),
      ConsentBatchGranted: jest.fn(),
      AccessRequested: jest.fn(),
      AccessApproved: jest.fn(),
      AccessDenied: jest.fn(),
    },
    grantConsent: jest.fn(),
    grantConsentBatch: jest.fn(),
    revokeConsent: jest.fn(),
    requestAccess: jest.fn(),
    respondToAccessRequest: jest.fn(),
    hasActiveConsent: jest.fn(),
    getConsentRecord: jest.fn(),
    getPatientConsents: jest.fn(),
    getProviderConsents: jest.fn(),
    isConsentExpired: jest.fn(),
    getAccessRequest: jest.fn(),
    getPatientRequests: jest.fn(),
    queryFilter: jest.fn(),
  };

  return { ...defaultMock, ...overrides };
}

/**
 * Create a mock transaction response
 */
export function createMockTransaction(hash: string = '0x123') {
  return {
    hash,
    wait: jest.fn().mockResolvedValue({
      hash,
      blockNumber: 1,
      gasUsed: ethers.parseUnits('100000', 'wei'),
      logs: [],
    }),
  };
}

/**
 * Create a mock transaction receipt
 */
export function createMockReceipt(overrides?: Partial<any>) {
  return {
    hash: '0x123',
    blockNumber: 1,
    gasUsed: ethers.parseUnits('100000', 'wei'),
    logs: [],
    ...overrides,
  };
}

