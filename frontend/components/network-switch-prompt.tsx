'use client';

import { useState } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { getNetworkConfig } from '@/lib/network-config';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Network Switch Prompt Component
 * 
 * Automatically detects when MetaMask is on the wrong network and prompts
 * the user to switch. Automatically adds the network if it doesn't exist.
 */
export function NetworkSwitchPrompt() {
  const { isWrongNetwork, isConnected, chainId, switchToCorrectNetwork, expectedRpcUrl } = useWallet();
  const [isSwitching, setIsSwitching] = useState(false);
  const networkConfig = getNetworkConfig();

  // Don't show if not connected or network is correct
  if (!isConnected || !isWrongNetwork) {
    return null;
  }

  const handleSwitchNetwork = async () => {
    setIsSwitching(true);
    try {
      await switchToCorrectNetwork();
      toast.success('Network switched successfully');
      // The chainChanged event will update the state automatically
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to switch network';
      toast.error(errorMessage);
      console.error('Network switch error:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-semibold text-destructive mb-1">Wrong Network</h3>
            <p className="text-sm text-foreground">
              You are connected to Chain ID {chainId}, but this app requires{' '}
              <strong>{networkConfig.chainName}</strong> (Chain ID: {networkConfig.chainId}).
            </p>
            {expectedRpcUrl && (
              <p className="text-xs text-muted-foreground mt-1">
                RPC URL: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{expectedRpcUrl}</code>
              </p>
            )}
          </div>
          <Button
            onClick={handleSwitchNetwork}
            disabled={isSwitching}
            size="sm"
            variant="destructive"
          >
            {isSwitching ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Switching...
              </>
            ) : (
              `Switch to ${networkConfig.chainName}`
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            If the network doesn't exist in MetaMask, it will be added automatically with the correct RPC URL.
          </p>
        </div>
      </div>
    </div>
  );
}

