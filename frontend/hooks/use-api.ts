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
    queryFn: () => apiClient.healthCheck(),
    refetchInterval: 30000, // Check every 30 seconds
  });
}

// Contract info
export function useContractInfo() {
  return useQuery({
    queryKey: queryKeys.contractInfo,
    queryFn: () => apiClient.getContractInfo(),
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
    enabled: !!patientAddress,
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
 */
export function useGrantConsent() {
  const queryClient = useQueryClient();
  const { getSigner, account } = useWallet();

  return useMutation({
    mutationFn: async (data: {
      providerAddress: string;
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
      const tx = await contract.grantConsent(
        data.providerAddress,
        data.dataType,
        expirationTime,
        data.purpose
      );

      // Wait for transaction confirmation
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
        consentId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    },
    onSuccess: (data) => {
      toast.success('Consent granted successfully', {
        description: `Transaction: ${data.transactionHash.slice(0, 10)}...`,
      });
      // Invalidate relevant queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['consents'] });
      queryClient.invalidateQueries({ queryKey: ['consentStatus'] });
      queryClient.invalidateQueries({ queryKey: ['consentEvents'] });
    },
    onError: (error: Error) => {
      const message = error.message.includes('user rejected') || error.message.includes('User rejected')
        ? 'Transaction was rejected'
        : error.message;
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

