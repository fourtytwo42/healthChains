'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWallet } from '@/contexts/wallet-context';
import { useRole } from '@/hooks/use-role';
import { usePatientPendingRequests, usePatientConsentsPaginated, useRevokeConsent, usePatientConsentHistory } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, FileCheck, Clock, X, Loader2, History } from 'lucide-react';
import { RequestResponseCard } from '@/components/patient/request-response-card';
import { ConsentDetailsCard } from '@/components/patient/consent-details-card';
import { Pagination } from '@/components/ui/pagination';
import { format } from 'date-fns';
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
  const [activeTab, setActiveTab] = useState<'pending' | 'granted' | 'history'>('pending');
  const [page, setPage] = useState(1);
  const limit = 10;

  const revokeConsent = useRevokeConsent();

  // Fetch pending requests
  const { data: requestsData, isLoading: requestsLoading } = usePatientPendingRequests(
    account || '',
    page,
    limit,
    activeTab === 'pending' && !!account
  );

  // Fetch granted consents
  const { data: consentsData, isLoading: consentsLoading } = usePatientConsentsPaginated(
    account || '',
    page,
    limit,
    false,
    activeTab === 'granted' && !!account
  );

  // Fetch consent history
  const { data: historyData, isLoading: historyLoading } = usePatientConsentHistory(
    account || '',
    activeTab === 'history' && !!account
  );

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
    
    // Use the clicked consent as the base, but include all provider consents
    setSelectedConsent({
      ...consent,
      allConsents: providerConsents // Include all consents for this provider
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Patient Dashboard</h1>
        <p className="text-muted-foreground">View and manage your consent requests and granted access</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as 'pending' | 'granted');
        setPage(1);
        setSelectedRequest(null);
      }}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="pending">Pending Requests</TabsTrigger>
            <TabsTrigger value="granted">Granted Consents</TabsTrigger>
            <TabsTrigger value="history">Consent History</TabsTrigger>
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
                        <TableHead>Actions</TableHead>
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
                            {request.dataType && (
                              <Badge variant="outline">{request.dataType}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{request.purpose || 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3" />
                              {format(new Date(request.timestamp), 'MMM d, yyyy HH:mm')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestClick(request.requestId);
                              }}
                            >
                              Review
                            </Button>
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
                        <TableHead>Granted Date</TableHead>
                        <TableHead>Expiration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
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
                          
                          // Get all unique data types
                          const dataTypes = Array.from(new Set(consents.map((c: any) => c.dataType)));
                          const hasActiveConsents = consents.some((c: any) => c.isActive && !c.isExpired);
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
                              <TableCell className="font-medium">
                                {providerName}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {dataTypes.slice(0, 2).map((dt: string, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs">{dt}</Badge>
                                  ))}
                                  {dataTypes.length > 2 && (
                                    <Badge variant="secondary" className="text-xs">+{dataTypes.length - 2}</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-sm">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(earliestDate), 'MMM d, yyyy')}
                                </div>
                              </TableCell>
                              <TableCell>
                                {latestExpiration ? (
                                  <div className="flex items-center gap-1 text-sm">
                                    <Clock className="h-3 w-3" />
                                    {format(latestExpiration, 'MMM d, yyyy')}
                                  </div>
                                ) : (
                                  <Badge variant="secondary">No expiration</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {hasActiveConsents ? (
                                  <Badge variant="default">Active</Badge>
                                ) : (
                                  <Badge variant="destructive">Expired</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConsentClick(firstConsent);
                                  }}
                                >
                                  View Details
                                </Button>
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
                <div className="space-y-4">
                  {historyData.map((event: any, index: number) => {
                    // Determine event type and icon
                    let eventType = '';
                    let eventIcon = null;
                    let eventColor = '';
                    let eventDescription = '';

                    if (event.type === 'ConsentGranted') {
                      eventType = 'Consent Granted';
                      eventIcon = <FileCheck className="h-4 w-4 text-green-500" />;
                      eventColor = 'text-green-600';
                      eventDescription = `Granted access to ${event.dataType} for ${event.purpose}`;
                    } else if (event.type === 'ConsentRevoked') {
                      eventType = 'Consent Revoked';
                      eventIcon = <X className="h-4 w-4 text-red-500" />;
                      eventColor = 'text-red-600';
                      eventDescription = `Revoked consent ID ${event.consentId}`;
                    } else if (event.type === 'ConsentExpired') {
                      eventType = 'Consent Expired';
                      eventIcon = <Clock className="h-4 w-4 text-orange-500" />;
                      eventColor = 'text-orange-600';
                      eventDescription = `Consent expired for ${event.dataType} (${event.purpose})`;
                    } else if (event.type === 'AccessRequested') {
                      eventType = 'Request Received';
                      eventIcon = <MessageSquare className="h-4 w-4 text-blue-500" />;
                      eventColor = 'text-blue-600';
                      eventDescription = `Request for ${event.dataType} for ${event.purpose}`;
                    } else if (event.type === 'AccessApproved') {
                      eventType = 'Request Approved';
                      eventIcon = <FileCheck className="h-4 w-4 text-green-500" />;
                      eventColor = 'text-green-600';
                      eventDescription = `Approved request ID ${event.requestId}`;
                    } else if (event.type === 'AccessDenied') {
                      eventType = 'Request Denied';
                      eventIcon = <X className="h-4 w-4 text-red-500" />;
                      eventColor = 'text-red-600';
                      eventDescription = `Denied request ID ${event.requestId}`;
                    }

                    // Check if consent expired (for granted consents)
                    const isExpired = event.isExpired || (event.type === 'ConsentGranted' && event.expirationTime && 
                      new Date(event.expirationTime) < new Date());

                    return (
                      <div
                        key={`${event.type}-${event.consentId || event.requestId}-${index}`}
                        className="flex gap-4 pb-4 border-b last:border-0"
                      >
                        <div className="flex-shrink-0 mt-1">
                          {eventIcon}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${eventColor}`}>{eventType}</span>
                              {isExpired && (
                                <Badge variant="destructive" className="text-xs">Expired</Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(event.timestamp), 'MMM d, yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{eventDescription}</p>
                          {event.providerInfo?.organizationName ? (
                            <p className="text-xs text-muted-foreground">
                              Provider: {event.providerInfo.organizationName}
                            </p>
                          ) : event.provider && (
                            <p className="text-xs text-muted-foreground">
                              Provider: {event.provider.slice(0, 6)}...{event.provider.slice(-4)}
                            </p>
                          )}
                          {event.expirationTime && event.type === 'ConsentGranted' && (
                            <p className="text-xs text-muted-foreground">
                              Expires: {format(new Date(event.expirationTime), 'MMM d, yyyy HH:mm')}
                            </p>
                          )}
                          <p className="text-xs font-mono text-muted-foreground">
                            TX: {event.transactionHash?.slice(0, 10)}...
                          </p>
                        </div>
                      </div>
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
    </div>
  );
}
