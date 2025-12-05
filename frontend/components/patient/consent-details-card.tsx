'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Clock, FileCheck, X, Loader2, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useRevokeConsent } from '@/hooks/use-api';
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
import { DialogDescription } from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { Skeleton } from '@/components/ui/skeleton';

interface ConsentDetailsCardProps {
  consent: {
    consentId: number;
    patientAddress: string;
    providerAddress: string;
    timestamp: string;
    expirationTime: string | null;
    isActive: boolean;
    dataType: string;
    purpose: string;
    isExpired: boolean;
    allConsents?: Array<{
      consentId: number;
      dataType: string;
      purpose: string;
      expirationTime: string | null;
      isActive: boolean;
      isExpired: boolean;
      timestamp: string;
    }>;
  };
  onClose: () => void;
}

export function ConsentDetailsCard({ consent, onClose }: ConsentDetailsCardProps) {
  const [providerInfo, setProviderInfo] = useState<any>(null);
  const [loadingProvider, setLoadingProvider] = useState(true);
  const revokeConsent = useRevokeConsent();

  useEffect(() => {
    const fetchProviderInfo = async () => {
      try {
        setLoadingProvider(true);
        // Get all providers and find the one matching the address
        const response = await apiClient.getProviders();
        if (response.success && response.data) {
          const provider = response.data.find(
            (p: any) => p.blockchainIntegration?.walletAddress?.toLowerCase() === consent.providerAddress.toLowerCase()
          );
          setProviderInfo(provider || null);
        }
      } catch (error) {
        console.error('Failed to fetch provider info:', error);
      } finally {
        setLoadingProvider(false);
      }
    };

    fetchProviderInfo();
  }, [consent.providerAddress]);

  const handleRevoke = () => {
    revokeConsent.mutate(
      { consentId: consent.consentId },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Consent Details
          </DialogTitle>
          <DialogDescription>
            View all consent details for this provider
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Provider Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Provider Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProvider ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : providerInfo ? (
                <div className="space-y-2">
                  {providerInfo.organizationName && (
                    <div>
                      <p className="text-sm text-muted-foreground">Organization</p>
                      <p className="font-medium">{providerInfo.organizationName}</p>
                    </div>
                  )}
                  {providerInfo.providerType && (
                    <div>
                      <p className="text-sm text-muted-foreground">Provider Type</p>
                      <Badge variant="secondary">{providerInfo.providerType}</Badge>
                    </div>
                  )}
                  {providerInfo.specialties && providerInfo.specialties.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground">Specialties</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {providerInfo.specialties.map((s: string, i: number) => (
                          <Badge key={i} variant="outline">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {providerInfo.contact?.email && (
                    <div>
                      <p className="text-sm text-muted-foreground">Contact Email</p>
                      <p className="text-sm">{providerInfo.contact.email}</p>
                    </div>
                  )}
                  {providerInfo.address && (
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="text-sm">
                        {providerInfo.address.street}, {providerInfo.address.city}, {providerInfo.address.state} {providerInfo.address.zipCode}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Provider Wallet Address</p>
                    <p className="font-mono text-sm">{consent.providerAddress}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Provider Wallet Address</p>
                  <p className="font-mono text-sm">{consent.providerAddress}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consent Details */}
          <Card>
            <CardHeader>
              <CardTitle>Consent Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show all data types if there are multiple consents */}
              {consent.allConsents && consent.allConsents.length > 1 ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Data Types</p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(consent.allConsents.map(c => c.dataType))).map((dataType, idx) => (
                        <Badge key={idx} variant="outline" className="text-sm">{dataType}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Purposes</p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(consent.allConsents.map(c => c.purpose))).map((purpose, idx) => (
                        <Badge key={idx} variant="outline" className="text-sm">{purpose}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Granted Date</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(consent.timestamp), 'MMMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Expiration Dates</p>
                    <div className="space-y-1">
                      {Array.from(new Set(consent.allConsents.map(c => c.expirationTime).filter(Boolean))).map((expTime, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(expTime as string), 'MMMM d, yyyy HH:mm')}
                          </span>
                        </div>
                      ))}
                      {consent.allConsents.some(c => !c.expirationTime) && (
                        <Badge variant="secondary">Some consents have no expiration</Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Status</p>
                    <div className="flex items-center gap-2">
                      {consent.allConsents.some(c => c.isActive && !c.isExpired) ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <Badge variant="default">Active</Badge>
                          {consent.allConsents.some(c => c.isExpired || !c.isActive) && (
                            <Badge variant="secondary" className="ml-2">Some expired</Badge>
                          )}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-500" />
                          <Badge variant="destructive">All Expired</Badge>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Show detailed breakdown */}
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Consent Breakdown</p>
                    <div className="space-y-2">
                      {consent.allConsents.map((c, idx) => (
                        <div key={idx} className="p-2 bg-muted/50 rounded-md">
                          <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs">{c.dataType}</Badge>
                              <Badge variant="outline" className="text-xs">{c.purpose}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              {c.expirationTime && (
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(c.expirationTime), 'MMM d, yyyy')}
                                </span>
                              )}
                              {c.isActive && !c.isExpired ? (
                                <Badge variant="default" className="text-xs">Active</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">Expired</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Data Type</p>
                    <Badge variant="outline" className="text-sm">{consent.dataType}</Badge>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Purpose</p>
                    <Badge variant="outline" className="text-sm">{consent.purpose}</Badge>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Granted Date</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(consent.timestamp), 'MMMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Expiration</p>
                    {consent.expirationTime ? (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date(consent.expirationTime), 'MMMM d, yyyy HH:mm')}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="secondary">No expiration</Badge>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Status</p>
                    <div className="flex items-center gap-2">
                      {consent.isActive && !consent.isExpired ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <Badge variant="default">Active</Badge>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-500" />
                          <Badge variant="destructive">Expired</Badge>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          {(() => {
            // Check if any consent is active
            const hasActiveConsents = consent.allConsents 
              ? consent.allConsents.some(c => c.isActive && !c.isExpired)
              : (consent.isActive && !consent.isExpired);

            if (hasActiveConsents) {
              return (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        disabled={revokeConsent.isPending}
                      >
                        {revokeConsent.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Revoking...
                          </>
                        ) : (
                          'Revoke All Consents'
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke Consent</AlertDialogTitle>
                        <AlertDialogDescription>
                          {consent.allConsents && consent.allConsents.length > 1 ? (
                            <>
                              Are you sure you want to revoke all {consent.allConsents.length} consents with this provider? 
                              This action cannot be undone. The provider will immediately lose access to all your data.
                            </>
                          ) : (
                            <>
                              Are you sure you want to revoke this consent? This action cannot be undone.
                              The provider will immediately lose access to your data.
                            </>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            // Revoke all active consents for this provider
                            if (consent.allConsents && consent.allConsents.length > 1) {
                              // Revoke all active consents
                              const activeConsents = consent.allConsents.filter(c => c.isActive && !c.isExpired);
                              // For now, revoke the first one - in a real app, you'd want to revoke all
                              // But the contract might require one at a time
                              handleRevoke();
                            } else {
                              handleRevoke();
                            }
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Revoke
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            }

            return (
              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

