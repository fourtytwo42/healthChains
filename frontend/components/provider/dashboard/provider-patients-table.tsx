'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, Printer, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import type { Patient } from '@/lib/api-client';

interface ProviderPatientsTableProps {
  patients: Patient[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onPatientClick: (patientId: string) => void;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  getConsentStatus: (patientAddress: string) => { status: string; dataTypesCount: number };
  onExportCSV: () => void;
  onPrint: () => void;
  debouncedSearchQuery: string;
}

export function ProviderPatientsTable({
  patients,
  isLoading,
  searchQuery,
  onSearchChange,
  onPatientClick,
  sortColumn,
  sortDirection,
  onSort,
  page,
  totalPages,
  onPageChange,
  getConsentStatus,
  onExportCSV,
  onPrint,
  debouncedSearchQuery,
}: ProviderPatientsTableProps) {
  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>All Patients</CardTitle>
            <CardDescription>Search and request consent from any patient</CardDescription>
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
                    aria-label="Export patients to CSV"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export patients to CSV</p>
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
                    aria-label="Print patients"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Print patients</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  onPageChange(1);
                }}
                className="pl-8 w-64"
                aria-label="Search patients"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border hover:bg-transparent">
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                    onClick={() => onSort('name')}
                    aria-label="Sort by name"
                    role="columnheader"
                  >
                    <div className="flex items-center">
                      Name
                      {getSortIcon('name')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                    onClick={() => onSort('patientId')}
                    aria-label="Sort by patient ID"
                    role="columnheader"
                  >
                    <div className="flex items-center">
                      Patient ID
                      {getSortIcon('patientId')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                    onClick={() => onSort('walletAddress')}
                    aria-label="Sort by wallet address"
                    role="columnheader"
                  >
                    <div className="flex items-center">
                      Wallet Address
                      {getSortIcon('walletAddress')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                    onClick={() => onSort('dob')}
                    aria-label="Sort by date of birth"
                    role="columnheader"
                  >
                    <div className="flex items-center">
                      DOB
                      {getSortIcon('dob')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                    onClick={() => onSort('age')}
                    aria-label="Sort by age"
                    role="columnheader"
                  >
                    <div className="flex items-center">
                      Age
                      {getSortIcon('age')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                    onClick={() => onSort('gender')}
                    aria-label="Sort by gender"
                    role="columnheader"
                  >
                    <div className="flex items-center">
                      Sex
                      {getSortIcon('gender')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                    onClick={() => onSort('phone')}
                    aria-label="Sort by phone"
                    role="columnheader"
                  >
                    <div className="flex items-center">
                      Phone
                      {getSortIcon('phone')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                    onClick={() => onSort('email')}
                    aria-label="Sort by email"
                    role="columnheader"
                  >
                    <div className="flex items-center">
                      Email
                      {getSortIcon('email')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                    onClick={() => onSort('address')}
                    aria-label="Sort by address"
                    role="columnheader"
                  >
                    <div className="flex items-center">
                      Address
                      {getSortIcon('address')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold"
                    onClick={() => onSort('consent')}
                    aria-label="Sort by consent status"
                    role="columnheader"
                  >
                    <div className="flex items-center">
                      Consent
                      {getSortIcon('consent')}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      {debouncedSearchQuery ? 'No patients found matching your search' : 'No patients available'}
                    </TableCell>
                  </TableRow>
                ) : (
                  patients.map((patient) => {
                    const hasWallet = !!patient.blockchainIntegration?.walletAddress;
                    const patientAddress = patient.blockchainIntegration?.walletAddress || '';
                    const consentInfo = getConsentStatus(patientAddress);
                    
                    let consentBadge = null;
                    if (consentInfo.status === 'full') {
                      consentBadge = (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                          Full
                        </Badge>
                      );
                    } else if (consentInfo.status === 'partial') {
                      consentBadge = (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800">
                          Partial
                        </Badge>
                      );
                    } else {
                      consentBadge = (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/30 dark:text-gray-400 dark:border-gray-800">
                          None
                        </Badge>
                      );
                    }

                    return (
                      <TableRow
                        key={patient.patientId}
                        className={`cursor-pointer transition-colors border-r-0 ${
                          patients.indexOf(patient) % 2 === 0
                            ? 'bg-background hover:bg-muted/60'
                            : 'bg-muted/20 hover:bg-muted/80'
                        }`}
                        onClick={() => hasWallet && onPatientClick(patient.patientId)}
                      >
                        <TableCell className="font-medium border-r border-border/30">
                          {patient.demographics.firstName} {patient.demographics.lastName}
                        </TableCell>
                        <TableCell className="font-mono text-sm border-r border-border/30">{patient.patientId}</TableCell>
                        <TableCell className="font-mono text-xs border-r border-border/30">
                          {hasWallet && patient.blockchainIntegration
                            ? `${patient.blockchainIntegration.walletAddress.slice(0, 6)}...${patient.blockchainIntegration.walletAddress.slice(-4)}`
                            : 'No wallet'}
                        </TableCell>
                        <TableCell className="text-sm border-r border-border/30">
                          {patient.demographics?.dateOfBirth 
                            ? format(new Date(String(patient.demographics.dateOfBirth)), 'MMM d, yyyy')
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm border-r border-border/30">
                          {patient.demographics?.age ?? 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm border-r border-border/30">
                          {patient.demographics?.gender || 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm border-r border-border/30">
                          {(patient.demographics as any)?.contact?.phone || 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm border-r border-border/30">
                          {(patient.demographics as any)?.contact?.email || 'N/A'}
                        </TableCell>
                        <TableCell className="text-sm border-r border-border/30">
                          {(patient.demographics as any)?.address 
                            ? `${(patient.demographics as any).address.street}, ${(patient.demographics as any).address.city}, ${(patient.demographics as any).address.state} ${(patient.demographics as any).address.zipCode}`
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {hasWallet ? consentBadge : (
                            <Badge variant="secondary">N/A</Badge>
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
                  onPageChange={onPageChange}
                  totalItems={patients.length}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

