'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePatients } from '@/hooks/use-api';
import { useWallet } from '@/contexts/wallet-context';
import { useRole } from '@/hooks/use-role';
import { useProviderPatients, useProviderConsentsPaginated, useProviderConsentHistory, useProviderPendingRequests } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, Users, FileCheck, History, X, Clock, MessageSquare } from 'lucide-react';
import { ColoredBadge, ColoredBadgeList } from '@/components/shared/colored-badge';
import { format } from 'date-fns';
import { RequestConsentDialog } from '@/components/provider/request-consent-dialog';
import { PatientDetailsCard } from '@/components/provider/patient-details-card';
import { ConsentHistoryEventCard } from '@/components/shared/consent-history-event-card';
import { RequestDetailsCard } from '@/components/provider/request-details-card';
import { Pagination } from '@/components/ui/pagination';

/**
 * Provider Dashboard Page
 * Microsoft Lists-style table with search, tabs, and pagination
 */
export default function ProviderDashboardPage() {
  const router = useRouter();
  const { account } = useWallet();
  const { role, isLoading: roleLoading } = useRole(account);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [selectedHistoryEvent, setSelectedHistoryEvent] = useState<any | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'granted' | 'history'>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Fetch all patients for "All Users" tab
  const { data: allPatientsData, isLoading: allPatientsLoading } = usePatients();
  
  // Fetch pending requests for "Pending" tab
  const { data: pendingRequestsData, isLoading: pendingRequestsLoading } = useProviderPendingRequests(
    account || '',
    page,
    limit,
    activeTab === 'pending' && !!account
  );
  
  // Fetch patients with granted consents for "Granted Consent" tab
  const { data: grantedPatientsData, isLoading: grantedPatientsLoading } = useProviderPatients(
    account || '',
    page,
    limit,
    activeTab === 'granted' && !!account
  );

  // Fetch consent history for "History" tab
  const { data: historyData, isLoading: historyLoading } = useProviderConsentHistory(
    account || '',
    activeTab === 'history' && !!account
  );

  // Filter patients by search query - memoize to prevent infinite loops
  const filteredPatients = useMemo(() => {
    console.log('[ProviderDashboard] filteredPatients useMemo executing', {
      hasAllPatientsData: !!allPatientsData,
      isArray: Array.isArray(allPatientsData),
      length: allPatientsData?.length,
      searchQuery,
    });
    if (!allPatientsData || !Array.isArray(allPatientsData)) return [];
    if (!searchQuery) return allPatientsData;
    const query = searchQuery.toLowerCase();
    return allPatientsData.filter(patient => {
      const name = `${patient.demographics.firstName} ${patient.demographics.lastName}`.toLowerCase();
      return name.includes(query) || patient.patientId.toLowerCase().includes(query);
    });
  }, [allPatientsData, searchQuery]);

  const paginatedPatients = useMemo(() => {
    console.log('[ProviderDashboard] paginatedPatients useMemo executing', {
      filteredLength: filteredPatients.length,
      page,
      limit,
    });
    return filteredPatients.slice((page - 1) * limit, page * limit);
  }, [filteredPatients, page, limit]);
  
  const totalPages = Math.ceil(filteredPatients.length / limit);

  const handlePatientClick = (patientId: string) => {
    setSelectedPatient(patientId);
  };

  const handleCloseDetails = () => {
    setSelectedPatient(null);
  };

  const handleCloseRequestCard = () => {
    setSelectedRequest(null);
  };

  // Track if we've already redirected to prevent infinite loops
  const hasRedirected = useRef(false);
  const lastRoleType = useRef<string | undefined>(undefined);
  const lastAccount = useRef<string | null>(null);
  
  // Memoize roleType to prevent unnecessary re-renders
  const roleType = useMemo(() => role?.role, [role?.role]);

  // Redirect if role changes and user is not a provider
  useEffect(() => {
    if (roleLoading || !account || hasRedirected.current) {
      return;
    }
    
    // Only redirect if role actually changed
    if (roleType === lastRoleType.current && account === lastAccount.current) {
      return;
    }
    
    lastRoleType.current = roleType;
    lastAccount.current = account;
    
    // If role is patient only (not provider or both), redirect to patient page
    if (roleType === 'patient') {
      hasRedirected.current = true;
      router.replace('/patient');
    }
    // If role is unknown, redirect to root dashboard
    else if (roleType === 'unknown') {
      hasRedirected.current = true;
      router.replace('/');
    }
  }, [account, roleType, roleLoading, router]);

  if (!account) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Provider Dashboard</h1>
          <p className="text-muted-foreground">Connect your wallet to view patients and manage consents</p>
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
        <h1 className="text-3xl font-bold tracking-tight">Provider Dashboard</h1>
        <p className="text-muted-foreground">View and manage patient consent requests</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v as 'all' | 'pending' | 'granted' | 'history');
        setPage(1);
        setSearchQuery(''); // Clear search when switching tabs
        setSelectedPatient(null);
      }}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">Patients</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="granted">Granted Consent</TabsTrigger>
            <TabsTrigger value="history">Consent History</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Patients</CardTitle>
                  <CardDescription>Search and request consent from any patient</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search patients..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {allPatientsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Patient ID</TableHead>
                        <TableHead>Wallet Address</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPatients.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            {searchQuery ? 'No patients found matching your search' : 'No patients available'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedPatients.map((patient) => {
                          const hasWallet = !!patient.blockchainIntegration?.walletAddress;
                          return (
                            <TableRow
                              key={patient.patientId}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => hasWallet && handlePatientClick(patient.patientId)}
                            >
                              <TableCell className="font-medium">
                                {patient.demographics.firstName} {patient.demographics.lastName}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{patient.patientId}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {hasWallet && patient.blockchainIntegration
                                  ? `${patient.blockchainIntegration.walletAddress.slice(0, 6)}...${patient.blockchainIntegration.walletAddress.slice(-4)}`
                                  : 'No wallet'}
                              </TableCell>
                              <TableCell>
                                {hasWallet ? (
                                  <Badge variant="outline">Available</Badge>
                                ) : (
                                  <Badge variant="secondary">No wallet</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {hasWallet && patient.blockchainIntegration && (
                                  <RequestConsentDialog
                                    patientAddress={patient.blockchainIntegration.walletAddress}
                                    patientId={patient.patientId}
                                    patientName={`${patient.demographics.firstName} ${patient.demographics.lastName}`}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                  {totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination
                        page={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        totalItems={filteredPatients.length}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Pending Requests
                  </CardTitle>
                  <CardDescription>
                    Access requests you've sent that are awaiting patient approval
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or patient ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                console.log('[ProviderDashboard] Pending Tab - Loading:', pendingRequestsLoading);
                console.log('[ProviderDashboard] Pending Tab - Data:', pendingRequestsData);
                
                if (pendingRequestsLoading) {
                  return (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  );
                }

                const requestsData = pendingRequestsData as { data: any[]; pagination: any } | undefined;
                if (requestsData?.data && Array.isArray(requestsData.data) && requestsData.data.length > 0) {
                  // Filter requests by search query
                  const filteredRequests = requestsData.data.filter((request: any) => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    const patientName = request.patient
                      ? `${request.patient.firstName} ${request.patient.lastName}`.toLowerCase()
                      : '';
                    const patientId = request.patient?.patientId?.toLowerCase() || '';
                    return patientName.includes(query) || patientId.includes(query);
                  });

                  if (filteredRequests.length === 0) {
                    return (
                      <div className="text-center text-muted-foreground py-8">
                        {searchQuery ? 'No pending requests found matching your search' : 'No pending requests'}
                      </div>
                    );
                  }

                  // Paginate filtered results
                  const filteredTotalPages = Math.ceil(filteredRequests.length / limit);
                  const filteredPage = Math.min(page, filteredTotalPages || 1);
                  const paginatedFiltered = filteredRequests.slice((filteredPage - 1) * limit, filteredPage * limit);

                  return (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Patient</TableHead>
                            <TableHead>Data Types</TableHead>
                            <TableHead>Purposes</TableHead>
                            <TableHead>Request Date</TableHead>
                            <TableHead>Expiration</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedFiltered.map((request: any) => {
                            const patientName = request.patient
                              ? `${request.patient.firstName} ${request.patient.lastName}`
                              : `${request.patientAddress.slice(0, 6)}...${request.patientAddress.slice(-4)}`;
                            
                            return (
                              <TableRow 
                                key={request.requestId}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => setSelectedRequest(request.requestId)}
                              >
                                <TableCell>
                                  <div>
                                    <div className="font-medium">{patientName}</div>
                                    {request.patient?.patientId && (
                                      <div className="text-xs text-muted-foreground font-mono">
                                        {request.patient.patientId}
                                      </div>
                                    )}
                                    <div className="text-xs text-muted-foreground font-mono">
                                      {request.patientAddress.slice(0, 6)}...{request.patientAddress.slice(-4)}
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
                                <TableCell>
                                  {request.expirationTime ? (
                                    <div className="flex items-center gap-1 text-sm">
                                      <Clock className="h-3 w-3" />
                                      {format(new Date(request.expirationTime), 'MMM d, yyyy HH:mm')}
                                    </div>
                                  ) : (
                                    <Badge variant="secondary">No expiration</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                                    Pending
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {filteredTotalPages > 1 && (
                        <div className="mt-4">
                          <Pagination
                            page={filteredPage}
                            totalPages={filteredTotalPages}
                            onPageChange={setPage}
                            totalItems={filteredRequests.length}
                          />
                        </div>
                      )}
                    </>
                  );
                }
                
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      {searchQuery ? 'No pending requests found matching your search' : 'No pending requests'}
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="granted" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Patients with Granted Consent</CardTitle>
                  <CardDescription>View patients who have granted you access to their data</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or patient ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                console.log('[ProviderDashboard] Granted Consent Tab - Loading:', grantedPatientsLoading);
                console.log('[ProviderDashboard] Granted Consent Tab - Data:', grantedPatientsData);
                
                if (grantedPatientsLoading) {
                  return (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  );
                }
                
                const patientsData = grantedPatientsData as { data: any[]; pagination: any } | undefined;
                if (patientsData?.data && Array.isArray(patientsData.data) && patientsData.data.length > 0) {
                  // Filter patients by search query
                  const filteredPatients = patientsData.data.filter((patient: any) => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    const name = `${patient.demographics.firstName} ${patient.demographics.lastName}`.toLowerCase();
                    return name.includes(query) || patient.patientId.toLowerCase().includes(query);
                  });

                  if (filteredPatients.length === 0) {
                    return (
                      <div className="text-center text-muted-foreground py-8">
                        {searchQuery ? 'No patients found matching your search' : 'No patients with granted consent'}
                      </div>
                    );
                  }

                  // Paginate filtered results
                  const filteredTotalPages = Math.ceil(filteredPatients.length / limit);
                  const filteredPage = Math.min(page, filteredTotalPages || 1);
                  const paginatedFiltered = filteredPatients.slice((filteredPage - 1) * limit, filteredPage * limit);

                  return (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Patient ID</TableHead>
                        <TableHead>Data Types</TableHead>
                        <TableHead>Expiration</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedFiltered.map((patient: any) => (
                        <TableRow
                          key={patient.patientId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handlePatientClick(patient.patientId)}
                        >
                          <TableCell className="font-medium">
                            {patient.demographics.firstName} {patient.demographics.lastName}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{patient.patientId}</TableCell>
                          <TableCell>
                            {patient.consents && patient.consents.length > 0 ? (
                              <ColoredBadgeList
                                type="dataType"
                                values={patient.consents.map((c: any) => c.dataType)}
                                size="sm"
                                maxDisplay={3}
                              />
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {patient.consents?.[0]?.expirationTime ? (
                              <span className="text-sm">
                                {new Date(patient.consents[0].expirationTime).toLocaleDateString()}
                              </span>
                            ) : (
                              <Badge variant="secondary">No expiration</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePatientClick(patient.patientId);
                              }}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredTotalPages > 1 && (
                    <div className="mt-4">
                      <Pagination
                        page={filteredPage}
                        totalPages={filteredTotalPages}
                        onPageChange={setPage}
                        totalItems={filteredPatients.length}
                      />
                    </div>
                  )}
                </>
                  );
                }
                
                return (
                  <div className="text-center text-muted-foreground py-8">
                    {searchQuery ? 'No patients found matching your search' : 'No patients with granted consent'}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Consent History
                  </CardTitle>
                  <CardDescription>
                    Complete timeline of all consent-related actions
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or patient ID..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </div>
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
                  {(() => {
                    // Filter history events by search query
                    const filteredHistory = historyData.filter((event: any) => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      const patientName = event.patientInfo
                        ? `${event.patientInfo.firstName} ${event.patientInfo.lastName}`.toLowerCase()
                        : '';
                      const patientId = event.patientInfo?.patientId?.toLowerCase() || '';
                      return patientName.includes(query) || patientId.includes(query);
                    });

                    if (filteredHistory.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <History className="h-12 w-12 text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">
                            {searchQuery ? 'No history events found matching your search' : 'No consent history'}
                          </p>
                        </div>
                      );
                    }

                    return filteredHistory.map((event: any, index: number) => {
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
                      statusBadge = <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">Active</Badge>;
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
                      eventType = 'Request Sent';
                      eventIcon = <Users className="h-5 w-5" />;
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
                        className={`cursor-pointer transition-all hover:shadow-sm hover:border-opacity-80 border-l-4 ${eventBorderColor} ${eventBgColor}`}
                        onClick={() => setSelectedHistoryEvent(event)}
                      >
                        <CardContent className="p-2">
                          <div className="flex items-center gap-2">
                            {/* Icon */}
                            {eventIcon && (
                              <div className={`flex-shrink-0 p-1 rounded-md ${eventBgColor} ${eventColor}`}>
                                {React.cloneElement(eventIcon, { className: 'h-3 w-3' })}
                              </div>
                            )}
                            
                            {/* Main Content */}
                            <div className="flex-1 min-w-0">
                              {/* Header */}
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h3 className={`font-semibold text-xs ${eventColor}`}>
                                    {eventType}
                                  </h3>
                                  {statusBadge}
                                  {isExpired && event.type === 'ConsentGranted' && (
                                    <Badge variant="destructive" className="text-[10px] h-4 px-1">Expired</Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {format(new Date(event.timestamp), 'MMM d, yyyy • h:mm a')}
                                </p>
                              </div>

                              {/* Details Grid - Compact */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-0.5 text-xs">
                                {/* Patient Info */}
                                {event.patientInfo ? (
                                  <div>
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Patient</p>
                                    <p className="text-[11px] font-semibold truncate">
                                      {event.patientInfo.firstName} {event.patientInfo.lastName}
                                    </p>
                                    {event.patientInfo.patientId && (
                                      <p className="text-[10px] text-muted-foreground font-mono truncate">
                                        {event.patientInfo.patientId}
                                      </p>
                                    )}
                                  </div>
                                ) : event.patient ? (
                                  <div>
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Patient</p>
                                    <p className="text-[11px] font-mono truncate">{event.patient.slice(0, 8)}...{event.patient.slice(-6)}</p>
                                  </div>
                                ) : null}

                                {/* Data Type & Purpose */}
                                {event.dataTypes && event.dataTypes.length > 0 && event.purposes && event.purposes.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Access</p>
                                    <div className="flex flex-wrap gap-0.5">
                                      {event.dataTypes.slice(0, 2).map((dt: string, idx: number) => (
                                        <ColoredBadge key={idx} type="dataType" value={dt} size="sm" />
                                      ))}
                                      {event.dataTypes.length > 2 && (
                                        <Badge variant="outline" className="text-[9px] h-3 px-1">+{event.dataTypes.length - 2}</Badge>
                                      )}
                                      {event.purposes.slice(0, 2).map((p: string, idx: number) => (
                                        <ColoredBadge key={idx} type="purpose" value={p} size="sm" />
                                      ))}
                                      {event.purposes.length > 2 && (
                                        <Badge variant="outline" className="text-[9px] h-3 px-1">+{event.purposes.length - 2}</Badge>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Expiration */}
                                {event.expirationTime && (event.type === 'ConsentGranted' || event.type === 'AccessRequested') && (
                                  <div>
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Expires</p>
                                    <div className="flex items-center gap-0.5">
                                      <Clock className="h-2 w-2 text-muted-foreground flex-shrink-0" />
                                      <p className="text-[11px] truncate">
                                        {format(new Date(event.expirationTime), 'MMM d, yyyy')}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* IDs */}
                                {(event.consentId !== undefined || event.requestId !== undefined) && (
                                  <div>
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                      {event.consentId !== undefined ? 'Consent ID' : 'Request ID'}
                                    </p>
                                    <p className="text-[11px] font-mono font-semibold">
                                      #{event.consentId ?? event.requestId}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  });
                  })()}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No history events found matching your search' : 'No consent history'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedPatient && account && (
        <PatientDetailsCard
          patientId={selectedPatient}
          providerAddress={account}
          onClose={handleCloseDetails}
        />
      )}

      {/* History Event Details Card */}
      {selectedHistoryEvent !== null && (
        <ConsentHistoryEventCard
          event={selectedHistoryEvent}
          onClose={() => setSelectedHistoryEvent(null)}
          userRole="provider"
        />
      )}

      {/* Request Details Card */}
      {selectedRequest !== null && (
        <RequestDetailsCard
          requestId={selectedRequest}
          onClose={handleCloseRequestCard}
        />
      )}
    </div>
  );
}

