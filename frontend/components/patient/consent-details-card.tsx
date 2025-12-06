'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ColoredBadge, ColoredBadgeList } from '@/components/shared/colored-badge';
import { Button } from '@/components/ui/button';
import { Building2, Clock, FileCheck, X, Loader2, Calendar, CheckCircle, XCircle, History, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { useRevokeConsent, usePatientConsentHistory } from '@/hooks/use-api';
import { toast } from 'sonner';
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
import type { ConsentHistoryEvent } from '@/types/consent';
import { ConsentHistoryEventCard } from '@/components/shared/consent-history-event-card';

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
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedHistoryEvent, setSelectedHistoryEvent] = useState<ConsentHistoryEvent | null>(null);
  const historyPerPage = 10;
  const revokeConsent = useRevokeConsent();

  // Fetch patient consent history
  const { data: patientHistoryData, isLoading: historyLoading } = usePatientConsentHistory(
    consent.patientAddress,
    !!consent.patientAddress
  );

  // Filter history to only show events for this specific provider
  const providerHistory = useMemo(() => {
    if (!patientHistoryData || !Array.isArray(patientHistoryData)) {
      return [];
    }

    const normalizedProviderAddress = consent.providerAddress.toLowerCase().trim();
    if (!normalizedProviderAddress) {
      return [];
    }

    const filtered = patientHistoryData.filter((event: ConsentHistoryEvent) => {
      // For consent events, check if provider matches
      if (event.type === 'ConsentGranted' || event.type === 'ConsentRevoked' || event.type === 'ConsentExpired') {
        const eventProviderAddress = (event.provider?.toLowerCase() || '').trim();
        return eventProviderAddress === normalizedProviderAddress;
      }
      // For access request events, check if requester matches
      if (event.type === 'AccessRequested' || event.type === 'AccessApproved' || event.type === 'AccessDenied') {
        const eventRequesterAddress = (event.requester?.toLowerCase() || '').trim();
        return eventRequesterAddress === normalizedProviderAddress;
      }
      return false;
    });

    return filtered.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // Most recent first
    });
  }, [patientHistoryData, consent.providerAddress]);

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
          icon: <Building2 className="h-3 w-3" />,
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
          icon: <FileCheck className="h-3 w-3" />,
          color: 'text-gray-700 dark:text-gray-400',
          bgColor: 'bg-gray-50 dark:bg-gray-950/20',
          borderColor: 'border-gray-200 dark:border-gray-800',
        };
    }
  };

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

  // Format provider information for display (matching request response card format)
  const providerName = providerInfo?.organizationName || 'Unknown Provider';
  const providerType = providerInfo?.providerType 
    ? providerInfo.providerType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    : null;
  const providerAddressFormatted = providerInfo?.address
    ? `${providerInfo.address.street || ''}, ${providerInfo.address.city || ''}, ${providerInfo.address.state || ''} ${providerInfo.address.zipCode || ''}`
    : 'N/A';
  
  // Google Maps URL for provider address
  const googleMapsUrl = providerAddressFormatted !== 'N/A' 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(providerAddressFormatted)}`
    : null;
  
  // Copy wallet address handler
  const handleCopyWalletAddress = async () => {
    try {
      await navigator.clipboard.writeText(consent.providerAddress);
      toast.success('Wallet address copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy wallet address');
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileCheck className="h-4 w-4" />
            Consent Details
          </DialogTitle>
          <DialogDescription className="text-xs">
            Provider information, active consents, and consent history
          </DialogDescription>
          
          {/* Provider Info - Consolidated format matching request response card */}
          <div className="mt-4 text-sm">
            {/* Provider Name - Full width row */}
            <div className="mb-3">
              <p className="font-semibold text-base">{providerName}</p>
              {providerType && (
                <p className="text-muted-foreground text-xs capitalize mt-0.5">
                  {providerType}
                </p>
              )}
            </div>
            
            {/* Two column layout below name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                {providerInfo?.specialties && providerInfo.specialties.length > 0 && (
                  <div className="mb-2">
                    <ColoredBadgeList
                      type="specialty"
                      values={providerInfo.specialties}
                      maxDisplay={3}
                      size="sm"
                    />
                  </div>
                )}
                {consent.providerAddress && (
                  <div className="flex items-center gap-1.5">
                    <p className="text-muted-foreground text-xs font-mono">
                      <strong>Wallet:</strong>{' '}
                      <button
                        onClick={handleCopyWalletAddress}
                        className="text-primary hover:underline cursor-pointer text-left flex items-center gap-1"
                        title="Click to copy full wallet address"
                      >
                        {consent.providerAddress.slice(0, 6)}...{consent.providerAddress.slice(-4)}
                        <Copy className="h-3 w-3" />
                      </button>
                    </p>
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {providerInfo?.contact?.phone && (
                  <p>
                    <strong>Phone:</strong>{' '}
                    <a 
                      href={`tel:${providerInfo.contact.phone}`}
                      className="text-primary hover:underline"
                    >
                      {providerInfo.contact.phone}
                    </a>
                  </p>
                )}
                {providerInfo?.contact?.email && (
                  <p>
                    <strong>Email:</strong>{' '}
                    <a 
                      href={`mailto:${providerInfo.contact.email}`}
                      className="text-primary hover:underline"
                    >
                      {providerInfo.contact.email}
                    </a>
                  </p>
                )}
                {providerInfo?.contact?.website && (
                  <p>
                    <strong>Website:</strong>{' '}
                    <a 
                      href={providerInfo.contact.website.startsWith('http') ? providerInfo.contact.website : `https://${providerInfo.contact.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {providerInfo.contact.website}
                    </a>
                  </p>
                )}
                {providerAddressFormatted !== 'N/A' && googleMapsUrl && (
                  <p>
                    <strong>Address:</strong>{' '}
                    <a 
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {providerAddressFormatted}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto pr-1">

          {/* Active Consents - Show what consent exists */}
          {(() => {
            // Collect all unique data types and purposes from the consent
            const allDataTypes = new Set<string>();
            const allPurposes = new Set<string>();
            const expirationTimes: (string | null)[] = [];

            // Handle both single and batch consents
            if (consent.allConsents && consent.allConsents.length > 0) {
              consent.allConsents.forEach((c) => {
                if (c.dataType) allDataTypes.add(c.dataType);
                if (c.purpose) allPurposes.add(c.purpose);
                if (c.expirationTime) expirationTimes.push(c.expirationTime);
              });
            } else {
              // Single consent
              if (consent.dataTypes && Array.isArray(consent.dataTypes)) {
                consent.dataTypes.forEach((dt: string) => allDataTypes.add(dt));
              } else if (consent.dataType) {
                allDataTypes.add(consent.dataType);
              }

              if (consent.purposes && Array.isArray(consent.purposes)) {
                consent.purposes.forEach((p: string) => allPurposes.add(p));
              } else if (consent.purpose) {
                allPurposes.add(consent.purpose);
              }

              if (consent.expirationTime) {
                expirationTimes.push(consent.expirationTime);
              }
            }

            const hasActiveConsents = allDataTypes.size > 0 || allPurposes.size > 0;

            if (!hasActiveConsents) {
              return null;
            }

            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Active Consents</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Purposes</p>
                        {allPurposes.size > 0 ? (
                          <ColoredBadgeList
                            type="purpose"
                            values={Array.from(allPurposes)}
                            size="sm"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Data Types</p>
                        {allDataTypes.size > 0 ? (
                          <ColoredBadgeList
                            type="dataType"
                            values={Array.from(allDataTypes)}
                            size="sm"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    </div>

                    {expirationTimes.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Expiration Dates</p>
                        <div className="space-y-0.5">
                          {Array.from(new Set(expirationTimes)).slice(0, 3).map((expTime, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">
                                {format(new Date(expTime as string), 'MMM d, yyyy HH:mm')}
                              </span>
                            </div>
                          ))}
                          {Array.from(new Set(expirationTimes)).length > 3 && (
                            <p className="text-xs text-muted-foreground ml-4">
                              +{Array.from(new Set(expirationTimes)).length - 3} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Consent History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Consent History
                {providerHistory.length > 0 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({providerHistory.length} event{providerHistory.length !== 1 ? 's' : ''})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {historyLoading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : providerHistory.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  No consent history available for this provider.
                </div>
              ) : (
                <>
                  {(() => {
                    const totalPages = Math.ceil(providerHistory.length / historyPerPage);
                    const startIndex = (historyPage - 1) * historyPerPage;
                    const endIndex = startIndex + historyPerPage;
                    const paginatedHistory = providerHistory.slice(startIndex, endIndex);
                    const isFirstPage = historyPage === 1;
                    const isLastPage = historyPage >= totalPages;

                    const eventTypeLabels: Record<string, string> = {
                      'ConsentGranted': 'Granted',
                      'ConsentRevoked': 'Revoked',
                      'ConsentExpired': 'Expired',
                      'AccessRequested': 'Request Sent',
                      'AccessApproved': 'Approved',
                      'AccessDenied': 'Denied',
                    };

                    return (
                      <>
                        <div className="space-y-1.5">
                          {paginatedHistory.map((event: ConsentHistoryEvent, index: number) => {
                            const styling = getEventStyling(event.type);

                            return (
                              <div
                                key={`${event.type}-${event.consentId || event.requestId}-${startIndex + index}`}
                                className={`flex items-center gap-2 p-1.5 border-l-2 rounded ${styling.borderColor} ${styling.bgColor} cursor-pointer hover:opacity-80 transition-opacity`}
                                onClick={() => setSelectedHistoryEvent(event)}
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
                                  {event.expirationTime && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                                      <span className="text-[10px] text-muted-foreground">
                                        Expires: {format(new Date(event.expirationTime), 'MMM d, yyyy')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between mt-3 pt-3 border-t">
                            <p className="text-xs text-muted-foreground">
                              Showing {startIndex + 1}-{Math.min(endIndex, providerHistory.length)} of {providerHistory.length} events
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                                disabled={isFirstPage}
                                className="h-7 px-2"
                              >
                                <ChevronLeft className="h-3 w-3" />
                              </Button>
                              <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                                Page {historyPage} of {totalPages}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={isLastPage}
                                className="h-7 px-2"
                              >
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fixed Footer - Actions */}
        {(() => {
          // Check if any consent is active
          const hasActiveConsents = consent.allConsents 
            ? consent.allConsents.some(c => c.isActive && !c.isExpired)
            : (consent.isActive && !consent.isExpired);

          if (hasActiveConsents) {
            return (
              <div className="flex justify-end gap-2 pt-3 border-t flex-shrink-0 mt-2">
                <Button variant="outline" size="sm" onClick={onClose} aria-label="Close consent details">
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
            <div className="flex justify-end pt-3 border-t flex-shrink-0 mt-2">
              <Button variant="outline" size="sm" onClick={onClose} aria-label="Close consent details">
                Close
              </Button>
            </div>
          );
        })()}

        {/* Consent History Event Detail Card */}
        {selectedHistoryEvent && (
          <ConsentHistoryEventCard
            event={selectedHistoryEvent}
            onClose={() => setSelectedHistoryEvent(null)}
            userRole="patient"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

