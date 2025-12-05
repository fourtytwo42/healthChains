'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/lib/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { WalletProvider } from '@/contexts/wallet-context';
import { useState } from 'react';

/**
 * Root Providers - Wraps app with React Query, Theme, Wallet, and Toast providers
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <WalletProvider>
          {children}
          <Toaster />
        </WalletProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

