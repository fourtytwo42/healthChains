'use client';

import React, { useMemo, useState, useEffect } from 'react';
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
import { Calendar, History, Clock, CheckCircle, X, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProviderPatientData, useProviderConsentHistory } from '@/hooks/use-api';
import type { ConsentHistoryEvent } from '@/types/consent';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { RequestConsentDialog } from '@/components/provider/request-consent-dialog';
import { ConsentHistoryEventCard } from '@/components/shared/consent-history-event-card';

interface GrantedConsentDetailsCardProps {
  patientId: string;
  patientWalletAddress?: string;
  providerAddress: string;
  onClose: () => void;
  onOpenMedicalChart?: (patientId: string) => void;
}

/**
 * Granted Consent Details Card Component
 * Shows demographics, active consents breakdown, and consent history for provider/patient combination (no medical data)
 */
export function GrantedConsentDetailsCard({
  patientId,
  patientWalletAddress,
  providerAddress,
  onClose,
  onOpenMedicalChart,
}: GrantedConsentDetailsCardProps) {
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedHistoryEvent, setSelectedHistoryEvent] = useState<ConsentHistoryEvent | null>(null);
  const historyPerPage = 10; // Increased since this is now the main content
  
  // Fetch patient data filtered by consent
  const { data, isLoading, error } = useProviderPatientData(providerAddress, patientId);

  // Get patient wallet address from patient data if not provided as prop
  // We need to get it from the data after it's loaded, so we'll use a ref or state
  const [actualPatientWalletAddress, setActualPatientWalletAddress] = useState<string>(patientWalletAddress || '');
  
  // Update wallet address when data loads or prop changes
  useEffect(() => {
    // First try the prop
    if (patientWalletAddress) {
      setActualPatientWalletAddress(patientWalletAddress);
      return;
    }
    
    // Then try to get it from the fetched patient data
    if (data?.data) {
      const walletAddr = (data.data as any)?.blockchainIntegration?.walletAddress ||
        (data.data as any)?.patientWalletAddress ||
        '';
      if (walletAddr) {
        setActualPatientWalletAddress(walletAddr);
      }
    } else if (!patientWalletAddress) {
      // Reset if no data and no prop
      setActualPatientWalletAddress('');
    }
  }, [data?.data, patientWalletAddress]);
  
  // Fetch provider history - always fetch if we have provider address
  // We'll filter by patient address client-side
  const shouldFetchHistory = !!providerAddress;
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
    if (!providerHistory || !Array.isArray(providerHistory)) {
      return [];
    }
    
    // If we don't have patient wallet address yet, return empty (will update when address is available)
    if (!actualPatientWalletAddress) {
      return [];
    }
    
    const normalizedPatientAddress = actualPatientWalletAddress.toLowerCase().trim();
    if (!normalizedPatientAddress) {
      return [];
    }
    
    const filtered = providerHistory.filter((event) => {
      // Check patient address field - events have patient address in event.patient
      // Some events might have it in different fields, so check multiple possibilities
      const eventPatientAddress = (
        event.patient?.toLowerCase() || 
        (event as any).patientAddress?.toLowerCase() ||
        ''
      ).trim();
      if (!eventPatientAddress) return false;
      
      const matches = eventPatientAddress === normalizedPatientAddress;
      return matches;
    });
    
    return filtered.sort((a, b) => {
      // Sort by timestamp, most recent first
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
  }, [providerHistory, actualPatientWalletAddress]);

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Loading Patient Details...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="flex justify-end pt-3 border-t flex-shrink-0 mt-2">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !data?.data) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Error Loading Patient Data</DialogTitle>
            <DialogDescription>
              {error?.message || 'Failed to load patient data'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-3 border-t flex-shrink-0 mt-2">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const patientData = data.data;
  const consentInfo = (patientData as any)?.consentInfo || [];
  const hasActiveConsents = consentInfo.length > 0;

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

  const demographics = (patientData as any)?.demographics || {};
  const patientName = `${demographics.firstName || ''} ${demographics.lastName || ''}`.trim() || 'N/A';
  const patientAddress = demographics.address 
    ? `${demographics.address.street || ''}, ${demographics.address.city || ''}, ${demographics.address.state || ''} ${demographics.address.zipCode || ''}`
    : 'N/A';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b pb-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-lg">
                Consent Details - {patientData.patientId}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Patient demographics, active consents, and consent history
              </DialogDescription>
              
              {/* Patient Info - Not in scrollable area, matching medical chart */}
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-base mb-1">
                    {onOpenMedicalChart ? (
                      <button
                        onClick={() => {
                          onOpenMedicalChart(patientId);
                          onClose();
                        }}
                        className="text-primary hover:underline cursor-pointer text-left"
                      >
                        {patientName}
                      </button>
                    ) : (
                      patientName
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {demographics.dateOfBirth ? `DOB: ${format(new Date(demographics.dateOfBirth), 'MMM d, yyyy')}` : ''}
                    {demographics.age ? ` • Age: ${demographics.age}` : ''}
                    {demographics.gender ? ` • ${demographics.gender}` : ''}
                  </p>
                  {patientData.patientId && (
                    <p className="text-muted-foreground text-xs font-mono mt-1">
                      <strong>Patient ID:</strong> {patientData.patientId}
                    </p>
                  )}
                  {actualPatientWalletAddress && (
                    <p className="text-muted-foreground text-xs font-mono mt-1">
                      <strong>Wallet:</strong> {actualPatientWalletAddress.slice(0, 6)}...{actualPatientWalletAddress.slice(-4)}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {demographics.contact?.phone && (
                    <p><strong>Phone:</strong> {demographics.contact.phone}</p>
                  )}
                  {demographics.contact?.email && (
                    <p><strong>Email:</strong> {demographics.contact.email}</p>
                  )}
                  {patientAddress !== 'N/A' && (
                    <p><strong>Address:</strong> {patientAddress}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 pr-1">
          <div className="space-y-3">

          {/* Active Consents Breakdown - Show what consent exists */}
          {hasActiveConsents && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Active Consents</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* Collect all unique data types and purposes from all consents */}
                  {(() => {
                    const allDataTypes = new Set<string>();
                    const allPurposes = new Set<string>();
                    const expirationTimes: (string | null)[] = [];
                    
                    consentInfo.forEach((consent: any) => {
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
                    });

                    return (
                      <>
                        <div className="grid grid-cols-2 gap-3">
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
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show message if no consent */}
          {!hasActiveConsents && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">No Active Consents</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  You don't have active consent to view this patient's data.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Consent History */}
          {(() => {
            const totalPages = Math.ceil(patientHistory.length / historyPerPage);
            const startIndex = (historyPage - 1) * historyPerPage;
            const endIndex = startIndex + historyPerPage;
            const paginatedHistory = patientHistory.slice(startIndex, endIndex);
            const isFirstPage = historyPage === 1;
            const isLastPage = historyPage >= totalPages;
            
            // Debug info (can be removed later)
            const debugInfo = actualPatientWalletAddress 
              ? `Looking for: ${actualPatientWalletAddress.slice(0, 10)}... | Provider history: ${providerHistory.length} events | Filtered: ${patientHistory.length} events`
              : `No wallet address yet | Provider history: ${providerHistory.length} events`;
            
            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Consent History
                    {patientHistory.length > 0 && (
                      <span className="text-xs text-muted-foreground font-normal">
                        ({patientHistory.length} event{patientHistory.length !== 1 ? 's' : ''})
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {patientHistory.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-4">
                      <div className="text-center mb-2">
                        No consent history available for this patient/provider combination.
                      </div>
                      {process.env.NODE_ENV === 'development' && (
                        <div className="text-[10px] text-muted-foreground/70 mt-2 p-2 bg-muted/30 rounded">
                          Debug: {debugInfo}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {paginatedHistory.map((event: ConsentHistoryEvent, index: number) => {
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
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                  
                  {/* Pagination Controls */}
                  {patientHistory.length > 0 && totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Showing {startIndex + 1}-{Math.min(endIndex, patientHistory.length)} of {patientHistory.length} events
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
                </CardContent>
              </Card>
            );
          })()}
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0 mt-2">
          {actualPatientWalletAddress && (
            <RequestConsentDialog
              patientAddress={actualPatientWalletAddress}
              patientId={patientId}
              patientName={patientName}
            />
          )}
          <Button size="sm" variant="outline" onClick={onClose} aria-label="Close consent details">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

