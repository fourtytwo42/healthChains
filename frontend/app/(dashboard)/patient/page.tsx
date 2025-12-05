'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWallet } from '@/contexts/wallet-context';
import { useRole } from '@/hooks/use-role';
import { usePatientPendingRequests, usePatientConsentsPaginated, useRevokeConsent } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, FileCheck, Clock, CheckCircle, XCircle, X, Loader2 } from 'lucide-react';
import { RequestResponseCard } from '@/components/patient/request-response-card';
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
 * Shows pending requests and granted consents with ability to approve/deny and revoke
 */
export default function PatientDashboardPage() {
  const router = useRouter();
  const { account } = useWallet();
  const { role, isLoading: roleLoading } = useRole(account);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [requestsPage, setRequestsPage] = useState(1);
  const [consentsPage, setConsentsPage] = useState(1);
  const limit = 10;

  const revokeConsent = useRevokeConsent();

  // Fetch pending requests
  const { data: requestsData, isLoading: requestsLoading } = usePatientPendingRequests(
    account || '',
    requestsPage,
    limit,
    !!account
  );

  // Fetch granted consents
  const { data: consentsData, isLoading: consentsLoading } = usePatientConsentsPaginated(
    account || '',
    consentsPage,
    limit,
    false,
    !!account
  );

  const handleRequestClick = (requestId: number) => {
    setSelectedRequest(requestId);
  };

  const handleCloseRequestCard = () => {
    setSelectedRequest(null);
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

      {/* Pending Requests Section */}
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
          {(() => {
            // Debug logging
            console.log('[PatientDashboard] requestsLoading:', requestsLoading);
            console.log('[PatientDashboard] requestsData:', requestsData);
            console.log('[PatientDashboard] requestsData?.data:', requestsData?.data);
            console.log('[PatientDashboard] requestsData?.data?.length:', requestsData?.data?.length);
            
            if (requestsLoading) {
              return (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              );
            }
            
            if (requestsData?.data && requestsData.data.length > 0) {
              return (
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
                    onPageChange={setRequestsPage}
                    totalItems={requestsData.pagination.total}
                  />
                </div>
              )}
                </>
              );
            }
            
            return (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No pending requests</p>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Granted Consents Section */}
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
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : consentsData?.data && consentsData.data.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Data Type</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consentsData.data.map((consent) => (
                    <TableRow key={consent.consentId}>
                      <TableCell>
                        <div className="font-mono text-xs">
                          {consent.providerAddress.slice(0, 6)}...{consent.providerAddress.slice(-4)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{consent.dataType}</Badge>
                      </TableCell>
                      <TableCell>{consent.purpose}</TableCell>
                      <TableCell>
                        {consent.expirationTime ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {format(new Date(consent.expirationTime), 'MMM d, yyyy')}
                          </div>
                        ) : (
                          <Badge variant="secondary">No expiration</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {consent.isExpired || !consent.isActive ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {consentsData.pagination && consentsData.pagination.totalPages > 1 && (
                <div className="mt-4">
                  <Pagination
                    page={consentsData.pagination.page}
                    totalPages={consentsData.pagination.totalPages}
                    onPageChange={setConsentsPage}
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

      {/* Request Response Card */}
      {selectedRequest !== null && (
        <RequestResponseCard
          requestId={selectedRequest}
          onClose={handleCloseRequestCard}
        />
      )}
    </div>
  );
}

