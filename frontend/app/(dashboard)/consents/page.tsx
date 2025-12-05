'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePatientConsents, usePatients, useRevokeConsent } from '@/hooks/use-api';
import { useWallet } from '@/contexts/wallet-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { GrantConsentDialog } from '@/components/consent-grant-dialog';
import { FileCheck, Calendar, Clock, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

/**
 * Consents Page - View and manage patient consents
 */
export default function ConsentsPage() {
  const { data: patients } = usePatients();
  const { account, isConnected } = useWallet();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [includeExpired, setIncludeExpired] = useState(false);

  // Find the selected patient and get their wallet address
  const selectedPatient = patients?.find((p) => p.patientId === selectedPatientId);
  const patientAddress = selectedPatient?.blockchainIntegration?.walletAddress;

  const { data: consents, isLoading, error } = usePatientConsents(
    patientAddress || '',
    includeExpired
  );
  const revokeConsent = useRevokeConsent();

  // Note: patientAddress is no longer needed since we use the connected wallet account

  const handleRevoke = (consentId: number) => {
    if (!account || !isConnected) return;
    revokeConsent.mutate({ consentId });
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Consents</h1>
          <p className="text-muted-foreground">View and manage patient consent records</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load consents. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Consents</h1>
        <p className="text-muted-foreground">View and manage patient consent records</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Consent History</CardTitle>
              <CardDescription>Select a patient to view their consent records</CardDescription>
            </div>
            {isConnected && account && (
              <GrantConsentDialog />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="patient-select">Patient</Label>
              <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                <SelectTrigger id="patient-select">
                  <SelectValue placeholder="Select a patient..." />
                </SelectTrigger>
                <SelectContent>
                  {patients?.map((patient) => {
                    const hasWallet = !!patient.blockchainIntegration?.walletAddress;
                    return (
                      <SelectItem 
                        key={patient.patientId} 
                        value={patient.patientId}
                        disabled={!hasWallet}
                      >
                        {patient.demographics.firstName} {patient.demographics.lastName} (
                        {patient.patientId})
                        {!hasWallet && ' (No wallet)'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                id="include-expired"
                checked={includeExpired}
                onCheckedChange={setIncludeExpired}
              />
              <Label htmlFor="include-expired">Include expired</Label>
            </div>
          </div>

          {!selectedPatientId || !patientAddress ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Please select a patient to view consents.</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : consents && consents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consent ID</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Data Type</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiration</TableHead>
                  {isConnected && account && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {consents.map((consent) => (
                  <TableRow key={consent.consentId}>
                    <TableCell className="font-mono text-sm">{consent.consentId}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {consent.providerAddress.slice(0, 6)}...{consent.providerAddress.slice(-4)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{consent.dataType}</Badge>
                    </TableCell>
                    <TableCell>{consent.purpose}</TableCell>
                    <TableCell>
                      {consent.isExpired || !consent.isActive ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {consent.expirationTime ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(consent.expirationTime), 'MMM d, yyyy')}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No expiration</span>
                      )}
                    </TableCell>
                    {isConnected && account && (
                      <TableCell>
                        {consent.isActive && !consent.isExpired && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={revokeConsent.isPending}
                              >
                                {revokeConsent.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <X className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke Consent</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to revoke this consent? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRevoke(consent.consentId)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Revoke
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No consents found for this patient.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

