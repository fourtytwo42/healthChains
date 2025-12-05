'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-context';
import { useRole } from '@/hooks/use-role';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Root Dashboard Page - Redirects to role-based dashboard
 */
export default function DashboardPage() {
  const router = useRouter();
  const { account } = useWallet();
  // Only fetch role when account is available - this prevents unnecessary API calls
  const { role, isLoading } = useRole(account);
  
  // Track if we've already redirected to prevent infinite loops
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Don't do anything if still loading role or no account or already redirected
    if (isLoading || !account || hasRedirected.current) {
      return;
    }

    const roleType = role?.role;
    
    // Only redirect if we have a valid role
    if (roleType === 'provider' || roleType === 'both') {
      hasRedirected.current = true;
      router.replace('/provider');
    } else if (roleType === 'patient') {
      hasRedirected.current = true;
      router.replace('/patient');
    }
    // If role is 'unknown', stay on this page (could show error message)
  }, [account, role?.role, isLoading]);

  // No account connected - show welcome message (don't check role)
  if (!account) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Welcome to HealthChains</h1>
          <p className="text-muted-foreground">
            Please connect your wallet to continue
          </p>
        </div>
      </div>
    );
  }

  // Show loading state when we have an account and are loading role
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  // Account connected but role is unknown
  if (role?.role === 'unknown') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Unknown Role</h1>
          <p className="text-muted-foreground">
            Your wallet address is not registered as a patient or provider.
          </p>
        </div>
      </div>
    );
  }

  // Redirecting...
  return (
    <div className="flex items-center justify-center h-full">
      <Skeleton className="h-8 w-64" />
    </div>
  );
}

