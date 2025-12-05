import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient } from '@/lib/api-client';

export interface UserRole {
  role: 'patient' | 'provider' | 'both' | 'unknown';
  patientId?: string;
  providerId?: string;
}

export interface UseRoleResult {
  role: UserRole | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to detect user role based on connected wallet address
 * @param account - The connected wallet address (from MetaMask)
 * @returns Role information including patient/provider IDs
 */
export function useRole(account: string | null): UseRoleResult {
  // Memoize normalized account to prevent query key changes
  const normalizedAccount = useMemo(() => {
    return account?.toLowerCase() || null;
  }, [account]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['userRole', normalizedAccount],
    queryFn: async () => {
      if (!normalizedAccount) {
        return null;
      }
      const result = await apiClient.getUserRole(normalizedAccount);
      return result;
    },
    enabled: !!normalizedAccount,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // Memoize return value to prevent object recreation
  return useMemo(() => ({
    role: data || null,
    isLoading,
    error: error as Error | null,
  }), [data, isLoading, error]);
}
