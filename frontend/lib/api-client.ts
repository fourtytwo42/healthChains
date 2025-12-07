/**
 * API Client - Centralized REST API client for backend communication
 * 
 * Provides typed API methods with error handling, retries, and timeout.
 * All blockchain data comes through backend REST APIs only.
 */

import { getToken } from './auth';
import { getApiBaseUrl } from './env-config';

// Get API base URL dynamically based on hostname
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return getApiBaseUrl();
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
};

const API_BASE_URL = getBaseUrl();

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
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
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
  dataType?: string;      // For single consents
  purpose?: string;       // For single consents
  dataTypes?: string[];  // For batch consents
  purposes?: string[];   // For batch consents
  isBatch?: boolean;     // Flag to indicate batch consent
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
  dataTypes: string[];      // Array of data types
  purposes: string[];        // Array of purposes
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
  dataTypes?: string[];      // Array of data types
  purposes?: string[];        // Array of purposes
  expirationTime?: string | null;
  timestamp: string;
}

class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeout: number = 30000) {
    // Use provided baseUrl, or get dynamically based on hostname
    this.baseUrl = baseUrl || getApiBaseUrl();
    this.timeout = timeout;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Get JWT token if authentication is required
    const token = requireAuth ? getToken() : null;
    
    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    
    // Add Authorization header if token is available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
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
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await this.fetchWithTimeout(url, options, requireAuth);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle 401 Unauthorized - token expired or invalid
        if (response.status === 401) {
          // Clear invalid token
          const { clearToken } = await import('./auth');
          clearToken();
          
          // Throw error with specific code for handling
          const error = new Error(errorData.error?.message || 'Authentication required');
          (error as any).code = 'AUTHENTICATION_REQUIRED';
          (error as any).status = 401;
          throw error;
        }
        
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      // Parse JSON response - it may include pagination at the top level
      const jsonData = await response.json();
      
      // If the response has pagination, preserve it
      if (jsonData.pagination) {
        return {
          success: jsonData.success ?? true,
          data: jsonData.data as T,
          pagination: jsonData.pagination,
          metadata: jsonData.metadata,
          error: jsonData.error,
        };
      }
      
      return jsonData;
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

  // Health check (no auth required)
  // Note: /health endpoint returns { status, timestamp, data } directly, not wrapped in ApiResponse
  async healthCheck() {
    try {
      const url = `${this.baseUrl}/health`;
      const response = await this.fetchWithTimeout(url, {}, false);
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

  // Contract info (no auth required)
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
    }>('/api/contract/info', {}, false);
  }

  // Patients
  async getPatients() {
    return this.request<Patient[]>('/api/patients');
  }

  async getPatient(patientId: string) {
    return this.request<Patient>(`/api/patients/${patientId}`);
  }

  // Get patient's own information (for patients)
  async getPatientInfo(patientAddress: string) {
    return this.request<Patient>(`/api/patient/${patientAddress}/info`, {}, true);
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
    if (patientAddress) params.set('patientAddress', patientAddress.toLowerCase());
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
    if (patientAddress) params.set('patientAddress', patientAddress.toLowerCase());
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

  // User role detection
  async getUserRole(address: string) {
    // Normalize address to lowercase for consistent API calls
    const normalizedAddress = address.toLowerCase();
    const params = new URLSearchParams({ address: normalizedAddress });
    const response = await this.request<{
      role: 'patient' | 'provider' | 'both' | 'unknown';
      patientId?: string;
      providerId?: string;
    }>(`/api/user/role?${params}`);
    
    // Debug logging
    console.log('[apiClient.getUserRole] Address:', address);
    console.log('[apiClient.getUserRole] Normalized:', normalizedAddress);
    console.log('[apiClient.getUserRole] Response:', response);
    
    if (!response.success || !response.data) {
      console.warn('[apiClient.getUserRole] Failed to get role:', response.error);
      return { role: 'unknown' as const };
    }
    
    return response.data;
  }

  // Provider-specific endpoints
  async getProviderConsentsPaginated(
    providerAddress: string,
    page = 1,
    limit = 10,
    includeExpired = false
  ) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      includeExpired: includeExpired.toString(),
    });
    return this.request<{
      data: ConsentRecord[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/api/provider/${providerAddress}/consents?${params}`);
  }

  async getProviderPatients(
    providerAddress: string,
    page = 1,
    limit = 10
  ) {
    // Normalize address to lowercase for consistent API calls
    const normalizedAddress = providerAddress.toLowerCase();
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    console.log('[apiClient.getProviderPatients] Fetching for provider:', normalizedAddress);
    const response = await this.request<{
      data: Array<Patient & { consents: Array<{
        consentId: number;
        dataType: string;
        purpose: string;
        expirationTime: string | null;
        isExpired: boolean;
        isActive: boolean;
      }> }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/api/provider/${normalizedAddress}/patients?${params}`);
    console.log('[apiClient.getProviderPatients] Response:', response);
    return response;
  }

  async getProviderPatientData(providerAddress: string, patientId: string) {
    return this.request<{
      patientId: string;
      demographics: unknown;
      consentedData: Record<string, unknown>;
      consentInfo: Array<{
        dataType: string;
        purpose: string;
        expirationTime: string | null;
        consentId: number;
      }>;
    }>(`/api/provider/${providerAddress}/patient/${patientId}/data`);
  }

  async getProviderPendingRequests(
    providerAddress: string,
    page = 1,
    limit = 10
  ) {
    // Normalize address to lowercase for consistent API calls
    const normalizedAddress = providerAddress.toLowerCase();
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    return this.request<AccessRequest[]>(
      `/api/provider/${normalizedAddress}/pending-requests?${params}`
    );
  }

  // Patient-specific endpoints
  async getPatientConsentsPaginated(
    patientAddress: string,
    page = 1,
    limit = 10,
    includeExpired = false
  ) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      includeExpired: includeExpired.toString(),
    });
    return this.request<{
      data: ConsentRecord[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(`/api/patient/${patientAddress}/consents?${params}`);
  }

  async getPatientPendingRequests(
    patientAddress: string,
    page = 1,
    limit = 10
  ) {
    // Normalize address to lowercase for consistent API calls
    const normalizedAddress = patientAddress.toLowerCase();
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    // The API returns {success: true, data: [...], pagination: {...}}
    // The request method will parse this, but we need to preserve pagination
    return this.request<Array<AccessRequest & {
      provider?: {
        providerId: string;
        organizationName: string;
        providerType: string;
      } | null;
    }>>(`/api/patient/${normalizedAddress}/pending-requests?${params}`);
  }

  // Note: Write operations (grant, revoke, approve, deny) are now handled
  // directly via MetaMask contract calls in the frontend. See hooks/use-api.ts
  // for mutation hooks that use direct contract interaction.

  /**
   * Stream chat message to Groq AI
   * 
   * @param message - User's message
   * @param conversationHistory - Previous messages in conversation
   * @param onChunk - Callback function called for each chunk of the response
   * @returns Promise that resolves when stream completes
   */
  async streamChatMessage(
    message: string,
    conversationHistory: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_calls?: unknown[]; tool_call_id?: string }> = [],
    onChunk: (chunk: string) => void,
    onToolCall?: (toolCalls: unknown[]) => void
  ): Promise<void> {
    const token = getToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const url = `${API_BASE_URL}/api/chat/message`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message,
        conversationHistory,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.error?.message || `Chat API error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Parse Server-Sent Events (SSE) stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let hasReceivedData = false;
    let chunkCount = 0;
    let rawDataReceived = '';

    console.log('Starting to read SSE stream...');
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log(`Stream ended. Received data: ${hasReceivedData}, Chunks processed: ${chunkCount}, Buffer length: ${buffer.length}`);
          if (!hasReceivedData) {
            console.warn('Stream ended without receiving any data chunks');
          }
          if (rawDataReceived) {
            console.log('Raw data received (first 500 chars):', rawDataReceived.substring(0, 500));
          }
          break;
        }

        hasReceivedData = true;
        const decoded = decoder.decode(value, { stream: true });
        rawDataReceived += decoded;
        buffer += decoded;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        console.log(`Decoded ${decoded.length} bytes, ${lines.length} lines, buffer: ${buffer.length} chars`);

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          console.log(`Processing line: "${line.substring(0, 100)}"`);
          
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim(); // Remove 'data: ' prefix and trim
            
            if (data === '[DONE]') {
              console.log('Received [DONE] marker, stream complete');
              return;
            }

            try {
              const json = JSON.parse(data);
              console.log('Parsed JSON:', json);
              
              // Handle content chunks
              if (json.content) {
                chunkCount++;
                console.log(`Received content chunk ${chunkCount}: "${json.content.substring(0, 50)}"`);
                onChunk(json.content);
              }
              // Handle tool calls
              else if (json.tool_calls && Array.isArray(json.tool_calls)) {
                console.group('[AI Tool Calls] Received tool calls from AI');
                console.log('Number of tool calls:', json.tool_calls.length);
                console.log('Tool calls:', JSON.stringify(json.tool_calls, null, 2));
                console.groupEnd();
                if (onToolCall) {
                  onToolCall(json.tool_calls);
                }
              }
              // Handle errors
              else if (json.error) {
                console.error('Chat API error:', json.error);
                throw new Error(json.error);
              } else {
                // Log unexpected format for debugging
                console.warn('Unexpected chat response format:', json);
              }
            } catch (parseError) {
              // Ignore parse errors for malformed JSON (might be partial data)
              if (data !== '[DONE]') {
                console.warn('Failed to parse SSE data:', data.substring(0, 200), parseError);
              }
            }
          } else if (line.trim() !== '') {
            // Log non-data lines for debugging (but ignore empty lines)
            console.log('Non-data SSE line:', line.substring(0, 100));
          }
        }
      }
    } catch (error) {
      console.error('Error reading chat stream:', error);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
}

export const apiClient = new ApiClient();

