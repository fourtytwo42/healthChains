'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, Printer, MessageSquare, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ColoredBadgeList } from '@/components/shared/colored-badge';
import { format } from 'date-fns';
import { matchesDate } from '@/lib/date-utils';
import type { AccessRequest, PaginatedResponse } from '@/types/consent';

interface ProviderPendingRequestsProps {
  requests: PaginatedResponse<AccessRequest> | undefined;
  isLoading: boolean;
  searchQuery: string;
  debouncedSearchQuery: string;
  onSearchChange: (value: string) => void;
  onRequestClick: (request: AccessRequest) => void;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onExportCSV: () => void;
  onPrint: () => void;
}

export function ProviderPendingRequests({
  requests,
  isLoading,
  searchQuery,
  debouncedSearchQuery,
  onSearchChange,
  onRequestClick,
  page,
  limit,
  onPageChange,
  onExportCSV,
  onPrint,
}: ProviderPendingRequestsProps) {
  if (isLoading) {
    return (
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!requests) {
    return (
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No pending requests</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const requestsData = requests as PaginatedResponse<AccessRequest> | undefined;
  if (!requestsData?.data || !Array.isArray(requestsData.data) || requestsData.data.length === 0) {
    return (
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onExportCSV}
                      className="h-8 w-8 p-0"
                      aria-label="Export pending requests to CSV"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Export pending requests to CSV</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onPrint}
                      className="h-8 w-8 p-0"
                      aria-label="Print pending requests"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Print pending requests</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by any column value..."
                  value={searchQuery}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                    onPageChange(1);
                  }}
                  className="pl-8 w-64"
                  aria-label="Search pending requests"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            {debouncedSearchQuery ? 'No pending requests found matching your search' : 'No pending requests'}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter requests by search query
  const filteredRequests = requestsData.data.filter((request: AccessRequest) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const patientName = request.patient
      ? `${request.patient.firstName} ${request.patient.lastName}`.toLowerCase()
      : '';
    const patientId = request.patient?.patientId?.toLowerCase() || '';
    const patientAddress = (request.patientAddress || '').toLowerCase();
    const dataTypes = (request.dataTypes || []).map((dt: string) => dt.toLowerCase()).join(' ');
    const purposes = (request.purposes || []).map((p: string) => p.toLowerCase()).join(' ');
    return patientName.includes(query) || 
           patientId.includes(query) || 
           patientAddress.includes(query) ||
           dataTypes.includes(query) ||
           purposes.includes(query);
  });

  if (filteredRequests.length === 0) {
    return (
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onExportCSV}
                      className="h-8 w-8 p-0"
                      aria-label="Export pending requests to CSV"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Export pending requests to CSV</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onPrint}
                      className="h-8 w-8 p-0"
                      aria-label="Print pending requests"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Print pending requests</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by any column value..."
                  value={searchQuery}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                    onPageChange(1);
                  }}
                  className="pl-8 w-64"
                  aria-label="Search pending requests"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            {debouncedSearchQuery ? 'No pending requests found matching your search' : 'No pending requests'}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Paginate filtered results
  const filteredTotalPages = Math.ceil(filteredRequests.length / limit);
  const filteredPage = Math.min(page, filteredTotalPages || 1);
  const paginatedFiltered = filteredRequests.slice((filteredPage - 1) * limit, filteredPage * limit);

  return (
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onExportCSV}
                    className="h-8 w-8 p-0"
                    aria-label="Export pending requests to CSV"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export pending requests to CSV</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPrint}
                    className="h-8 w-8 p-0"
                    aria-label="Print pending requests"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Print pending requests</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by any column value..."
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  onPageChange(1);
                }}
                className="pl-8 w-64"
                aria-label="Search pending requests"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead aria-label="Patient" role="columnheader">Patient</TableHead>
              <TableHead aria-label="Data Types" role="columnheader">Data Types</TableHead>
              <TableHead aria-label="Purposes" role="columnheader">Purposes</TableHead>
              <TableHead aria-label="Request Date" role="columnheader">Request Date</TableHead>
              <TableHead aria-label="Expiration" role="columnheader">Expiration</TableHead>
              <TableHead aria-label="Status" role="columnheader">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedFiltered.map((request: AccessRequest) => {
              const patientName = request.patient
                ? `${request.patient.firstName} ${request.patient.lastName}`
                : `${request.patientAddress.slice(0, 6)}...${request.patientAddress.slice(-4)}`;
              
              return (
                <TableRow 
                  key={request.requestId}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onRequestClick(request)}
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
              onPageChange={onPageChange}
              totalItems={filteredRequests.length}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

