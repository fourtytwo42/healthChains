'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWallet } from '@/contexts/wallet-context';
import { useAuth } from '@/contexts/auth-context';
import { useRole } from '@/hooks/use-role';
import { usePatientPendingRequests, usePatientConsentsPaginated, useRevokeConsent, usePatientConsentHistory, usePatientInfo } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, FileCheck, Clock, X, Loader2, History } from 'lucide-react';
import { ColoredBadge, ColoredBadgeList } from '@/components/shared/colored-badge';
import { RequestResponseCard } from '@/components/patient/request-response-card';
import { ConsentDetailsCard } from '@/components/patient/consent-details-card';
import { ConsentHistoryEventCard } from '@/components/shared/consent-history-event-card';
import { Pagination } from '@/components/ui/pagination';
import { format } from 'date-fns';
import type { ConsentHistoryEvent } from '@/types/consent';
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

/**
 * Patient Dashboard Page
 * Tab-based interface matching provider dashboard style
 */
export default function PatientDashboardPage() {
  const router = useRouter();
  const { account } = useWallet();
  const { role, isLoading: roleLoading } = useRole(account);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [selectedConsent, setSelectedConsent] = useState<{
    consentId: number;
    patientAddress: string;
    providerAddress: string;
    timestamp: string;
    expirationTime: string | null;
    isActive: boolean;
    dataType: string;
    purpose: string;
    isExpired: boolean;
  } | null>(null);
  const [selectedHistoryEvent, setSelectedHistoryEvent] = useState<ConsentHistoryEvent | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'granted' | 'history'>('pending');
  const [page, setPage] = useState(1);
  const limit = 10;

  const { isAuthenticated } = useAuth();
  const revokeConsent = useRevokeConsent();

  // Fetch pending requests (only when authenticated)
  const { data: requestsData, isLoading: requestsLoading } = usePatientPendingRequests(
    account || '',
    page,
    limit,
    activeTab === 'pending' && !!account && isAuthenticated
  );

  // Fetch granted consents (only when authenticated)
  const { data: consentsData, isLoading: consentsLoading } = usePatientConsentsPaginated(
    account || '',
    page,
    limit,
    false,
    activeTab === 'granted' && !!account && isAuthenticated
  );

  // Fetch consent history (only when authenticated)
  const { data: historyData, isLoading: historyLoading } = usePatientConsentHistory(
    account || '',
    activeTab === 'history' && !!account && isAuthenticated
  );

  // Fetch current patient's own information
  const { data: currentPatient } = usePatientInfo(account || '', {
    enabled: !!account,
  });
  const patientName = currentPatient?.demographics
    ? `${currentPatient.demographics.firstName} ${currentPatient.demographics.lastName}`.trim()
    : 'Patient Dashboard';

  const handleRequestClick = (requestId: number) => {
    setSelectedRequest(requestId);
  };

  const handleCloseRequestCard = () => {
    setSelectedRequest(null);
  };

  const handleConsentClick = (consent: any) => {
    // Get all consents for the same provider to show all data types and purposes
    const providerConsents = consentsData?.data?.filter(
      (c: any) => c.providerAddress.toLowerCase() === consent.providerAddress.toLowerCase()
    ) || [];
    
    // Expand batch consents into individual entries for the breakdown
    const expandedConsents: Array<{
      consentId: number;
      dataType: string;
      purpose: string;
      expirationTime: string | null;
      isActive: boolean;
      isExpired: boolean;
      timestamp: string;
    }> = [];
    
    providerConsents.forEach((c: any) => {
      // Handle batch consents (dataTypes and purposes arrays)
      if (c.dataTypes && c.dataTypes.length > 0 && c.purposes && c.purposes.length > 0) {
        // Create a combination for each dataType and purpose pair
        c.dataTypes.forEach((dataType: string) => {
          c.purposes.forEach((purpose: string) => {
            expandedConsents.push({
              consentId: c.consentId,
              dataType,
              purpose,
              expirationTime: c.expirationTime,
              isActive: c.isActive,
              isExpired: c.isExpired,
              timestamp: c.timestamp,
            });
          });
        });
      } 
      // Handle single consents (dataType and purpose strings)
      else if (c.dataType && c.purpose) {
        expandedConsents.push({
          consentId: c.consentId,
          dataType: c.dataType,
          purpose: c.purpose,
          expirationTime: c.expirationTime,
          isActive: c.isActive,
          isExpired: c.isExpired,
          timestamp: c.timestamp,
        });
      }
      // Fallback: if we have arrays but need to show something
      else if (c.dataTypes && c.dataTypes.length > 0) {
        c.dataTypes.forEach((dataType: string) => {
          expandedConsents.push({
            consentId: c.consentId,
            dataType,
            purpose: c.purpose || (c.purposes && c.purposes.length > 0 ? c.purposes[0] : 'Unknown'),
            expirationTime: c.expirationTime,
            isActive: c.isActive,
            isExpired: c.isExpired,
            timestamp: c.timestamp,
          });
        });
      }
    });
    
    // Use the clicked consent as the base, but include expanded consents for breakdown
    setSelectedConsent({
      ...consent,
      allConsents: expandedConsents.length > 0 ? expandedConsents : undefined
    });
  };

  const handleCloseConsentCard = () => {
    setSelectedConsent(null);
  };

  const handleRevoke = (consentId: number) => {
    if (!account) return;
    revokeConsent.mutate({ consentId });
  };

  // Redirect if role changes and user is not a patient
  useEffect(() => {
    if (roleLoading || !account) return;
    
    // If role is provider or both, redirect to provider page
    if (role?.role === 'provider' || role?.role === 'both') {
      router.replace('/provider');
    }
    // If role is unknown, redirect to root dashboard
    else if (role?.role === 'unknown') {
      router.replace('/');
    }
  }, [account, role, roleLoading, router]);

  if (!account) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patient Dashboard</h1>
          <p className="text-muted-foreground">Connect your wallet to view requests and manage consents</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Please connect your wallet to continue</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {requestsLoading && 'Loading pending requests...'}
        {consentsLoading && 'Loading consents...'}
      </div>
      
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{patientName}</h1>
        <p className="text-muted-foreground">View and manage your consent requests and granted access</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as 'pending' | 'granted');
        setPage(1);
        setSelectedRequest(null);
      }}>
        <div className="flex items-center justify-between">
          <TabsList aria-label="Dashboard sections">
            <TabsTrigger value="pending" aria-label="View pending requests">Pending Requests</TabsTrigger>
            <TabsTrigger value="granted" aria-label="View granted consents">Granted Consents</TabsTrigger>
            <TabsTrigger value="history" aria-label="View consent history">Consent History</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Pending Requests
              </CardTitle>
              <CardDescription>
                Access requests from providers awaiting your approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : requestsData?.data && requestsData.data.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Data Types</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Request Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requestsData.data.map((request) => (
                        <TableRow
                          key={request.requestId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleRequestClick(request.requestId)}
                        >
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {request.provider?.organizationName || 'Unknown Provider'}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {request.requester.slice(0, 6)}...{request.requester.slice(-4)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {request.dataTypes && request.dataTypes.length > 0 ? (
                              <ColoredBadgeList type="dataType" values={request.dataTypes} size="sm" maxDisplay={2} />
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {request.purposes && request.purposes.length > 0 ? (
                              <ColoredBadgeList type="purpose" values={request.purposes} size="sm" maxDisplay={2} />
                            ) : (
                              <span className="text-sm text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3" />
                              {format(new Date(request.timestamp), 'MMM d, yyyy HH:mm')}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {requestsData.pagination && requestsData.pagination.totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination
                        page={requestsData.pagination.page}
                        totalPages={requestsData.pagination.totalPages}
                        onPageChange={setPage}
                        totalItems={requestsData.pagination.total}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending requests</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="granted" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Granted Consents
              </CardTitle>
              <CardDescription>
                Active consents you have granted to providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {consentsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : consentsData?.data && consentsData.data.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Data Types</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Granted Date</TableHead>
                        <TableHead>Expiration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        // Group consents by provider
                        const groupedByProvider = new Map<string, any[]>();
                        consentsData.data.forEach((consent: any) => {
                          const key = consent.providerAddress.toLowerCase();
                          if (!groupedByProvider.has(key)) {
                            groupedByProvider.set(key, []);
                          }
                          groupedByProvider.get(key)!.push(consent);
                        });

                        return Array.from(groupedByProvider.entries()).map(([providerAddress, consents]) => {
                          const firstConsent = consents[0];
                          const providerName = firstConsent.provider?.organizationName || 
                            `${providerAddress.slice(0, 6)}...${providerAddress.slice(-4)}`;
                          
                          // Get all unique data types and purposes
                          const dataTypes = Array.from(new Set(
                            consents.flatMap((c: any) => 
                              c.dataTypes && c.dataTypes.length > 0 ? c.dataTypes : 
                              (c.dataType ? [c.dataType] : [])
                            )
                          ));
                          const purposes = Array.from(new Set(
                            consents.flatMap((c: any) => 
                              c.purposes && c.purposes.length > 0 ? c.purposes : 
                              (c.purpose ? [c.purpose] : [])
                            )
                          ));
                          const earliestDate = consents.reduce((earliest: string, c: any) => 
                            new Date(c.timestamp) < new Date(earliest) ? c.timestamp : earliest, 
                            consents[0].timestamp
                          );
                          const latestExpiration = consents
                            .filter((c: any) => c.expirationTime)
                            .map((c: any) => new Date(c.expirationTime))
                            .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0];

                          return (
                            <TableRow
                              key={providerAddress}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleConsentClick(firstConsent)}
                            >
                              <TableCell>
                                <div>
                                  <div className="font-medium">
                                    {providerName}
                                  </div>
                                  <div className="text-xs text-muted-foreground font-mono">
                                    {providerAddress.slice(0, 6)}...{providerAddress.slice(-4)}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {dataTypes.length > 0 ? (
                                  <ColoredBadgeList type="dataType" values={dataTypes} size="sm" maxDisplay={2} />
                                ) : (
                                  <span className="text-muted-foreground">N/A</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {purposes.length > 0 ? (
                                  <ColoredBadgeList type="purpose" values={purposes} size="sm" maxDisplay={2} />
                                ) : (
                                  <span className="text-sm text-muted-foreground">N/A</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(earliestDate), 'MMM d, yyyy HH:mm')}
                                </div>
                              </TableCell>
                              <TableCell>
                                {latestExpiration ? (
                                  <div className="flex items-center gap-1 text-sm">
                                    <Clock className="h-3 w-3" />
                                    {format(latestExpiration, 'MMM d, yyyy HH:mm')}
                                  </div>
                                ) : (
                                  <Badge variant="secondary">No expiration</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                  {consentsData.pagination && consentsData.pagination.totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination
                        page={consentsData.pagination.page}
                        totalPages={consentsData.pagination.totalPages}
                        onPageChange={setPage}
                        totalItems={consentsData.pagination.total}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No granted consents</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Consent History
              </CardTitle>
              <CardDescription>
                Complete timeline of all consent-related actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : historyData && historyData.length > 0 ? (
                <div className="space-y-2">
                  {historyData.map((event: any, index: number) => {
                    // Determine event type and styling
                    let eventType = '';
                    let eventIcon = null;
                    let eventColor = '';
                    let eventBgColor = '';
                    let eventBorderColor = '';
                    let statusBadge = null;

                    if (event.type === 'ConsentGranted') {
                      eventType = 'Consent Granted';
                      eventIcon = <FileCheck className="h-5 w-5" />;
                      eventColor = 'text-green-700 dark:text-green-400';
                      eventBgColor = 'bg-green-50 dark:bg-green-950/20';
                      eventBorderColor = 'border-green-200 dark:border-green-800';
                      // Show "Granted" for the event, not "Active" - history shows event status, not current consent status
                      statusBadge = <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">Granted</Badge>;
                    } else if (event.type === 'ConsentRevoked') {
                      eventType = 'Consent Revoked';
                      eventIcon = <X className="h-5 w-5" />;
                      eventColor = 'text-red-700 dark:text-red-400';
                      eventBgColor = 'bg-red-50 dark:bg-red-950/20';
                      eventBorderColor = 'border-red-200 dark:border-red-800';
                      statusBadge = <Badge variant="destructive">Revoked</Badge>;
                    } else if (event.type === 'ConsentExpired') {
                      eventType = 'Consent Expired';
                      eventIcon = <Clock className="h-5 w-5" />;
                      eventColor = 'text-orange-700 dark:text-orange-400';
                      eventBgColor = 'bg-orange-50 dark:bg-orange-950/20';
                      eventBorderColor = 'border-orange-200 dark:border-orange-800';
                      statusBadge = <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">Expired</Badge>;
                    } else if (event.type === 'AccessRequested') {
                      eventType = 'Request Received';
                      eventIcon = <MessageSquare className="h-5 w-5" />;
                      eventColor = 'text-blue-700 dark:text-blue-400';
                      eventBgColor = 'bg-blue-50 dark:bg-blue-950/20';
                      eventBorderColor = 'border-blue-200 dark:border-blue-800';
                      statusBadge = <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">Pending</Badge>;
                    } else if (event.type === 'AccessApproved') {
                      eventType = 'Request Approved';
                      eventIcon = <FileCheck className="h-5 w-5" />;
                      eventColor = 'text-green-700 dark:text-green-400';
                      eventBgColor = 'bg-green-50 dark:bg-green-950/20';
                      eventBorderColor = 'border-green-200 dark:border-green-800';
                      statusBadge = <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">Approved</Badge>;
                    } else if (event.type === 'AccessDenied') {
                      eventType = 'Request Denied';
                      eventIcon = <X className="h-5 w-5" />;
                      eventColor = 'text-red-700 dark:text-red-400';
                      eventBgColor = 'bg-red-50 dark:bg-red-950/20';
                      eventBorderColor = 'border-red-200 dark:border-red-800';
                      statusBadge = <Badge variant="destructive">Denied</Badge>;
                    }

                    const isExpired = event.isExpired || (event.type === 'ConsentGranted' && event.expirationTime && 
                      new Date(event.expirationTime) < new Date());

                    return (
                      <Card
                        key={`${event.type}-${event.consentId || event.requestId}-${index}`}
                        className={`cursor-pointer transition-all hover:shadow-sm hover:border-opacity-80 border-l-4 py-0 ${eventBorderColor} ${eventBgColor}`}
                        onClick={() => setSelectedHistoryEvent(event)}
                      >
                        <CardContent className="py-1 px-2">
                          <div className="flex items-center gap-2">
                            {/* Icon */}
                            {eventIcon && (
                              <div className={`flex-shrink-0 p-1.5 rounded ${eventBgColor} ${eventColor} flex items-center justify-center`}>
                                {React.cloneElement(eventIcon, { className: 'h-5 w-5' })}
                              </div>
                            )}
                            
                            {/* Main Content */}
                            <div className="flex-1 min-w-0">
                              {/* Header */}
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <h3 className={`font-semibold text-[11px] leading-none ${eventColor}`}>
                                    {eventType}
                                  </h3>
                                  {statusBadge}
                                  {isExpired && event.type === 'ConsentGranted' && (
                                    <Badge variant="destructive" className="text-[9px] h-3 px-1">Expired</Badge>
                                  )}
                                </div>
                                <p className="text-[9px] text-muted-foreground whitespace-nowrap leading-none">
                                  {format(new Date(event.timestamp), 'MMM d, yyyy • h:mm a')}
                                </p>
                              </div>

                              {/* Details Grid - Compact */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-1.5 gap-y-0 text-xs">
                                {/* Column 1: Provider Info - Always render */}
                                <div>
                                  {event.providerInfo?.organizationName ? (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Provider</p>
                                      <p className="text-[11px] font-semibold truncate leading-tight">{event.providerInfo.organizationName}</p>
                                    </>
                                  ) : event.provider ? (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Provider</p>
                                      <p className="text-[11px] font-mono truncate leading-tight">{event.provider.slice(0, 8)}...{event.provider.slice(-6)}</p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Provider</p>
                                      <p className="text-[11px] text-muted-foreground leading-tight">—</p>
                                    </>
                                  )}
                                </div>

                                {/* Column 2: Access - Always render */}
                                <div>
                                  {((event.dataTypes && event.dataTypes.length > 0) || (event.dataType || event.purpose)) ? (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Access</p>
                                      <div className="flex flex-wrap gap-0.5 -mt-0.5">
                                        {event.dataTypes && event.dataTypes.length > 0 ? (
                                          <>
                                            {event.dataTypes.slice(0, 2).map((dt: string, idx: number) => (
                                              <ColoredBadge key={idx} type="dataType" value={dt} size="sm" />
                                            ))}
                                            {event.dataTypes.length > 2 && (
                                              <Badge variant="outline" className="text-[9px] h-3 px-1">+{event.dataTypes.length - 2}</Badge>
                                            )}
                                          </>
                                        ) : event.dataType ? (
                                          <ColoredBadge type="dataType" value={event.dataType} size="sm" />
                                        ) : null}
                                        {event.purposes && event.purposes.length > 0 ? (
                                          <>
                                            {event.purposes.slice(0, 2).map((p: string, idx: number) => (
                                              <ColoredBadge key={idx} type="purpose" value={p} size="sm" />
                                            ))}
                                            {event.purposes.length > 2 && (
                                              <Badge variant="outline" className="text-[9px] h-3 px-1">+{event.purposes.length - 2}</Badge>
                                            )}
                                          </>
                                        ) : event.purpose ? (
                                          <ColoredBadge type="purpose" value={event.purpose} size="sm" />
                                        ) : null}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Access</p>
                                      <p className="text-[11px] text-muted-foreground leading-tight">—</p>
                                    </>
                                  )}
                                </div>

                                {/* Column 3: Expires - Always render */}
                                <div>
                                  {event.expirationTime && (event.type === 'ConsentGranted' || event.type === 'AccessRequested') ? (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Expires</p>
                                      <div className="flex items-center gap-0.5">
                                        <Clock className="h-2 w-2 text-muted-foreground flex-shrink-0" />
                                        <p className="text-[11px] truncate leading-tight">
                                          {format(new Date(event.expirationTime), 'MMM d, yyyy')}
                                        </p>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Expires</p>
                                      <p className="text-[11px] text-muted-foreground leading-tight">—</p>
                                    </>
                                  )}
                                </div>

                                {/* Column 4: IDs - Always render */}
                                <div>
                                  {event.consentId !== undefined || event.requestId !== undefined ? (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">
                                        {event.consentId !== undefined ? 'Consent ID' : 'Request ID'}
                                      </p>
                                      <p className="text-[11px] font-mono font-semibold leading-tight">
                                        #{event.consentId ?? event.requestId}
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">ID</p>
                                      <p className="text-[11px] text-muted-foreground leading-tight">—</p>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No consent history</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Request Response Card */}
      {selectedRequest !== null && (
        <RequestResponseCard
          requestId={selectedRequest}
          onClose={handleCloseRequestCard}
        />
      )}

      {/* Consent Details Card */}
      {selectedConsent !== null && (
        <ConsentDetailsCard
          consent={selectedConsent}
          onClose={handleCloseConsentCard}
        />
      )}

      {/* History Event Details Card */}
      {selectedHistoryEvent !== null && (
        <ConsentHistoryEventCard
          event={selectedHistoryEvent}
          onClose={() => setSelectedHistoryEvent(null)}
          userRole="patient"
        />
      )}
    </div>
  );
}
