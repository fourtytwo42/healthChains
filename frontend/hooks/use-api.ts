/**
 * API Hooks - React Query hooks for backend API calls
 * 
 * Provides typed, cached, and resilient data fetching with React Query
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { apiClient, type Patient, type Provider, type ConsentRecord, type AccessRequest, type ConsentStatus, type ConsentEvent, type AccessRequestEvent } from '@/lib/api-client';
import type { ConsentHistoryEvent } from '@/types/consent';
import { toast } from 'sonner';
import { handleError, handleTransactionError } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

// Query keys
export const queryKeys = {
  health: ['health'] as const,
  contractInfo: ['contract', 'info'] as const,
  patients: ['patients'] as const,
  patient: (id: string) => ['patients', id] as const,
  patientData: (id: string, dataType: string) => ['patients', id, 'data', dataType] as const,
  providers: ['providers'] as const,
  provider: (id: string) => ['providers', id] as const,
  consentStatus: (patient: string, provider: string, dataType: string) =>
    ['consent', 'status', patient, provider, dataType] as const,
  consent: (id: number) => ['consent', id] as const,
  patientConsents: (address: string, includeExpired: boolean) =>
    ['consents', 'patient', address, includeExpired] as const,
  providerConsents: (address: string, includeExpired: boolean) =>
    ['consents', 'provider', address, includeExpired] as const,
  accessRequest: (id: number) => ['requests', id] as const,
  patientRequests: (address: string, status: string) =>
    ['requests', 'patient', address, status] as const,
  consentEvents: (patient?: string, fromBlock?: number, toBlock?: number) =>
    ['events', 'consent', patient, fromBlock, toBlock] as const,
  accessRequestEvents: (patient?: string, fromBlock?: number, toBlock?: number) =>
    ['events', 'requests', patient, fromBlock, toBlock] as const,
  dataTypes: ['data-types'] as const,
  purposes: ['purposes'] as const,
};

// Health check
export function useHealthCheck() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: async () => {
      try {
        return await apiClient.healthCheck();
      } catch (error) {
        // Return error state if health check fails
        throw error;
      }
    },
    refetchInterval: 30000, // Check every 30 seconds
    retry: 2,
  });
}

// Contract info
// Note: Backend returns { success, contract, web3, deployment } directly, not wrapped in data
export function useContractInfo() {
  return useQuery({
    queryKey: queryKeys.contractInfo,
    queryFn: async () => {
      const response = await apiClient.getContractInfo();
      // Backend returns the structure directly, not wrapped in data
      // So we need to handle it as the response itself
      if (response.success) {
        return response as unknown as {
          success: boolean;
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
        };
      }
      throw new Error('Failed to fetch contract info');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

type PatientsQueryOptions = Pick<
  UseQueryOptions<Patient[], Error>,
  'enabled' | 'staleTime' | 'gcTime' | 'refetchOnReconnect' | 'refetchOnMount' | 'refetchOnWindowFocus'
>;

// Patients
export function usePatients(options: PatientsQueryOptions = {}) {
  return useQuery<Patient[], Error>({
    queryKey: queryKeys.patients,
    queryFn: async () => {
      const response = await apiClient.getPatients();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch patients');
      }
      return response.data;
    },
    // Note: This endpoint requires provider role
    // Patients should use usePatientInfo() instead
    // Keep a stable empty array while loading/erroring and avoid unnecessary refetch on remount
    placeholderData: (previousData) => previousData ?? [],
    select: (data) => (Array.isArray(data) ? data : []),
    refetchOnMount: false,
    // Note: This endpoint requires provider role
    // Patients should use usePatientInfo() instead
    ...options,
  });
}

// Get patient's own information (for patients)
export function usePatientInfo(patientAddress: string, options: { enabled?: boolean } = {}) {
  return useQuery<Patient, Error>({
    queryKey: ['patientInfo', patientAddress?.toLowerCase()],
    queryFn: async () => {
      const response = await apiClient.getPatientInfo(patientAddress);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch patient info');
      }
      return response.data;
    },
    enabled: options.enabled !== false && !!patientAddress,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function usePatient(patientId: string) {
  return useQuery({
    queryKey: queryKeys.patient(patientId),
    queryFn: async () => {
      const response = await apiClient.getPatient(patientId);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch patient');
      }
      return response.data;
    },
    enabled: !!patientId,
  });
}

export function usePatientData(patientId: string, dataType: string) {
  return useQuery({
    queryKey: queryKeys.patientData(patientId, dataType),
    queryFn: async () => {
      const response = await apiClient.getPatientData(patientId, dataType);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch patient data');
      }
      return response.data;
    },
    enabled: !!patientId && !!dataType,
  });
}

// Providers
export function useProviders() {
  return useQuery({
    queryKey: queryKeys.providers,
    queryFn: async () => {
      const response = await apiClient.getProviders();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch providers');
      }
      return response.data;
    },
  });
}

// Consent operations
export function useConsentStatus(
  patientAddress: string,
  providerAddress: string,
  dataType: string,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.consentStatus(patientAddress, providerAddress, dataType),
    queryFn: async () => {
      const response = await apiClient.getConsentStatus(patientAddress, providerAddress, dataType);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to check consent status');
      }
      return response.data;
    },
    enabled: enabled && !!patientAddress && !!providerAddress && !!dataType,
  });
}

export function useConsent(consentId: number) {
  return useQuery({
    queryKey: queryKeys.consent(consentId),
    queryFn: async () => {
      const response = await apiClient.getConsentRecord(consentId);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch consent');
      }
      return response.data;
    },
    enabled: consentId >= 0,
  });
}

export function usePatientConsents(patientAddress: string, includeExpired = false) {
  return useQuery({
    queryKey: queryKeys.patientConsents(patientAddress, includeExpired),
    queryFn: async () => {
      const response = await apiClient.getPatientConsents(patientAddress, includeExpired);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch consents');
      }
      return response.data;
    },
    enabled: !!patientAddress && patientAddress.length > 0,
  });
}

// Access requests
export function useAccessRequest(requestId: number) {
  return useQuery({
    queryKey: queryKeys.accessRequest(requestId),
    queryFn: async () => {
      const response = await apiClient.getAccessRequest(requestId);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch access request');
      }
      return response.data;
    },
    enabled: requestId >= 0,
  });
}

export function usePatientRequests(patientAddress: string, status = 'all') {
  return useQuery({
    queryKey: queryKeys.patientRequests(patientAddress, status),
    queryFn: async () => {
      const response = await apiClient.getPatientRequests(patientAddress, status);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch requests');
      }
      return response.data;
    },
    enabled: !!patientAddress,
  });
}

// Events
export function useConsentEvents(
  patientAddress?: string,
  fromBlock?: number,
  toBlock?: number
) {
  return useQuery({
    queryKey: queryKeys.consentEvents(patientAddress, fromBlock, toBlock),
    queryFn: async () => {
      const response = await apiClient.getConsentEvents(patientAddress, fromBlock, toBlock);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch consent events');
      }
      return response.data;
    },
  });
}

export function useAccessRequestEvents(
  patientAddress?: string,
  fromBlock?: number,
  toBlock?: number
) {
  return useQuery({
    queryKey: queryKeys.accessRequestEvents(patientAddress, fromBlock, toBlock),
    queryFn: async () => {
      const response = await apiClient.getAccessRequestEvents(patientAddress, fromBlock, toBlock);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch access request events');
      }
      return response.data;
    },
  });
}

// Data types and purposes
export function useDataTypes() {
  return useQuery({
    queryKey: queryKeys.dataTypes,
    queryFn: async () => {
      const response = await apiClient.getDataTypes();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch data types');
      }
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
  });
}

export function usePurposes() {
  return useQuery({
    queryKey: queryKeys.purposes,
    queryFn: async () => {
      const response = await apiClient.getPurposes();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch purposes');
      }
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
  });
}

// Mutation hooks for write operations (direct contract calls via MetaMask)

import { useWallet } from '@/contexts/wallet-context';
import { getContract, waitForTransaction } from '@/lib/contract';
import { ethers } from 'ethers';

/**
 * Hook for granting consent (direct contract call)
 * Supports batch operations with multiple providers, data types, and purposes
 * Generates all combinations (cartesian product) and creates them in a single batch transaction
 */
export function useGrantConsent() {
  const queryClient = useQueryClient();
  const { getSigner, account } = useWallet();

  return useMutation({
    mutationFn: async (data: {
      providers: string[];
      dataTypes: string[];
      purposes: string[];
      expirationTime?: number;
    }) => {
      if (!account) {
        throw new Error('Wallet not connected');
      }

      // Validation
      if (data.providers.length === 0) {
        throw new Error('At least one provider must be selected');
      }
      if (data.dataTypes.length === 0) {
        throw new Error('At least one data type must be selected');
      }
      if (data.purposes.length === 0) {
        throw new Error('At least one purpose must be selected');
      }

      const signer = await getSigner();
      if (!signer) {
        throw new Error('Failed to get signer from MetaMask');
      }

      const contract = await getContract(signer);
      const expirationTime = data.expirationTime ?? 0;

      // Validate expiration time is in the future if set
      if (expirationTime > 0) {
        const now = Math.floor(Date.now() / 1000);
        if (expirationTime <= now) {
          throw new Error('Expiration date must be in the future');
        }
      }

      // Validate providers are valid addresses
      if (data.providers.length !== 1) {
        throw new Error('Currently only one provider at a time is supported');
      }
      
      const provider = data.providers[0];
      if (!provider || provider === '0x0000000000000000000000000000000000000000') {
        throw new Error('Invalid provider address');
      }
      if (!ethers.isAddress(provider)) {
        throw new Error('Invalid address format');
      }

      // Validate data types and purposes are not empty
      for (const dataType of data.dataTypes) {
        if (!dataType || dataType.trim().length === 0) {
          throw new Error('Data type cannot be empty');
        }
      }
      for (const purpose of data.purposes) {
        if (!purpose || purpose.trim().length === 0) {
          throw new Error('Purpose cannot be empty');
        }
      }

      // Calculate total combinations to validate against contract limit
      const totalCombinations = data.dataTypes.length * data.purposes.length;
      if (totalCombinations > 200) {
        throw new Error(`Too many combinations (${totalCombinations}). Maximum 200 combinations per consent.`);
      }

      // Call grantConsent with arrays - creates ONE BatchConsentRecord with all combinations
      const tx = await contract.grantConsent(
        provider,
        data.dataTypes,
        expirationTime,
        data.purposes
      );

      const receipt = await waitForTransaction(tx);

      // Extract consent ID from ConsentGranted event
      // Event signature: ConsentGranted(address indexed patient, uint256[] consentIds, uint128 timestamp)
      let consentId: number | null = null;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === 'ConsentGranted') {
            // consentIds is the second argument (index 1), should be array with one element
            const ids = parsed.args[1] as bigint[];
            if (ids && Array.isArray(ids) && ids.length > 0) {
              consentId = Number(ids[0]);
            }
            break;
          }
        } catch {
          continue;
        }
      }

      return {
        consentIds: consentId ? [consentId] : [],
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    },
    onSuccess: (data) => {
      const count = data.consentIds.length;
      toast.success(
        count === 1
          ? 'Consent granted successfully'
          : `${count} consents granted successfully`,
        {
          description: `Transaction: ${data.transactionHash.slice(0, 10)}...`,
        }
      );
      // Invalidate relevant queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['consents'] });
      queryClient.invalidateQueries({ queryKey: ['patientConsents'] }); // Invalidate patient consents
      queryClient.invalidateQueries({ queryKey: ['providerPatients'] }); // Invalidate provider patients list
      queryClient.invalidateQueries({ queryKey: ['providerConsents'] }); // Invalidate provider consents
      queryClient.invalidateQueries({ queryKey: ['consentStatus'] });
      queryClient.invalidateQueries({ queryKey: ['consentEvents'] });
    },
    onError: (error: Error) => {
      handleTransactionError(error);
    },
  });
}

/**
 * Hook for revoking consent (direct contract call)
 */
export function useRevokeConsent() {
  const queryClient = useQueryClient();
  const { getSigner, account } = useWallet();

  return useMutation({
    mutationFn: async ({ consentId }: { consentId: number }) => {
      if (!account) {
        throw new Error('Wallet not connected');
      }

      const signer = await getSigner();
      if (!signer) {
        throw new Error('Failed to get signer from MetaMask');
      }

      const contract = await getContract(signer);

      // Call contract - MetaMask will prompt user to sign
      const tx = await contract.revokeConsent(consentId);

      // Wait for transaction confirmation
      const receipt = await waitForTransaction(tx);

      return {
        consentId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    },
    onSuccess: (data) => {
      toast.success('Consent revoked successfully', {
        description: `Transaction: ${data.transactionHash.slice(0, 10)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ['consents'] });
      queryClient.invalidateQueries({ queryKey: ['patientConsents'] }); // Invalidate patient consents
      queryClient.invalidateQueries({ queryKey: ['providerPatients'] }); // Invalidate provider patients list
      queryClient.invalidateQueries({ queryKey: ['providerConsents'] }); // Invalidate provider consents
      queryClient.invalidateQueries({ queryKey: ['consentStatus'] });
      queryClient.invalidateQueries({ queryKey: ['consentEvents'] });
    },
    onError: (error: Error) => {
      handleTransactionError(error);
    },
  });
}

/**
 * Hook for requesting access (direct contract call)
 */
export function useRequestAccess() {
  const queryClient = useQueryClient();
  const { getSigner, account } = useWallet();

  return useMutation({
    mutationFn: async (data: {
      patientAddress: string;
      dataTypes: string[];      // Array of data types
      purposes: string[];        // Array of purposes
      expirationTime?: number;
    }) => {
      if (!account) {
        throw new Error('Wallet not connected');
      }

      const signer = await getSigner();
      if (!signer) {
        throw new Error('Failed to get signer from MetaMask');
      }

      const contract = await getContract(signer);
      const expirationTime = data.expirationTime ?? 0;

      // Validate arrays
      if (!Array.isArray(data.dataTypes) || data.dataTypes.length === 0) {
        throw new Error('dataTypes must be a non-empty array');
      }

      if (!Array.isArray(data.purposes) || data.purposes.length === 0) {
        throw new Error('purposes must be a non-empty array');
      }

      // Call contract function - MetaMask will prompt user to sign
      const tx = await contract.requestAccess(
        data.patientAddress,
        data.dataTypes,
        data.purposes,
        expirationTime
      );

      // Wait for transaction confirmation
      const receipt = await waitForTransaction(tx);

      // Extract request ID from event
      let requestId: number | null = null;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === 'AccessRequested') {
            requestId = Number(parsed.args.requestId);
            break;
          }
        } catch {
          continue;
        }
      }

      return {
        requestId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    },
    onSuccess: (data) => {
      toast.success('Access request created successfully', {
        description: data.requestId ? `Request ID: ${data.requestId}` : 'Transaction confirmed',
      });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['accessRequestEvents'] });
    },
    onError: (error: Error) => {
      handleTransactionError(error);
    },
  });
}

/**
 * Hook for approving access request (direct contract call)
 */
export function useApproveRequest() {
  const queryClient = useQueryClient();
  const { getSigner, account } = useWallet();

  return useMutation({
    mutationFn: async ({ requestId }: { requestId: number }) => {
      if (!account) {
        throw new Error('Wallet not connected');
      }

      const signer = await getSigner();
      if (!signer) {
        throw new Error('Failed to get signer from MetaMask');
      }

      const contract = await getContract(signer);

      // Call contract - MetaMask will prompt user to sign
      const tx = await contract.respondToAccessRequest(requestId, true);

      // Wait for transaction confirmation
      const receipt = await waitForTransaction(tx);

      return {
        requestId,
        approved: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    },
    onSuccess: (data) => {
      toast.success('Access request approved', {
        description: `Transaction: ${data.transactionHash.slice(0, 10)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['consents'] });
      // Invalidate all patient consent queries (both regular and paginated use 'patientConsents' as first key)
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'patientConsents' });
      queryClient.invalidateQueries({ queryKey: ['providerPatients'] }); // Invalidate provider patients list
      queryClient.invalidateQueries({ queryKey: ['providerConsents'] }); // Invalidate provider consents
      queryClient.invalidateQueries({ queryKey: ['patientPendingRequests'] }); // Remove from pending
      queryClient.invalidateQueries({ queryKey: ['accessRequestEvents'] });
      queryClient.invalidateQueries({ queryKey: ['patientConsentHistory'] }); // Invalidate history to show approval
    },
    onError: (error: Error) => {
      handleTransactionError(error);
    },
  });
}

/**
 * Hook for denying access request (direct contract call)
 */
export function useDenyRequest() {
  const queryClient = useQueryClient();
  const { getSigner, account } = useWallet();

  return useMutation({
    mutationFn: async ({ requestId }: { requestId: number }) => {
      if (!account) {
        throw new Error('Wallet not connected');
      }

      const signer = await getSigner();
      if (!signer) {
        throw new Error('Failed to get signer from MetaMask');
      }

      const contract = await getContract(signer);

      // Call contract - MetaMask will prompt user to sign
      const tx = await contract.respondToAccessRequest(requestId, false);

      // Wait for transaction confirmation
      const receipt = await waitForTransaction(tx);

      return {
        requestId,
        approved: false,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    },
    onSuccess: (data) => {
      toast.success('Access request denied', {
        description: `Transaction: ${data.transactionHash.slice(0, 10)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['accessRequestEvents'] });
    },
    onError: (error: Error) => {
      const message = error.message.includes('user rejected') || error.message.includes('User rejected')
        ? 'Transaction was rejected'
        : error.message;
      toast.error('Failed to deny request', {
        description: message,
      });
    },
  });
}

/**
 * Hook for getting user role
 */
export function useUserRole(address: string | null) {
  return useQuery({
    queryKey: ['userRole', address],
    queryFn: async () => {
      if (!address) return null;
      return await apiClient.getUserRole(address);
    },
    enabled: !!address,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for getting provider consents with pagination
 */
export function useProviderConsentsPaginated(
  providerAddress: string,
  page = 1,
  limit = 10,
  includeExpired = false,
  enabled = true
) {
  return useQuery({
    queryKey: ['providerConsents', providerAddress, page, limit, includeExpired],
    queryFn: async () => {
      const response = await apiClient.getProviderConsentsPaginated(
        providerAddress,
        page,
        limit,
        includeExpired
      );
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch provider consents');
      }
      return response.data;
    },
    enabled: enabled && !!providerAddress,
  });
}

/**
 * Hook for getting provider patients with granted consents
 */
export function useProviderPatients(
  providerAddress: string,
  page = 1,
  limit = 10,
  enabled = true
) {
  return useQuery({
    queryKey: ['providerPatients', providerAddress?.toLowerCase(), page, limit],
    queryFn: async () => {
      // Normalize address to lowercase for consistent API calls
      const normalizedAddress = providerAddress.toLowerCase();
      logger.debug('[useProviderPatients] Fetching for provider:', normalizedAddress, 'enabled:', enabled);
      const response = await apiClient.getProviderPatients(normalizedAddress, page, limit);
      logger.debug('[useProviderPatients] Response:', response);
      if (!response.success || !response.data) {
        logger.error('[useProviderPatients] Failed response:', response);
        throw new Error('Failed to fetch provider patients');
      }
      
      // Return the data with pagination info (similar to usePatientPendingRequests)
      const dataArray = Array.isArray(response.data) ? response.data : [];
      const result = {
        data: dataArray,
        pagination: response.pagination || {
          page: Number(page),
          limit: Number(limit),
          total: dataArray.length,
          totalPages: Math.ceil(dataArray.length / Number(limit))
        }
      };
      
      logger.debug('[useProviderPatients] Returning result:', result);
      return result;
    },
    enabled: enabled && !!providerAddress,
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: false, // Disable auto-refetch to prevent loops
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

/**
 * Hook for getting provider patient data (with consent filtering)
 */
export function useProviderPatientData(
  providerAddress: string,
  patientId: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['providerPatientData', providerAddress, patientId],
    queryFn: async () => {
      const response = await apiClient.getProviderPatientData(providerAddress, patientId);
      // If the response has an error, check if it's a "no consent" scenario
      if (!response.success) {
        // If it's a 404 or NOT_FOUND, it might mean no consent yet - return empty data structure
        if (response.error?.code === 'NOT_FOUND' || response.error?.message?.includes('404')) {
          // Return a structure indicating no consent, but don't throw an error
          return {
            success: true,
            data: {
              patientId,
              demographics: {},
              consentedData: {},
              consentInfo: [],
              unavailableDataTypes: []
            }
          };
        }
        // For other errors, throw
        throw new Error(response.error?.message || 'Failed to fetch patient data');
      }
      // If response is successful but no data, return empty structure
      if (!response.data) {
        return {
          success: true,
          data: {
            patientId,
            demographics: {},
            consentedData: {},
            consentInfo: [],
            unavailableDataTypes: []
          }
        };
      }
      return response;
    },
    enabled: enabled && !!providerAddress && !!patientId,
    retry: false, // Don't retry on errors - likely means no consent
  });
}

/**
 * Hook for getting patient consents with pagination
 */
export function usePatientConsentsPaginated(
  patientAddress: string,
  page = 1,
  limit = 10,
  includeExpired = false,
  enabled = true
) {
  return useQuery({
    queryKey: ['patientConsents', patientAddress?.toLowerCase(), page, limit, includeExpired],
    queryFn: async () => {
      // Normalize address to lowercase for consistent API calls
      const normalizedAddress = patientAddress.toLowerCase();
      const response = await apiClient.getPatientConsentsPaginated(
        normalizedAddress,
        page,
        limit,
        includeExpired
      );
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch patient consents');
      }
      
      // Return the data with pagination info (similar to usePatientPendingRequests)
      const dataArray = Array.isArray(response.data) ? response.data : [];
      const result = {
        data: dataArray,
        pagination: response.pagination || {
          page: Number(page),
          limit: Number(limit),
          total: dataArray.length,
          totalPages: Math.ceil(dataArray.length / Number(limit))
        }
      };
      
      return result;
    },
    enabled: enabled && !!patientAddress,
    staleTime: 0, // Always refetch to get latest consents
    refetchInterval: 10000, // Refetch every 10 seconds to catch new consents
  });
}

/**
 * Hook for getting patient pending requests with pagination
 */
export function usePatientPendingRequests(
  patientAddress: string,
  page = 1,
  limit = 10,
  enabled = true
) {
  return useQuery({
    queryKey: ['patientPendingRequests', patientAddress?.toLowerCase(), page, limit],
    queryFn: async () => {
      // Normalize address to lowercase for consistent API calls
      const normalizedAddress = patientAddress.toLowerCase();
      console.log('[usePatientPendingRequests] Fetching for address:', normalizedAddress);
      const response = await apiClient.getPatientPendingRequests(normalizedAddress, page, limit);
      console.log('[usePatientPendingRequests] Full response:', response);
      
      if (!response.success) {
        console.error('[usePatientPendingRequests] API returned success: false', response);
        throw new Error(response.error?.message || 'Failed to fetch pending requests');
      }
      
      // The API returns {success: true, data: [...], pagination: {...}}
      // The request method wraps it, so response.data is the array
      if (!response.data) {
        console.error('[usePatientPendingRequests] No data in response:', response);
        throw new Error('No data returned from API');
      }
      
      // Return the data with pagination info
      const result = {
        data: response.data || [],
        pagination: response.pagination || {
          page: Number(page),
          limit: Number(limit),
          total: (response.data || []).length,
          totalPages: Math.ceil((response.data || []).length / Number(limit))
        }
      };
      
      console.log('[usePatientPendingRequests] Returning result:', result);
      return result;
    },
    enabled: enabled && !!patientAddress,
    staleTime: 0, // Always refetch to get latest requests
    refetchInterval: 10000, // Refetch every 10 seconds to catch new requests
  });
}

/**
 * Hook for getting provider pending requests
 */
export function useProviderPendingRequests(
  providerAddress: string,
  page = 1,
  limit = 10,
  enabled = true
) {
  return useQuery({
    queryKey: ['providerPendingRequests', providerAddress?.toLowerCase(), page, limit],
    queryFn: async () => {
      // Normalize address to lowercase for consistent API calls
      const normalizedAddress = providerAddress.toLowerCase();
      logger.debug('[useProviderPendingRequests] Fetching for provider:', normalizedAddress);
      const response = await apiClient.getProviderPendingRequests(normalizedAddress, page, limit);
      logger.debug('[useProviderPendingRequests] Full response:', response);
      
      if (!response.success) {
        logger.error('[useProviderPendingRequests] API returned success: false', response);
        throw new Error(response.error?.message || 'Failed to fetch pending requests');
      }
      
      // The API returns {success: true, data: [...], pagination: {...}}
      if (!response.data) {
        logger.error('[useProviderPendingRequests] No data in response:', response);
        throw new Error('No data returned from API');
      }
      
      // Return the data with pagination info
      const result = {
        data: response.data || [],
        pagination: response.pagination || {
          page: Number(page),
          limit: Number(limit),
          total: (response.data || []).length,
          totalPages: Math.ceil((response.data || []).length / Number(limit))
        }
      };
      
      logger.debug('[useProviderPendingRequests] Returning result:', result);
      return result;
    },
    enabled: enabled && !!providerAddress,
    staleTime: 30000, // Cache for 30 seconds
    refetchInterval: false, // Disable auto-refetch to prevent loops
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

/**
 * Hook for getting provider consent history (all events)
 */
export function useProviderConsentHistory(
  providerAddress: string,
  enabled = true
) {
  const normalizedAddress = providerAddress?.toLowerCase() || '';
  
  return useQuery({
    queryKey: ['providerConsentHistory', normalizedAddress],
    queryFn: async () => {
      // Use the already normalized address from outer scope
      const addressToMatch = normalizedAddress;
      
      // Fetch all consent events and access request events (no filter - we'll filter client-side)
      const [consentEventsResponse, requestEventsResponse] = await Promise.all([
        apiClient.getConsentEvents(), // Get all events, filter by provider client-side
        apiClient.getAccessRequestEvents(), // Get all events, filter by requester client-side
      ]);

      // Combine events
      const allEvents = [
        ...(consentEventsResponse.success && consentEventsResponse.data ? consentEventsResponse.data : []),
        ...(requestEventsResponse.success && requestEventsResponse.data ? requestEventsResponse.data : []),
      ];

      // Filter events by provider address
      const providerEvents = allEvents.filter((event) => {
        // For consent events, check if provider matches
        if (event.type === 'ConsentGranted' || event.type === 'ConsentRevoked') {
          return event.provider?.toLowerCase() === addressToMatch;
        }
        // For access request events, check if requester matches
        if (event.type === 'AccessRequested' || event.type === 'AccessApproved' || event.type === 'AccessDenied') {
          return event.requester?.toLowerCase() === addressToMatch;
        }
        return false;
      });

      // No deduplication needed - smart contract now only emits AccessApproved for request approvals
      // and ConsentGranted only for direct grants, so no duplicates exist
      const filteredProviderEvents = providerEvents;

      // Fetch patient info for enrichment
      const patientsResponse = await apiClient.getPatients();
      const patients = patientsResponse.success && patientsResponse.data ? patientsResponse.data : [];

      // Enrich events with complete patient info and check for expired consents
      const enrichedEvents: ConsentHistoryEvent[] = filteredProviderEvents.map((event) => {
        // Find patient by address
        const patient = event.patient
          ? patients.find((p) => 
              p.blockchainIntegration?.walletAddress?.toLowerCase() === event.patient?.toLowerCase()
            )
          : null;

        // Check if consent expired (for ConsentGranted events)
        const isExpired = event.type === 'ConsentGranted' && 
          event.expirationTime && 
          new Date(event.expirationTime) < new Date();

        return {
          ...event,
          patientInfo: patient ? {
            patientId: patient.patientId,
            firstName: patient.demographics?.firstName,
            lastName: patient.demographics?.lastName,
            age: patient.demographics?.age,
            gender: patient.demographics?.gender,
            dateOfBirth: patient.demographics?.dateOfBirth as string | null | undefined,
            contact: patient.demographics?.contact as { phone?: string; email?: string } | undefined,
            address: patient.demographics?.address as { street?: string; city?: string; state?: string; zipCode?: string } | undefined,
          } : null,
          isExpired,
        } as ConsentHistoryEvent;
      });

      // Add expired consent events for consents that expired but weren't revoked
      // Get all current consents for this provider to check for expired ones
      try {
        const consentsResponse = await apiClient.getProviderConsentsPaginated(addressToMatch, 1, 100, true);
        if (consentsResponse.success && consentsResponse.data) {
          const consentsArray: ConsentRecord[] = Array.isArray(consentsResponse.data) 
            ? consentsResponse.data 
            : ((consentsResponse.data as { data?: ConsentRecord[] })?.data || []);
          
          const expiredConsents = consentsArray.filter((c: ConsentRecord) => 
            c.isExpired && c.isActive
          );

          // For each expired consent, check if there's already a revocation event
          expiredConsents.forEach((consent) => {
            const hasRevocationEvent = enrichedEvents.some((e) => 
              e.type === 'ConsentRevoked' && e.consentId === consent.consentId
            );

            // If no revocation event exists, add an "expired" event
            if (!hasRevocationEvent) {
              const patient = patients.find((p) => 
                p.blockchainIntegration?.walletAddress?.toLowerCase() === consent.patientAddress.toLowerCase()
              );

              enrichedEvents.push({
                type: 'ConsentExpired',
                blockNumber: 0, // Not a blockchain event
                transactionHash: '',
                consentId: consent.consentId,
                patient: consent.patientAddress,
                provider: addressToMatch,
                dataType: consent.dataType || (consent.dataTypes && consent.dataTypes[0]) || '',
                purpose: consent.purpose || (consent.purposes && consent.purposes[0]) || '',
                dataTypes: consent.dataTypes || (consent.dataType ? [consent.dataType] : []),
                purposes: consent.purposes || (consent.purpose ? [consent.purpose] : []),
                expirationTime: consent.expirationTime,
                timestamp: consent.expirationTime || consent.timestamp,
                patientInfo: patient ? {
                  patientId: patient.patientId,
                  firstName: patient.demographics?.firstName,
                  lastName: patient.demographics?.lastName,
                  age: patient.demographics?.age,
                  gender: patient.demographics?.gender,
                  dateOfBirth: patient.demographics?.dateOfBirth as string | null | undefined,
                  contact: patient.demographics?.contact as { phone?: string; email?: string } | undefined,
                  address: patient.demographics?.address as { street?: string; city?: string; state?: string; zipCode?: string } | undefined,
                } : null,
                isExpired: true,
              });
            }
          });
        }
      } catch (error) {
        // If fetching consents fails, just continue without expired events
        logger.warn('Failed to fetch consents for expired event detection:', error);
      }

      // Sort by timestamp (most recent first)
      enrichedEvents.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      return enrichedEvents;
    },
    enabled: enabled && !!normalizedAddress,
    staleTime: 30000, // Cache for 30 seconds to prevent excessive refetches
    refetchInterval: false, // Disable automatic refetching to prevent loops
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

/**
 * Hook for getting patient consent history (all events)
 */
export function usePatientConsentHistory(
  patientAddress: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['patientConsentHistory', patientAddress?.toLowerCase()],
    queryFn: async () => {
      // Normalize address to lowercase for consistent API calls
      const normalizedAddress = patientAddress.toLowerCase();
      
      // Fetch both consent events and access request events
      const [consentEventsResponse, requestEventsResponse] = await Promise.all([
        apiClient.getConsentEvents(normalizedAddress),
        apiClient.getAccessRequestEvents(normalizedAddress),
      ]);

      // Combine events
      const allEvents = [
        ...(consentEventsResponse.success && consentEventsResponse.data ? consentEventsResponse.data : []),
        ...(requestEventsResponse.success && requestEventsResponse.data ? requestEventsResponse.data : []),
      ];

      // No deduplication needed - smart contract now only emits AccessApproved for request approvals
      // and ConsentGranted only for direct grants, so no duplicates exist
      const filteredEvents = allEvents;

      // Fetch provider info for enrichment
      const providersResponse = await apiClient.getProviders();
      const providers = providersResponse.success && providersResponse.data ? providersResponse.data : [];

      // Enrich events with complete provider info and check for expired consents
      const enrichedEvents: ConsentHistoryEvent[] = filteredEvents.map((event) => {
        // Find provider by address (check both provider and requester fields)
        // ConsentEvent has 'provider', AccessRequestEvent has 'requester'
        const providerAddress = ('provider' in event ? event.provider : undefined) || 
                                ('requester' in event ? event.requester : undefined);
        const provider = providerAddress
          ? providers.find((p) => 
              p.blockchainIntegration?.walletAddress?.toLowerCase() === providerAddress.toLowerCase()
            )
          : null;

        // Check if consent expired (for ConsentGranted events)
        const isExpired = event.type === 'ConsentGranted' && 
          event.expirationTime && 
          new Date(event.expirationTime) < new Date();

        return {
          ...event,
          providerInfo: provider ? {
            organizationName: provider.organizationName,
            providerType: (provider as any).providerType,
            specialties: (provider as any).specialties,
            contact: (provider as any).contact,
            address: (provider as any).address,
          } : ((event as any).providerInfo || null),
          isExpired,
        } as ConsentHistoryEvent;
      });

      // Add expired consent events for consents that expired but weren't revoked
      // Get all current consents to check for expired ones
      try {
        const consentsResponse = await apiClient.getPatientConsentsPaginated(normalizedAddress, 1, 100, true);
        if (consentsResponse.success && consentsResponse.data) {
          // The response.data is { data: ConsentRecord[], pagination: {...} }
          const consentsArray: ConsentRecord[] = Array.isArray(consentsResponse.data) 
            ? consentsResponse.data 
            : ((consentsResponse.data as { data?: ConsentRecord[] })?.data || []);
          
          const expiredConsents = consentsArray.filter((c: ConsentRecord) => 
            c.isExpired && c.isActive
          );

          // For each expired consent, check if there's already a revocation event
          expiredConsents.forEach((consent) => {
            const hasRevocationEvent = enrichedEvents.some((e) => 
              e.type === 'ConsentRevoked' && e.consentId === consent.consentId
            );

            // If no revocation event exists, add an "expired" event
            if (!hasRevocationEvent) {
              // Find provider by address for complete provider info
              const provider = providers.find((p) => 
                p.blockchainIntegration?.walletAddress?.toLowerCase() === consent.providerAddress.toLowerCase()
              );

              enrichedEvents.push({
                type: 'ConsentExpired',
                blockNumber: 0, // Not a blockchain event
                transactionHash: '',
                consentId: consent.consentId,
                patient: normalizedAddress,
                provider: consent.providerAddress,
                dataType: consent.dataType || (consent.dataTypes && consent.dataTypes[0]) || '',
                purpose: consent.purpose || (consent.purposes && consent.purposes[0]) || '',
                dataTypes: consent.dataTypes || (consent.dataType ? [consent.dataType] : []),
                purposes: consent.purposes || (consent.purpose ? [consent.purpose] : []),
                expirationTime: consent.expirationTime,
                timestamp: consent.expirationTime || consent.timestamp,
                providerInfo: provider ? {
                  organizationName: provider.organizationName,
                  providerType: (provider as any).providerType,
                  specialties: (provider as any).specialties,
                  contact: (provider as any).contact,
                  address: (provider as any).address,
                } : null,
                isExpired: true,
              });
            }
          });
        }
      } catch (error) {
        // If fetching consents fails, just continue without expired events
        logger.warn('Failed to fetch consents for expired event detection:', error);
      }

      // Sort by timestamp (most recent first)
      enrichedEvents.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });

      return enrichedEvents;
    },
    enabled: enabled && !!patientAddress,
    staleTime: 0, // Always refetch to get latest history
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Chat message mutation hook
 * Handles streaming chat messages with Groq AI
 */
export function useChatMessage() {
  return useMutation({
    mutationFn: async ({
      message,
      conversationHistory,
      onChunk,
      onToolCall,
    }: {
      message: string;
      conversationHistory?: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string; tool_calls?: unknown[]; tool_call_id?: string }>;
      onChunk: (chunk: string) => void;
      onToolCall?: (toolCalls: unknown[]) => void;
    }) => {
      try {
        await apiClient.streamChatMessage(message, conversationHistory || [], onChunk, onToolCall);
      } catch (error) {
        logger.error('Chat message error', { error });
        throw error;
      }
    },
    onError: (error: Error) => {
      logger.error('Chat mutation error', { error });
      handleError(error);
    },
  });
}
