'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, Printer, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ColoredBadgeList } from '@/components/shared/colored-badge';
import { format } from 'date-fns';
import { matchesDate } from '@/lib/date-utils';
import type { ProviderPatient, PaginatedResponse, PaginationData } from '@/types/consent';
import type { ConsentRecord } from '@/lib/api-client';
import type { Demographics } from '@/types/patient';

interface ProviderGrantedConsentsProps {
  patients: PaginatedResponse<ProviderPatient> | undefined;
  isLoading: boolean;
  searchQuery: string;
  debouncedSearchQuery: string;
  onSearchChange: (value: string) => void;
  onPatientClick: (patientId: string) => void;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onExportCSV: () => void;
  onPrint: () => void;
}

export function ProviderGrantedConsents({
  patients,
  isLoading,
  searchQuery,
  debouncedSearchQuery,
  onSearchChange,
  onPatientClick,
  page,
  limit,
  onPageChange,
  onExportCSV,
  onPrint,
}: ProviderGrantedConsentsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Patients with Granted Consent</CardTitle>
              <CardDescription>View patients who have granted you access to their data</CardDescription>
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

  if (!patients) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Patients with Granted Consent</CardTitle>
              <CardDescription>View patients who have granted you access to their data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No patients with granted consent
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!patients.data || !Array.isArray(patients.data) || patients.data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Patients with Granted Consent</CardTitle>
              <CardDescription>View patients who have granted you access to their data</CardDescription>
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
                      aria-label="Export granted consents to CSV"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Export granted consents to CSV</p>
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
                      aria-label="Print granted consents"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Print granted consents</p>
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
                  aria-label="Search granted consents"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            {debouncedSearchQuery ? 'No patients found matching your search' : 'No patients with granted consent'}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter patients by search query
  const filteredPatients = patients.data.filter((patient: ProviderPatient) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const demographics = patient.demographics as Demographics | undefined;
    const name = `${demographics?.firstName || ''} ${demographics?.lastName || ''}`.toLowerCase();
    const patientId = (patient.patientId || '').toLowerCase();
    const blockchainIntegration = patient.blockchainIntegration as { walletAddress?: string } | undefined;
    const walletAddress = (blockchainIntegration?.walletAddress || '').toLowerCase();
    const dob = String(demographics?.dateOfBirth || '');
    
    const dateMatches = dob ? matchesDate(debouncedSearchQuery, dob) : false;
    
    const allDataTypes = new Set<string>();
    const allPurposes = new Set<string>();
    patient.consents?.forEach((c: ConsentRecord) => {
      if (c.dataTypes && Array.isArray(c.dataTypes)) {
        c.dataTypes.forEach((dt: string) => allDataTypes.add(dt.toLowerCase()));
      } else if (c.dataType) {
        allDataTypes.add(c.dataType.toLowerCase());
      }
      if (c.purposes && Array.isArray(c.purposes)) {
        c.purposes.forEach((p: string) => allPurposes.add(p.toLowerCase()));
      } else if (c.purpose) {
        allPurposes.add(c.purpose.toLowerCase());
      }
    });
    const dataTypesStr = Array.from(allDataTypes).join(' ');
    const purposesStr = Array.from(allPurposes).join(' ');
    
    return name.includes(query) || 
           patientId.includes(query) || 
           walletAddress.includes(query) ||
           dateMatches ||
           dataTypesStr.includes(query) ||
           purposesStr.includes(query);
  });

  if (filteredPatients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Patients with Granted Consent</CardTitle>
              <CardDescription>View patients who have granted you access to their data</CardDescription>
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
                      aria-label="Export granted consents to CSV"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Export granted consents to CSV</p>
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
                      aria-label="Print granted consents"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Print granted consents</p>
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
                  aria-label="Search granted consents"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            {debouncedSearchQuery ? 'No patients found matching your search' : 'No patients with granted consent'}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Paginate filtered results
  const filteredTotalPages = Math.ceil(filteredPatients.length / limit);
  const filteredPage = Math.min(page, filteredTotalPages || 1);
  const paginatedFiltered = filteredPatients.slice((filteredPage - 1) * limit, filteredPage * limit);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Patients with Granted Consent</CardTitle>
            <CardDescription>View patients who have granted you access to their data</CardDescription>
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
                    aria-label="Export granted consents to CSV"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export granted consents to CSV</p>
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
                    aria-label="Print granted consents"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Print granted consents</p>
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
                aria-label="Search granted consents"
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
              <TableHead aria-label="Granted Date" role="columnheader">Granted Date</TableHead>
              <TableHead aria-label="Expiration" role="columnheader">Expiration</TableHead>
              <TableHead aria-label="Status" role="columnheader">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedFiltered.map((patient: ProviderPatient) => {
              const allDataTypes = new Set<string>();
              const allPurposes = new Set<string>();
              
              const sortedConsents = patient.consents
                ? [...patient.consents].sort((a: ConsentRecord, b: ConsentRecord) => {
                    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return timeB - timeA;
                  })
                : [];
              const latestConsent = sortedConsents[0];
              
              patient.consents?.forEach((c: ConsentRecord) => {
                if (c.dataTypes && Array.isArray(c.dataTypes)) {
                  c.dataTypes.forEach((dt: string) => allDataTypes.add(dt));
                } else if (c.dataType) {
                  allDataTypes.add(c.dataType);
                }
                
                if (c.purposes && Array.isArray(c.purposes)) {
                  c.purposes.forEach((p: string) => allPurposes.add(p));
                } else if (c.purpose) {
                  allPurposes.add(c.purpose);
                }
              });
              
              const patientDemographics = patient.demographics as Demographics | undefined;
              const patientBlockchain = patient.blockchainIntegration as { walletAddress?: string } | undefined;
              const patientName = patientDemographics
                ? `${patientDemographics.firstName} ${patientDemographics.lastName}`
                : `${patientBlockchain?.walletAddress?.slice(0, 6) || ''}...${patientBlockchain?.walletAddress?.slice(-4) || ''}`;
              
              const walletAddress = patientBlockchain?.walletAddress || '';
              
              return (
                <TableRow 
                  key={patient.patientId}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onPatientClick(patient.patientId)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">{patientName}</div>
                      {patient.patientId && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {patient.patientId}
                        </div>
                      )}
                      {walletAddress && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {allDataTypes.size > 0 ? (
                      <ColoredBadgeList type="dataType" values={Array.from(allDataTypes)} size="sm" maxDisplay={2} />
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {allPurposes.size > 0 ? (
                      <ColoredBadgeList type="purpose" values={Array.from(allPurposes)} size="sm" maxDisplay={2} />
                    ) : (
                      <span className="text-sm text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {latestConsent?.timestamp ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {format(new Date(latestConsent.timestamp), 'MMM d, yyyy HH:mm')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {latestConsent?.expirationTime ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {format(new Date(latestConsent.expirationTime), 'MMM d, yyyy HH:mm')}
                      </div>
                    ) : (
                      <Badge variant="secondary">No expiration</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {latestConsent?.isExpired ? (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">
                        Expired
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                        Active
                      </Badge>
                    )}
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
              totalItems={filteredPatients.length}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

