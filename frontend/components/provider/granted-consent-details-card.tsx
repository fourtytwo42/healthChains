'use client';

import React, { useMemo, useState } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { RequestConsentDialog } from '@/components/provider/request-consent-dialog';

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
  const [historyPage, setHistoryPage] = useState(1);
  const [consentsPage, setConsentsPage] = useState(1);
  const historyPerPage = 5;
  const consentsPerPage = 5;
  
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
                  {patientWalletAddress && (
                    <p className="text-muted-foreground text-xs font-mono mt-1">
                      <strong>Wallet:</strong> {patientWalletAddress.slice(0, 6)}...{patientWalletAddress.slice(-4)}
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
          {!hasNoConsent && (() => {
            if (consentInfo.length === 0) {
              return (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Active Consents</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">No active consents</p>
                  </CardContent>
                </Card>
              );
            }
            
            const totalPages = Math.ceil(consentInfo.length / consentsPerPage);
            const startIndex = (consentsPage - 1) * consentsPerPage;
            const endIndex = startIndex + consentsPerPage;
            const paginatedConsents = consentInfo.slice(startIndex, endIndex);
            const isFirstPage = consentsPage === 1;
            const isLastPage = consentsPage >= totalPages;
            
            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Active Consents</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {paginatedConsents.map((consent: any, idx: number) => (
                      <div key={startIndex + idx} className="flex items-center justify-between p-2 border rounded-lg">
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
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Showing {startIndex + 1}-{Math.min(endIndex, consentInfo.length)} of {consentInfo.length} consents
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConsentsPage(prev => Math.max(1, prev - 1))}
                          disabled={isFirstPage}
                          className="h-7 px-2"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <span className="text-xs text-muted-foreground min-w-[60px] text-center">
                          Page {consentsPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConsentsPage(prev => Math.min(totalPages, prev + 1))}
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

          {/* Consent History */}
          {patientHistory.length > 0 && (() => {
            const totalPages = Math.ceil(patientHistory.length / historyPerPage);
            const startIndex = (historyPage - 1) * historyPerPage;
            const endIndex = startIndex + historyPerPage;
            const paginatedHistory = patientHistory.slice(startIndex, endIndex);
            const isFirstPage = historyPage === 1;
            const isLastPage = historyPage >= totalPages;
            
            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Consent History
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1.5">
                    {paginatedHistory.map((event: any, index: number) => {
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
                  
                  {/* Pagination Controls */}
                  {totalPages > 1 && (
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
          {patientWalletAddress && (
            <RequestConsentDialog
              patientAddress={patientWalletAddress}
              patientId={patientId}
              patientName={patientName}
            />
          )}
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

