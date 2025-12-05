'use client';

import { useState } from 'react';
import { useGrantConsent } from '@/hooks/use-api';
import { useWallet } from '@/contexts/wallet-context';
import { useProviders, useDataTypes, usePurposes } from '@/hooks/use-api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface GrantConsentDialogProps {
  trigger?: React.ReactNode;
}

/**
 * Grant Consent Dialog Component
 * 
 * Form dialog for granting consent to a provider
 */
export function GrantConsentDialog({ trigger }: GrantConsentDialogProps) {
  const { account, isConnected } = useWallet();
  const { data: providers } = useProviders();
  const { data: dataTypes } = useDataTypes();
  const { data: purposes } = usePurposes();
  const grantConsent = useGrantConsent();

  const [open, setOpen] = useState(false);
  const [providerAddress, setProviderAddress] = useState('');
  const [dataType, setDataType] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expirationDays, setExpirationDays] = useState<number | ''>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !account) {
      return;
    }

    // Calculate expiration time (0 for no expiration)
    const expirationTime = expirationDays === '' || expirationDays === 0 
      ? 0 
      : Math.floor(Date.now() / 1000) + (Number(expirationDays) * 24 * 60 * 60);

    grantConsent.mutate(
      {
        providerAddress,
        dataType,
        purpose,
        expirationTime,
      },
      {
        onSuccess: () => {
          setOpen(false);
          // Reset form
          setProviderAddress('');
          setDataType('');
          setPurpose('');
          setExpirationDays('');
        },
      }
    );
  };

  const defaultTrigger = (
    <Button size="sm">
      Grant Consent
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant Consent</DialogTitle>
          <DialogDescription>
            Grant consent to a provider to access your healthcare data.
          </DialogDescription>
        </DialogHeader>
        {!isConnected ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Please connect your wallet to grant consent.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Select value={providerAddress} onValueChange={setProviderAddress} required>
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Select a provider..." />
                </SelectTrigger>
                <SelectContent>
                  {providers?.map((provider) => {
                    const address = provider.blockchainIntegration?.walletAddress;
                    if (!address) return null;
                    return (
                      <SelectItem key={provider.providerId} value={address}>
                        {provider.organizationName} ({address.slice(0, 6)}...{address.slice(-4)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataType">Data Type</Label>
              <Select value={dataType} onValueChange={setDataType} required>
                <SelectTrigger id="dataType">
                  <SelectValue placeholder="Select data type..." />
                </SelectTrigger>
                <SelectContent>
                  {dataTypes?.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose</Label>
              <Select value={purpose} onValueChange={setPurpose} required>
                <SelectTrigger id="purpose">
                  <SelectValue placeholder="Select purpose..." />
                </SelectTrigger>
                <SelectContent>
                  {purposes?.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiration">Expiration (days, leave empty for no expiration)</Label>
              <Input
                id="expiration"
                type="number"
                min="0"
                value={expirationDays}
                onChange={(e) => setExpirationDays(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="No expiration"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={grantConsent.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={grantConsent.isPending}>
                {grantConsent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Grant Consent
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

