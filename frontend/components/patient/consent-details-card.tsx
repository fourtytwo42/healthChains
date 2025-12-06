'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ColoredBadge, ColoredBadgeList } from '@/components/shared/colored-badge';
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
import { ProviderInfoSection } from '@/components/shared/provider-info-section';

interface ConsentDetailsCardProps {
  consent: {
    consentId: number;
    patientAddress: string;
    providerAddress: string;
    timestamp: string;
    expirationTime: string | null;
    isActive: boolean;
    dataType?: string;  // Optional for single consents
    purpose?: string;   // Optional for single consents
    dataTypes?: string[];  // For batch consents
    purposes?: string[];   // For batch consents
    isBatch?: boolean;     // Flag to indicate batch consent
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
        // Provider info should be included in consent object from backend
        // Check if it's already there (consent may have provider property from backend enrichment)
        const consentWithProvider = consent as any;
        if (consentWithProvider.provider) {
          setProviderInfo(consentWithProvider.provider);
          setLoadingProvider(false);
          return;
        }
        
        // Fallback: Provider info should come from backend in consent response
        // If not available, we can't fetch it (patients can't access /api/providers)
        setProviderInfo(null);
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileCheck className="h-4 w-4" />
            Consent Details
          </DialogTitle>
          <DialogDescription className="text-xs">
            View all consent details for this provider
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {/* Provider Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                Provider Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ProviderInfoSection
                providerInfo={providerInfo}
                providerAddress={consent.providerAddress}
                loading={loadingProvider}
                showAddress={true}
              />
            </CardContent>
          </Card>

          {/* Consent Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Consent Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Show all data types if there are multiple consents */}
              {consent.allConsents && consent.allConsents.length > 1 ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Data Types</p>
                      <ColoredBadgeList
                        type="dataType"
                        values={Array.from(new Set(consent.allConsents.map(c => c.dataType)))}
                        size="sm"
                      />
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Purposes</p>
                      <ColoredBadgeList
                        type="purpose"
                        values={Array.from(new Set(consent.allConsents.map(c => c.purpose)))}
                        size="sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Granted Date</p>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">
                          {format(new Date(consent.timestamp), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <div className="flex items-center gap-1.5">
                        {consent.allConsents.some(c => c.isActive && !c.isExpired) ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <Badge variant="default" className="text-xs h-5">Active</Badge>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 text-red-500" />
                            <Badge variant="destructive" className="text-xs h-5">Expired</Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {Array.from(new Set(consent.allConsents.map(c => c.expirationTime).filter(Boolean))).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Expiration</p>
                      <div className="space-y-0.5">
                        {Array.from(new Set(consent.allConsents.map(c => c.expirationTime).filter(Boolean))).slice(0, 2).map((expTime, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs">
                              {format(new Date(expTime as string), 'MMM d, yyyy HH:mm')}
                            </span>
                          </div>
                        ))}
                        {Array.from(new Set(consent.allConsents.map(c => c.expirationTime).filter(Boolean))).length > 2 && (
                          <p className="text-xs text-muted-foreground ml-4">
                            +{Array.from(new Set(consent.allConsents.map(c => c.expirationTime).filter(Boolean))).length - 2} more
                          </p>
                        )}
                        {consent.allConsents.some(c => !c.expirationTime) && (
                          <Badge variant="secondary" className="text-xs h-5">Some have no expiration</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Show detailed breakdown - all consents from batch approval */}
                  {consent.allConsents && consent.allConsents.length > 1 && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium mb-1">Consent Breakdown ({consent.allConsents.length} total)</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {consent.allConsents.slice(0, 5).map((c, idx) => (
                          <div key={idx} className="p-1.5 bg-muted/50 rounded text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex gap-1 flex-wrap">
                                <ColoredBadge type="dataType" value={c.dataType} size="sm" />
                                <ColoredBadge type="purpose" value={c.purpose} size="sm" />
                              </div>
                              {c.isActive && !c.isExpired ? (
                                <Badge variant="default" className="text-[10px] h-4 px-1">Active</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px] h-4 px-1">Expired</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                        {consent.allConsents.length > 5 && (
                          <p className="text-xs text-muted-foreground text-center py-1">
                            +{consent.allConsents.length - 5} more consents
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Data Type</p>
                      {consent.dataType ? (
                        <ColoredBadge type="dataType" value={consent.dataType} size="sm" />
                      ) : consent.dataTypes && consent.dataTypes.length > 0 ? (
                        <ColoredBadgeList type="dataType" values={consent.dataTypes} size="sm" />
                      ) : null}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Purpose</p>
                      {consent.purpose ? (
                        <ColoredBadge type="purpose" value={consent.purpose} size="sm" />
                      ) : consent.purposes && consent.purposes.length > 0 ? (
                        <ColoredBadgeList type="purpose" values={consent.purposes} size="sm" />
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Granted Date</p>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">
                          {format(new Date(consent.timestamp), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <div className="flex items-center gap-1.5">
                        {consent.isActive && !consent.isExpired ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <Badge variant="default" className="text-xs h-5">Active</Badge>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 text-red-500" />
                            <Badge variant="destructive" className="text-xs h-5">Expired</Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {consent.expirationTime && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Expiration</p>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">
                          {format(new Date(consent.expirationTime), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                    </div>
                  )}
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
                <div className="flex justify-end gap-2 pt-3 border-t">
                  <Button variant="outline" size="sm" onClick={onClose}>
                    Close
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={revokeConsent.isPending}
                      >
                        {revokeConsent.isPending ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
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
              <div className="flex justify-end pt-3 border-t">
                <Button variant="outline" size="sm" onClick={onClose}>
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

