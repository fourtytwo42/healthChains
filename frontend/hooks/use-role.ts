import { useQuery } from '@tanstack/react-query';
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
  const { data, isLoading, error } = useQuery({
    queryKey: ['userRole', account],
    queryFn: async () => {
      if (!account) {
        return null;
      }
      // Normalize address to lowercase for consistent API calls
      const normalizedAddress = account.toLowerCase();
      const result = await apiClient.getUserRole(normalizedAddress);
      
      // Debug logging
      console.log('[useRole] Account:', account);
      console.log('[useRole] Normalized:', normalizedAddress);
      console.log('[useRole] Result:', result);
      
      return result;
    },
    enabled: !!account, // Only run when account exists
    staleTime: 0, // Don't cache - always refetch when account changes
    retry: 1,
    refetchOnWindowFocus: false, // Don't refetch on window focus to avoid unnecessary calls
  });

  return {
    role: data || null,
    isLoading,
    error: error as Error | null,
  };
}

