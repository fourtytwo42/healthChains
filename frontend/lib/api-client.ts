/**
 * API Client - Centralized REST API client for backend communication
 * 
 * Provides typed API methods with error handling, retries, and timeout.
 * All blockchain data comes through backend REST APIs only.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
    blockNumber?: number;
    network?: string;
    chainId?: number;
    count?: number;
  };
}

export interface Patient {
  patientId: string;
  demographics: {
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
    [key: string]: unknown;
  };
  blockchainIntegration?: {
    walletAddress: string;
  };
  [key: string]: unknown;
}

export interface Provider {
  providerId: string;
  organizationName: string;
  blockchainIntegration?: {
    walletAddress: string;
  };
  [key: string]: unknown;
}

export interface ConsentRecord {
  consentId: number;
  patientAddress: string;
  providerAddress: string;
  timestamp: string;
  expirationTime: string | null;
  isActive: boolean;
  dataType: string;
  purpose: string;
  isExpired: boolean;
}

export interface AccessRequest {
  requestId: number;
  requester: string;
  patientAddress: string;
  timestamp: string;
  expirationTime: string | null;
  isProcessed: boolean;
  status: 'pending' | 'approved' | 'denied';
  dataType: string;
  purpose: string;
  isExpired: boolean;
}

export interface ConsentStatus {
  hasConsent: boolean;
  consentId: number | null;
  isExpired: boolean;
  expirationTime: string | null;
}

export interface ConsentEvent {
  type: 'ConsentGranted' | 'ConsentRevoked' | 'ConsentBatchGranted';
  blockNumber: number;
  transactionHash: string;
  consentId?: number;
  patient: string;
  provider?: string;
  dataType?: string;
  purpose?: string;
  expirationTime?: string | null;
  timestamp: string;
}

export interface AccessRequestEvent {
  type: 'AccessRequested' | 'AccessApproved' | 'AccessDenied';
  blockNumber: number;
  transactionHash: string;
  requestId: number;
  requester?: string;
  patient: string;
  dataType?: string;
  purpose?: string;
  expirationTime?: string | null;
  timestamp: string;
}

class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = API_BASE_URL, timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await this.fetchWithTimeout(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: error.message,
          },
        };
      }
      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
        },
      };
    }
  }

  // Health check
  // Note: /health endpoint returns { status, timestamp, data } directly, not wrapped in ApiResponse
  async healthCheck() {
    try {
      const url = `${this.baseUrl}/health`;
      const response = await this.fetchWithTimeout(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json() as { status: string; timestamp: string; data: { patients: number; providers: number } };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Health check failed');
    }
  }

  // Contract info
  async getContractInfo() {
    return this.request<{
      contract: {
        name: string;
        network: string;
        address: string | null;
        chainId: number | null;
        deployed: boolean;
      };
      deployment: unknown;
      web3: {
        connected: boolean;
        initialized: boolean;
      };
    }>('/api/contract/info');
  }

  // Patients
  async getPatients() {
    return this.request<Patient[]>('/api/patients');
  }

  async getPatient(patientId: string) {
    return this.request<Patient>(`/api/patients/${patientId}`);
  }

  async getPatientData(patientId: string, dataType: string) {
    return this.request<unknown>(`/api/patients/${patientId}/data/${dataType}`);
  }

  // Providers
  async getProviders() {
    return this.request<Provider[]>('/api/providers');
  }

  async getProvider(providerId: string) {
    return this.request<Provider>(`/api/providers/${providerId}`);
  }

  // Consent operations
  async getConsentStatus(
    patientAddress: string,
    providerAddress: string,
    dataType: string
  ) {
    const params = new URLSearchParams({
      patientAddress,
      providerAddress,
      dataType,
    });
    return this.request<ConsentStatus>(`/api/consent/status?${params}`);
  }

  async getConsentRecord(consentId: number) {
    return this.request<ConsentRecord>(`/api/consent/${consentId}`);
  }

  async getPatientConsents(patientAddress: string, includeExpired = false) {
    const params = new URLSearchParams({
      includeExpired: includeExpired.toString(),
    });
    return this.request<ConsentRecord[]>(
      `/api/consent/patient/${patientAddress}?${params}`
    );
  }

  async getProviderConsents(providerAddress: string, includeExpired = false) {
    const params = new URLSearchParams({
      includeExpired: includeExpired.toString(),
    });
    return this.request<ConsentRecord[]>(
      `/api/consent/provider/${providerAddress}?${params}`
    );
  }

  // Access requests
  async getAccessRequest(requestId: number) {
    return this.request<AccessRequest>(`/api/requests/${requestId}`);
  }

  async getPatientRequests(patientAddress: string, status = 'all') {
    const params = new URLSearchParams({ status });
    return this.request<AccessRequest[]>(
      `/api/requests/patient/${patientAddress}?${params}`
    );
  }

  // Events
  async getConsentEvents(
    patientAddress?: string,
    fromBlock?: number,
    toBlock?: number
  ) {
    const params = new URLSearchParams();
    if (patientAddress) params.set('patientAddress', patientAddress);
    if (fromBlock !== undefined) params.set('fromBlock', fromBlock.toString());
    if (toBlock !== undefined) params.set('toBlock', toBlock.toString());

    return this.request<ConsentEvent[]>(`/api/events/consent?${params}`);
  }

  async getAccessRequestEvents(
    patientAddress?: string,
    fromBlock?: number,
    toBlock?: number
  ) {
    const params = new URLSearchParams();
    if (patientAddress) params.set('patientAddress', patientAddress);
    if (fromBlock !== undefined) params.set('fromBlock', fromBlock.toString());
    if (toBlock !== undefined) params.set('toBlock', toBlock.toString());

    return this.request<AccessRequestEvent[]>(`/api/events/requests?${params}`);
  }

  // Data types and purposes
  async getDataTypes() {
    return this.request<string[]>('/api/data-types');
  }

  async getPurposes() {
    return this.request<string[]>('/api/purposes');
  }

  // Note: Write operations (grant, revoke, approve, deny) are now handled
  // directly via MetaMask contract calls in the frontend. See hooks/use-api.ts
  // for mutation hooks that use direct contract interaction.
}

export const apiClient = new ApiClient();

