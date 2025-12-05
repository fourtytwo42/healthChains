'use client';

import { useWallet } from '@/contexts/wallet-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, LogOut, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Wallet Connector Component
 * 
 * Displays wallet connection status and provides connect/disconnect functionality.
 * Shows network mismatch warnings and allows network switching.
 */
export function WalletConnector() {
  const { isConnected, account, chainId, isConnecting, error, connect, disconnect, switchNetwork, checkNetwork } = useWallet();

  const EXPECTED_CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '1337', 10);
  // Compare chain IDs - must match exactly
  const networkMatches = chainId !== null && Number(chainId) === EXPECTED_CHAIN_ID;

  /**
   * Format address for display (truncate middle)
   */
  const formatAddress = (address: string | null): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  /**
   * Handle connect with network check
   */
  const handleConnect = async () => {
    if (!networkMatches && chainId !== null) {
      // Try to switch network first
      try {
        await switchNetwork(EXPECTED_CHAIN_ID);
        // Wait a bit for network switch
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (switchError) {
        console.error('Failed to switch network:', switchError);
      }
    }
    await connect();
  };

  if (!isConnected) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={isConnecting}>
            <Wallet className="mr-2 h-4 w-4" />
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect MetaMask Wallet</DialogTitle>
            <DialogDescription>
              Connect your MetaMask wallet to interact with the consent management system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
            {chainId !== null && !networkMatches && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>Network mismatch. Please switch to chain ID {EXPECTED_CHAIN_ID}</span>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      await switchNetwork(EXPECTED_CHAIN_ID);
                      await connect();
                    } catch (err) {
                      console.error('Failed to switch network:', err);
                    }
                  }}
                  className="w-full"
                >
                  Switch Network
                </Button>
              </div>
            )}
            <Button onClick={handleConnect} className="w-full" disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {!networkMatches && (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Wrong Network
        </Badge>
      )}
      <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400">
        <Wallet className="h-3 w-3" />
        {formatAddress(account)}
      </Badge>
      <Button variant="ghost" size="sm" onClick={disconnect} aria-label="Disconnect wallet">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}

