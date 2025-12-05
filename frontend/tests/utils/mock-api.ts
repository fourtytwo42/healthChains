/**
 * Mock API Utilities
 * 
 * Provides MSW handlers for mocking API responses in tests
 */

import { http, HttpResponse } from 'msw';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

/**
 * Default mock API handlers
 */
export const handlers = [
  // Health check
  http.get(`${API_BASE_URL}/health`, () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      data: {
        patients: 10,
        providers: 8,
      },
    });
  }),

  // Contract info
  http.get(`${API_BASE_URL}/api/contract/info`, () => {
    return HttpResponse.json({
      success: true,
      contract: {
        address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        name: 'PatientConsentManager',
      },
      web3: {
        connected: true,
        network: 'localhost',
        chainId: 1337,
      },
      deployment: {
        blockNumber: 1,
        transactionHash: '0x123',
      },
    });
  }),

  // Patients
  http.get(`${API_BASE_URL}/api/patients`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          patientId: 'PAT-000001',
          demographics: {
            firstName: 'John',
            lastName: 'Smith',
          },
          blockchainIntegration: {
            walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          },
        },
      ],
    });
  }),

  // Providers
  http.get(`${API_BASE_URL}/api/providers`, () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          providerId: 'PROV-000001',
          organizationName: 'Test Hospital',
          blockchainIntegration: {
            walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
          },
        },
      ],
    });
  }),

  // Data types
  http.get(`${API_BASE_URL}/api/data-types`, () => {
    return HttpResponse.json({
      success: true,
      data: ['medical_records', 'diagnostic_data', 'genetic_data'],
    });
  }),

  // Purposes
  http.get(`${API_BASE_URL}/api/purposes`, () => {
    return HttpResponse.json({
      success: true,
      data: ['treatment', 'research', 'analytics'],
    });
  }),

  // Patient consents
  http.get(`${API_BASE_URL}/api/consent/patient/:address`, () => {
    return HttpResponse.json({
      success: true,
      data: [],
      metadata: {
        count: 0,
      },
    });
  }),

  // Patient requests
  http.get(`${API_BASE_URL}/api/requests/patient/:address`, () => {
    return HttpResponse.json({
      success: true,
      data: [],
      metadata: {
        count: 0,
      },
    });
  }),
];

/**
 * Create custom handlers for specific test scenarios
 */
export function createCustomHandlers(customHandlers: typeof handlers) {
  return [...handlers, ...customHandlers];
}

