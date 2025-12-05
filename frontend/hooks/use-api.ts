/**
 * API Hooks - React Query hooks for backend API calls
 * 
 * Provides typed, cached, and resilient data fetching with React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, type Patient, type Provider, type ConsentRecord, type AccessRequest, type ConsentStatus, type ConsentEvent, type AccessRequestEvent } from '@/lib/api-client';
import { toast } from 'sonner';

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

// Patients
export function usePatients() {
  return useQuery({
    queryKey: queryKeys.patients,
    queryFn: async () => {
      const response = await apiClient.getPatients();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch patients');
      }
      return response.data;
    },
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
      for (const provider of data.providers) {
        if (!provider || provider === '0x0000000000000000000000000000000000000000') {
          throw new Error('Invalid provider address');
        }
      }

      // Generate all combinations (cartesian product)
      // For each provider, data type, and purpose combination
      const providers: string[] = [];
      const dataTypes: string[] = [];
      const purposes: string[] = [];
      const expirationTimes: number[] = [];

      for (const provider of data.providers) {
        for (const dataType of data.dataTypes) {
          // Validate data type is not empty
          if (!dataType || dataType.trim().length === 0) {
            throw new Error('Data type cannot be empty');
          }
          for (const purpose of data.purposes) {
            // Validate purpose is not empty
            if (!purpose || purpose.trim().length === 0) {
              throw new Error('Purpose cannot be empty');
            }
            providers.push(provider);
            dataTypes.push(dataType);
            purposes.push(purpose);
            expirationTimes.push(expirationTime);
          }
        }
      }

      const totalConsents = providers.length;

      // Validate batch size doesn't exceed contract limit
      if (totalConsents > 50) {
        throw new Error('Too many consents. Maximum 50 consents per transaction.');
      }

      // Use single function if only one consent, batch otherwise
      if (totalConsents === 1) {
        // Single consent
        const tx = await contract.grantConsent(
          providers[0],
          dataTypes[0],
          expirationTimes[0],
          purposes[0]
        );

        const receipt = await waitForTransaction(tx);

        // Extract consent ID from event
        let consentId: number | null = null;
        for (const log of receipt.logs) {
          try {
            const parsed = contract.interface.parseLog(log);
            if (parsed && parsed.name === 'ConsentGranted') {
              consentId = Number(parsed.args.consentId);
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
      } else {
        // Batch consent - all combinations in one transaction
        // Add validation and error handling
        try {
          // Log what we're sending for debugging
          console.log('Granting batch consent:', {
            count: totalConsents,
            providers: providers.length,
            dataTypes: dataTypes.length,
            purposes: purposes.length,
            expirationTimes: expirationTimes.length,
            sampleProvider: providers[0],
            sampleDataType: dataTypes[0],
            samplePurpose: purposes[0],
            sampleExpiration: expirationTimes[0],
            expirationDate: expirationTime > 0 ? new Date(expirationTime * 1000).toISOString() : 'none',
          });

          // Validate all arrays have same length
          if (providers.length !== dataTypes.length || 
              providers.length !== purposes.length || 
              providers.length !== expirationTimes.length) {
            throw new Error('Array length mismatch. This should not happen.');
          }

          // Validate all provider addresses
          for (let i = 0; i < providers.length; i++) {
            if (!providers[i] || providers[i] === '0x0000000000000000000000000000000000000000') {
              throw new Error(`Invalid provider address at index ${i}: ${providers[i]}`);
            }
            if (!ethers.isAddress(providers[i])) {
              throw new Error(`Invalid address format at index ${i}: ${providers[i]}`);
            }
          }

          const tx = await contract.grantConsentBatch(
            providers,
            dataTypes,
            expirationTimes,
            purposes
          );

          const receipt = await waitForTransaction(tx);

        // Extract consent IDs from batch event
        let consentIds: number[] = [];
        for (const log of receipt.logs) {
          try {
            const parsed = contract.interface.parseLog(log);
            if (parsed && parsed.name === 'ConsentBatchGranted') {
              // Event signature: ConsentBatchGranted(address indexed patient, uint256[] consentIds, uint128 timestamp)
              // consentIds is the second argument (index 1)
              const ids = parsed.args[1] as bigint[];
              if (ids && Array.isArray(ids)) {
                consentIds = ids.map((id) => Number(id));
              }
              break;
            }
          } catch {
            continue;
          }
        }

          return {
            consentIds,
            transactionHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
          };
        } catch (error: any) {
          // Try to decode the error - ethers v6 error handling
          let errorMessage = error.message || 'Unknown error';
          
          // Log full error for debugging
          console.error('Grant consent error details:', {
            message: error.message,
            reason: error.reason,
            shortMessage: error.shortMessage,
            data: error.data,
            code: error.code,
            cause: error.cause,
          });
          
          // Check for ethers v6 error properties
          if (error.reason) {
            errorMessage = error.reason;
          } else if (error.shortMessage) {
            errorMessage = error.shortMessage;
          } else if (error.data) {
            // Try to decode error data using contract interface
            try {
              const iface = contract.interface;
              // Try to parse as a custom error
              const decoded = iface.parseError(error.data);
              if (decoded) {
                errorMessage = `${decoded.name}: ${decoded.args.join(', ')}`;
              } else if (error.data === '0x' || error.data.length < 10) {
                // Empty error data - likely a require(false) or similar
                errorMessage = 'Transaction reverted. Please check: expiration date must be in the future, provider addresses must be valid, and you cannot grant consent to yourself.';
              } else {
                errorMessage = `Contract revert: ${error.data.slice(0, 20)}...`;
              }
            } catch (decodeError) {
              // If we can't decode, provide helpful message
              if (error.data === '0x' || error.data.length < 10) {
                errorMessage = 'Transaction reverted. Please verify: expiration date is in the future, all provider addresses are valid, and you are not granting consent to yourself.';
              } else {
                errorMessage = `Contract error (unable to decode): ${error.data.slice(0, 30)}...`;
              }
            }
          } else if (error.message?.includes('revert') || error.message?.includes('reverted')) {
            errorMessage = 'Transaction reverted. Please check your selections and try again.';
          }
          
          // Re-throw with decoded message
          throw new Error(errorMessage);
        }
      }
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
      queryClient.invalidateQueries({ queryKey: ['consentStatus'] });
      queryClient.invalidateQueries({ queryKey: ['consentEvents'] });
    },
    onError: (error: Error) => {
      let message = error.message;
      
      // Handle specific contract errors
      if (error.message.includes('ExpirationInPast') || error.message.includes('expiration')) {
        message = 'Expiration date must be in the future. Please select a future date.';
      } else if (error.message.includes('user rejected') || error.message.includes('User rejected')) {
        message = 'Transaction was rejected';
      } else if (error.message.includes('EmptyBatch') || error.message.includes('Empty')) {
        message = 'Invalid selection. Please ensure all fields are properly selected.';
      } else if (error.message.includes('InvalidAddress') || error.message.includes('address')) {
        message = 'Invalid provider address. Please select a valid provider.';
      } else if (error.message.includes('CannotGrantConsentToSelf')) {
        message = 'Cannot grant consent to yourself.';
      } else if (error.message.includes('require(false)')) {
        message = 'Transaction failed validation. Please check your selections and try again.';
      }
      
      toast.error('Failed to grant consent', {
        description: message,
      });
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
      queryClient.invalidateQueries({ queryKey: ['consentStatus'] });
      queryClient.invalidateQueries({ queryKey: ['consentEvents'] });
    },
    onError: (error: Error) => {
      const message = error.message.includes('user rejected') || error.message.includes('User rejected')
        ? 'Transaction was rejected'
        : error.message;
      toast.error('Failed to revoke consent', {
        description: message,
      });
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
      dataType: string;
      purpose: string;
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

      // Call contract - MetaMask will prompt user to sign
      const tx = await contract.requestAccess(
        data.patientAddress,
        data.dataType,
        data.purpose,
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
      const message = error.message.includes('user rejected') || error.message.includes('User rejected')
        ? 'Transaction was rejected'
        : error.message;
      toast.error('Failed to create access request', {
        description: message,
      });
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
      queryClient.invalidateQueries({ queryKey: ['accessRequestEvents'] });
    },
    onError: (error: Error) => {
      const message = error.message.includes('user rejected') || error.message.includes('User rejected')
        ? 'Transaction was rejected'
        : error.message;
      toast.error('Failed to approve request', {
        description: message,
      });
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
    queryKey: ['providerPatients', providerAddress, page, limit],
    queryFn: async () => {
      const response = await apiClient.getProviderPatients(providerAddress, page, limit);
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch provider patients');
      }
      return response.data;
    },
    enabled: enabled && !!providerAddress,
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
    queryKey: ['patientConsents', patientAddress, page, limit, includeExpired],
    queryFn: async () => {
      const response = await apiClient.getPatientConsentsPaginated(
        patientAddress,
        page,
        limit,
        includeExpired
      );
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch patient consents');
      }
      return response.data;
    },
    enabled: enabled && !!patientAddress,
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

