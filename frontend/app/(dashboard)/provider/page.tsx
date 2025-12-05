'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePatients } from '@/hooks/use-api';
import { useWallet } from '@/contexts/wallet-context';
import { useRole } from '@/hooks/use-role';
import { useProviderPatients, useProviderConsentsPaginated } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, Users, FileCheck } from 'lucide-react';
import { RequestConsentDialog } from '@/components/provider/request-consent-dialog';
import { PatientDetailsCard } from '@/components/provider/patient-details-card';
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
  const [activeTab, setActiveTab] = useState<'all' | 'granted'>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Fetch all patients for "All Users" tab
  const { data: allPatientsData, isLoading: allPatientsLoading } = usePatients();
  
  // Fetch patients with granted consents for "Granted Consent" tab
  const { data: grantedPatientsData, isLoading: grantedPatientsLoading } = useProviderPatients(
    account || '',
    page,
    limit,
    activeTab === 'granted'
  );

  // Filter patients by search query
  const filteredPatients = (allPatientsData || []).filter(patient => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const name = `${patient.demographics.firstName} ${patient.demographics.lastName}`.toLowerCase();
    return name.includes(query) || patient.patientId.toLowerCase().includes(query);
  });

  const paginatedPatients = filteredPatients.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(filteredPatients.length / limit);

  const handlePatientClick = (patientId: string) => {
    setSelectedPatient(patientId);
  };

  const handleCloseDetails = () => {
    setSelectedPatient(null);
  };

  // Redirect if role changes and user is not a provider
  useEffect(() => {
    if (roleLoading || !account) return;
    
    // If role is patient only (not provider or both), redirect to patient page
    if (role?.role === 'patient') {
      router.replace('/patient');
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
        setActiveTab(v as 'all' | 'granted');
        setPage(1);
        setSelectedPatient(null);
      }}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All Users</TabsTrigger>
            <TabsTrigger value="granted">Granted Consent</TabsTrigger>
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

        <TabsContent value="granted" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Patients with Granted Consent</CardTitle>
              <CardDescription>View patients who have granted you access to their data</CardDescription>
            </CardHeader>
            <CardContent>
              {grantedPatientsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : grantedPatientsData?.data && grantedPatientsData.data.length > 0 ? (
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
                      {grantedPatientsData.data.map((patient: any) => (
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
                            <div className="flex flex-wrap gap-1">
                              {patient.consents?.map((consent: any, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {consent.dataType}
                                </Badge>
                              ))}
                            </div>
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
                  {grantedPatientsData.pagination && grantedPatientsData.pagination.totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination
                        page={grantedPatientsData.pagination.page}
                        totalPages={grantedPatientsData.pagination.totalPages}
                        onPageChange={setPage}
                        totalItems={grantedPatientsData.pagination.total}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No patients with granted consent
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
    </div>
  );
}

