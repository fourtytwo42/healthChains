'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, LogOut, AlertCircle, CheckCircle2 } from 'lucide-react';
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
  const { isConnected, account, chainId, isConnecting, error, isWrongNetwork, connect, disconnect, switchToCorrectNetwork } = useWallet();
  const { isAuthenticated, isAuthenticating, authenticate } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

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
    if (isWrongNetwork) {
      // Try to switch network first
      try {
        await switchToCorrectNetwork();
        // Wait a bit for network switch
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (switchError) {
        console.error('Failed to switch network:', switchError);
      }
    }
    await connect();
    // Close dialog after successful connection
    setTimeout(() => {
      if (!error) {
        setDialogOpen(false);
      }
    }, 500);
  };

  if (!isConnected) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
            {isWrongNetwork && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>Please switch to the correct network</span>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      await switchToCorrectNetwork();
                      await connect();
                      setDialogOpen(false);
                    } catch (err) {
                      console.error('Failed to switch network:', err);
                    }
                  }}
                  className="w-full"
                  disabled={isConnecting}
                >
                  Switch Network
                </Button>
              </div>
            )}
            <Button 
              onClick={async () => {
                try {
                  await handleConnect();
                  // Close dialog on successful connection (check after a short delay)
                  setTimeout(() => {
                    if (!error && !isConnecting) {
                      setDialogOpen(false);
                    }
                  }, 500);
                } catch (err) {
                  console.error('Failed to connect:', err);
                }
              }} 
              className="w-full" 
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isWrongNetwork && (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Wrong Network
        </Badge>
      )}
      {isAuthenticated ? (
        <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          Authenticated
        </Badge>
      ) : isAuthenticating ? (
        <Badge variant="outline" className="gap-1">
          Authenticating...
        </Badge>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={authenticate}
          disabled={isAuthenticating}
          className="gap-1"
        >
          Authenticate
        </Button>
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

