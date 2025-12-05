import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useEffect, useCallback } from 'react';

export interface Notification {
  requestId: number;
  requester: string;
  patient: string;
  dataType?: string;
  purpose?: string;
  expirationTime?: string | null;
  timestamp: string;
  provider?: {
    providerId: string;
    organizationName: string;
    providerType: string;
  } | null;
}

const NOTIFICATIONS_STORAGE_KEY = 'healthchains_notifications_read';

/**
 * Hook for managing patient notifications (pending access requests)
 * Polls for new requests every 30 seconds and tracks read state in localStorage
 */
export function useNotifications(patientAddress: string | null) {
  const queryClient = useQueryClient();

  // Fetch pending requests
  const { data, isLoading, error } = useQuery({
    queryKey: ['patientPendingRequests', patientAddress],
    queryFn: async () => {
      if (!patientAddress) return { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      const response = await apiClient.getPatientPendingRequests(patientAddress, 1, 100);
      if (!response.success) {
        return { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } };
      }
      // The API returns {success: true, data: [...], pagination: {...}}
      // response.data is the array, response.pagination is the pagination info
      return {
        data: response.data || [],
        pagination: response.pagination || { page: 1, limit: 10, total: (response.data || []).length, totalPages: 1 }
      };
    },
    enabled: !!patientAddress,
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 10000, // Consider stale after 10 seconds
  });

  // Get read state from localStorage
  const getReadState = useCallback((): Set<number> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (!stored) return new Set();
      const parsed = JSON.parse(stored) as number[];
      return new Set(parsed);
    } catch {
      return new Set();
    }
  }, []);

  // Save read state to localStorage
  const saveReadState = useCallback((readIds: Set<number>) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(Array.from(readIds)));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((requestId: number) => {
    const readState = getReadState();
    readState.add(requestId);
    saveReadState(readState);
    queryClient.invalidateQueries({ queryKey: ['patientPendingRequests', patientAddress] });
  }, [getReadState, saveReadState, queryClient, patientAddress]);

  // Clear all notifications (mark all as read)
  const clearAll = useCallback(() => {
    if (!data?.data) return;
    const readState = getReadState();
    data.data.forEach(notification => {
      readState.add(notification.requestId);
    });
    saveReadState(readState);
    queryClient.invalidateQueries({ queryKey: ['patientPendingRequests', patientAddress] });
  }, [data, getReadState, saveReadState, queryClient, patientAddress]);

  // Dismiss notification (remove from list - for now just mark as read)
  const dismiss = useCallback((requestId: number) => {
    markAsRead(requestId);
  }, [markAsRead]);

  const readState = getReadState();
  const notifications: Notification[] = (data?.data || []).map(req => ({
    requestId: req.requestId,
    requester: req.requester,
    patient: (req as any).patientAddress || (req as any).patient || '',
    dataType: req.dataType,
    purpose: req.purpose,
    expirationTime: req.expirationTime,
    timestamp: req.timestamp,
    provider: (req as any).provider,
  }));

  const unreadNotifications = notifications.filter(n => !readState.has(n.requestId));
  const unreadCount = unreadNotifications.length;

  return {
    notifications,
    unreadNotifications,
    unreadCount,
    isLoading,
    error: error as Error | null,
    markAsRead,
    clearAll,
    dismiss,
  };
}

