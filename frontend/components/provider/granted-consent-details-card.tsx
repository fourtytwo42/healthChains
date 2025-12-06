'use client';

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ColoredBadge, ColoredBadgeList } from '@/components/shared/colored-badge';
import { Calendar, History, Clock, CheckCircle, X, Users } from 'lucide-react';
import { useProviderPatientData, useProviderConsentHistory } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface GrantedConsentDetailsCardProps {
  patientId: string;
  patientWalletAddress?: string;
  providerAddress: string;
  onClose: () => void;
  onOpenMedicalChart?: (patientId: string) => void;
}

/**
 * Granted Consent Details Card Component
 * Shows demographics, active consents, and consent history (no medical data)
 */
export function GrantedConsentDetailsCard({
  patientId,
  patientWalletAddress,
  providerAddress,
  onClose,
  onOpenMedicalChart,
}: GrantedConsentDetailsCardProps) {
  // Fetch patient data filtered by consent
  const { data, isLoading, error } = useProviderPatientData(providerAddress, patientId);

  // Fetch provider history - only when we have patient wallet address
  const shouldFetchHistory = !!patientWalletAddress && !!providerAddress;
  const { data: providerHistoryData } = useProviderConsentHistory(
    providerAddress,
    shouldFetchHistory
  );

  // Memoize history to stable array
  const providerHistory = useMemo(
    () => (Array.isArray(providerHistoryData) ? providerHistoryData : []),
    [providerHistoryData]
  );

  // Filter history to only show events for this specific patient
  const patientHistory = useMemo(() => {
    if (!providerHistory || !Array.isArray(providerHistory)) return [];
    if (!patientWalletAddress) return [];
    
    return providerHistory.filter((event: any) => {
      const eventPatientAddress = event.patient?.toLowerCase() || event.patientAddress?.toLowerCase();
      return eventPatientAddress === patientWalletAddress.toLowerCase();
    });
  }, [providerHistory, patientWalletAddress]);

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Patient Details...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !data?.data) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Error Loading Patient Data</DialogTitle>
            <DialogDescription>
              {error?.message || 'Failed to load patient data'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const patientData = data.data;
  const consentInfo = (patientData as any).consentInfo || [];
  const hasNoConsent = consentInfo.length === 0;

  // Determine event styling
  const getEventStyling = (eventType: string) => {
    switch (eventType) {
      case 'ConsentGranted':
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          color: 'text-green-700 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950/20',
          borderColor: 'border-green-200 dark:border-green-800',
        };
      case 'ConsentRevoked':
        return {
          icon: <X className="h-3 w-3" />,
          color: 'text-red-700 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-950/20',
          borderColor: 'border-red-200 dark:border-red-800',
        };
      case 'ConsentExpired':
        return {
          icon: <Clock className="h-3 w-3" />,
          color: 'text-orange-700 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-950/20',
          borderColor: 'border-orange-200 dark:border-orange-800',
        };
      case 'AccessRequested':
        return {
          icon: <Users className="h-3 w-3" />,
          color: 'text-blue-700 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-950/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
        };
      case 'AccessApproved':
        return {
          icon: <CheckCircle className="h-3 w-3" />,
          color: 'text-green-700 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-950/20',
          borderColor: 'border-green-200 dark:border-green-800',
        };
      case 'AccessDenied':
        return {
          icon: <X className="h-3 w-3" />,
          color: 'text-red-700 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-950/20',
          borderColor: 'border-red-200 dark:border-red-800',
        };
      default:
        return {
          icon: <History className="h-3 w-3" />,
          color: 'text-gray-700 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-950/20',
          borderColor: 'border-gray-200 dark:border-gray-800',
        };
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg">
            Consent Details - {patientData.patientId}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Patient demographics, active consents, and consent history
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Demographics - Always visible */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Demographics</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  {onOpenMedicalChart ? (
                    <button
                      onClick={() => {
                        onOpenMedicalChart(patientId);
                        onClose();
                      }}
                      className="font-medium text-sm text-primary hover:underline cursor-pointer text-left"
                    >
                      {((patientData.demographics as any)?.firstName || '')} {((patientData.demographics as any)?.lastName || '')}
                    </button>
                  ) : (
                    <p className="font-medium text-sm">
                      {((patientData.demographics as any)?.firstName || '')} {((patientData.demographics as any)?.lastName || '')}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Age</p>
                  <p className="font-medium text-sm">{(patientData.demographics as any)?.age || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gender</p>
                  <p className="font-medium text-sm">{(patientData.demographics as any)?.gender || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date of Birth</p>
                  <p className="font-medium text-sm">
                    {(patientData.demographics as any)?.dateOfBirth
                      ? format(new Date((patientData.demographics as any).dateOfBirth), 'MMM d, yyyy')
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Show message if no consent */}
          {hasNoConsent && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">No Active Consents</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    You don't have active consent to view this patient's data.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Consents - Only show if there are consents */}
          {!hasNoConsent && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Active Consents</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {consentInfo.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No active consents</p>
                ) : (
                  <div className="space-y-2">
                    {consentInfo.map((consent: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="flex items-center gap-2">
                          {(consent.dataTypes && consent.dataTypes.length > 0) ? (
                            <ColoredBadgeList type="dataType" values={consent.dataTypes} size="sm" />
                          ) : consent.dataType ? (
                            <ColoredBadge type="dataType" value={consent.dataType} size="sm" />
                          ) : null}
                          {(consent.purposes && consent.purposes.length > 0) ? (
                            <ColoredBadgeList type="purpose" values={consent.purposes} size="sm" />
                          ) : consent.purpose ? (
                            <ColoredBadge type="purpose" value={consent.purpose} size="sm" />
                          ) : null}
                        </div>
                        {consent.expirationTime && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Expires: {format(new Date(consent.expirationTime), 'MMM d, yyyy')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Consent History */}
          {patientHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Consent History
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {patientHistory.slice(0, 10).map((event: any, index: number) => {
                    const styling = getEventStyling(event.type);
                    const eventTypeLabels: Record<string, string> = {
                      'ConsentGranted': 'Granted',
                      'ConsentRevoked': 'Revoked',
                      'ConsentExpired': 'Expired',
                      'AccessRequested': 'Request Sent',
                      'AccessApproved': 'Approved',
                      'AccessDenied': 'Denied',
                    };

                    return (
                      <div
                        key={`${event.type}-${event.consentId || event.requestId}-${index}`}
                        className={`flex items-center gap-2 p-1.5 border-l-2 rounded ${styling.borderColor} ${styling.bgColor}`}
                      >
                        <div className={`flex-shrink-0 ${styling.color}`}>
                          {styling.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-semibold ${styling.color}`}>
                              {eventTypeLabels[event.type] || event.type}
                            </span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {format(new Date(event.timestamp), 'MMM d, yyyy')}
                            </span>
                          </div>
                          {(event.dataTypes || event.dataType) && (event.purposes || event.purpose) && (
                            <div className="flex items-center gap-1 mt-0.5">
                              {(event.dataTypes && event.dataTypes.length > 0) ? (
                                <ColoredBadgeList type="dataType" values={event.dataTypes.slice(0, 2)} size="sm" />
                              ) : event.dataType ? (
                                <ColoredBadge type="dataType" value={event.dataType} size="sm" />
                              ) : null}
                              {(event.purposes && event.purposes.length > 0) ? (
                                <ColoredBadgeList type="purpose" values={event.purposes.slice(0, 2)} size="sm" />
                              ) : event.purpose ? (
                                <ColoredBadge type="purpose" value={event.purpose} size="sm" />
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {patientHistory.length > 10 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing latest 10 of {patientHistory.length} events
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

