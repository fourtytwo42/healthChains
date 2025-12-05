'use client';

import { ThemeToggle } from '@/components/theme-toggle';
import { WalletConnector } from '@/components/wallet-connector';
import { useContractInfo } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Header Component with theme toggle, wallet connector, and network status
 */
export function Header() {
  const { data: contractInfo, isLoading } = useContractInfo();

  return (
    <header role="banner" className="flex h-16 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold">Patient Consent Management</h1>
        {isLoading ? (
          <Skeleton className="h-5 w-24" />
        ) : contractInfo?.web3?.connected ? (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400">
            Connected
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
            Disconnected
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-4">
        <WalletConnector />
        <ThemeToggle />
      </div>
    </header>
  );
}

