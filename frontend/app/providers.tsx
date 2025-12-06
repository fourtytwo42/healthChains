'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/lib/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { WalletProvider } from '@/contexts/wallet-context';
import { AuthProvider } from '@/contexts/auth-context';
import { NetworkSwitchPrompt } from '@/components/network-switch-prompt';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useState } from 'react';

/**
 * Root Providers - Wraps app with React Query, Theme, Wallet, Auth, and Toast providers
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes (improved from 1 minute)
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            refetchOnWindowFocus: false,
            retry: 2,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <WalletProvider>
            <AuthProvider>
              <NetworkSwitchPrompt />
              {children}
              <Toaster />
            </AuthProvider>
          </WalletProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

