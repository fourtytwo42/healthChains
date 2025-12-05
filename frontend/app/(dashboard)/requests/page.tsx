'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePatientRequests, usePatients, useApproveRequest, useDenyRequest } from '@/hooks/use-api';
import { useWallet } from '@/contexts/wallet-context';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { MessageSquare, Clock, CheckCircle, XCircle, Check, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

/**
 * Requests Page - View and manage access requests
 */
export default function RequestsPage() {
  const { data: patients } = usePatients();
  const { account, isConnected } = useWallet();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');

  // Find the selected patient and get their wallet address
  const selectedPatient = patients?.find((p) => p.patientId === selectedPatientId);
  const patientAddress = selectedPatient?.blockchainIntegration?.walletAddress;

  const { data: requests, isLoading, error } = usePatientRequests(
    patientAddress || '',
    statusFilter === 'all' ? 'all' : statusFilter
  );
  const approveRequest = useApproveRequest();
  const denyRequest = useDenyRequest();

  // Note: patientAddress is no longer needed since we use the connected wallet account

  const handleApprove = (requestId: number) => {
    if (!account || !isConnected) return;
    approveRequest.mutate({ requestId });
  };

  const handleDeny = (requestId: number) => {
    if (!account || !isConnected) return;
    denyRequest.mutate({ requestId });
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Access Requests</h1>
          <p className="text-muted-foreground">View and manage patient access requests</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load requests. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'denied':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10">Pending</Badge>;
      case 'approved':
        return <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400">Approved</Badge>;
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Access Requests</h1>
        <p className="text-muted-foreground">View and manage patient access requests</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Queue</CardTitle>
          <CardDescription>Select a patient to view their access requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Patient</label>
            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a patient..." />
              </SelectTrigger>
              <SelectContent>
                {patients?.map((patient) => {
                  const hasWallet = !!patient.blockchainIntegration?.walletAddress;
                  return (
                    <SelectItem 
                      key={patient.patientId} 
                      value={patient.patientId}
                      disabled={!hasWallet}
                    >
                      {patient.demographics.firstName} {patient.demographics.lastName} (
                      {patient.patientId})
                      {!hasWallet && ' (No wallet)'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {!selectedPatientId || !patientAddress ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Please select a patient to view requests.</p>
            </div>
          ) : (
            <>
              <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="approved">Approved</TabsTrigger>
                  <TabsTrigger value="denied">Denied</TabsTrigger>
                </TabsList>
              </Tabs>

              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : requests && requests.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request ID</TableHead>
                      <TableHead>Requester</TableHead>
                      <TableHead>Data Type</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      {isConnected && account && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.requestId}>
                        <TableCell className="font-mono text-sm">{request.requestId}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {request.requester.slice(0, 6)}...{request.requester.slice(-4)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{request.dataType}</Badge>
                        </TableCell>
                        <TableCell>{request.purpose}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(request.status)}
                            {getStatusBadge(request.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {format(new Date(request.timestamp), 'MMM d, yyyy HH:mm')}
                          </div>
                        </TableCell>
                        {isConnected && account && (
                          <TableCell>
                            {request.status === 'pending' && (
                              <div className="flex items-center gap-2">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      disabled={approveRequest.isPending || denyRequest.isPending}
                                    >
                                      {approveRequest.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <>
                                          <Check className="h-4 w-4 mr-1" />
                                          Approve
                                        </>
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Approve Access Request</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to approve this access request? This will grant consent to the requester.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleApprove(request.requestId)}
                                        className="bg-green-600 hover:bg-green-700"
                                      >
                                        Approve
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      disabled={approveRequest.isPending || denyRequest.isPending}
                                    >
                                      {denyRequest.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <>
                                          <X className="h-4 w-4 mr-1" />
                                          Deny
                                        </>
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Deny Access Request</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to deny this access request? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeny(request.requestId)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Deny
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No {statusFilter !== 'all' ? statusFilter : ''} requests found for this patient.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

