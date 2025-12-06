'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TabsContent } from '@/components/ui/tabs';
import { useProviderDashboard } from '@/hooks/provider/use-provider-dashboard';
import { ProviderDashboardHeader } from '@/components/provider/dashboard/provider-dashboard-header';
import { ProviderTabs } from '@/components/provider/dashboard/provider-tabs';
import { ProviderPatientsTable } from '@/components/provider/dashboard/provider-patients-table';
import { ProviderPendingRequests } from '@/components/provider/dashboard/provider-pending-requests';
import { ProviderGrantedConsents } from '@/components/provider/dashboard/provider-granted-consents';
import { ProviderConsentHistory } from '@/components/provider/dashboard/provider-consent-history';
import { ConsentHistoryEventCard } from '@/components/shared/consent-history-event-card';
import { PatientDetailsCard } from '@/components/provider/patient-details-card';
import { GrantedConsentDetailsCard } from '@/components/provider/granted-consent-details-card';
import type { ConsentHistoryEvent } from '@/types/consent';

/**
 * Provider Dashboard Page
 * Microsoft Lists-style table with search, tabs, and pagination
 */
export default function ProviderDashboardPage() {
  const {
    account,
    providerName,
    searchQuery,
    debouncedSearchQuery,
    setSearchQuery,
    selectedPatient,
    setSelectedPatient,
    selectedGrantedPatient,
    setSelectedGrantedPatient,
    selectedPendingPatient,
    setSelectedPendingPatient,
    selectedHistoryEvent,
    setSelectedHistoryEvent,
    activeTab,
    handleTabChange,
    page,
    setPage,
    limit,
    sortColumn,
    sortDirection,
    handleSort,
    allPatientsLoading,
    pendingRequestsLoading,
    grantedPatientsLoading,
    historyLoading,
    paginatedPatients,
    totalPages,
    stablePendingRequests,
    stableGrantedPatients,
    historyData,
    getConsentStatus,
    handlePatientClick,
    handleGrantedPatientClick,
    handlePendingRequestClick,
    handleOpenMedicalChart,
    exportPatientsToCSV,
    printPatients,
    exportPendingToCSV,
    printPending,
    exportGrantedToCSV,
    printGranted,
    exportHistoryToCSV,
    printHistory,
  } = useProviderDashboard();

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

  const handleCloseDetails = () => {
    setSelectedPatient(null);
  };

  const handleCloseGrantedDetails = () => {
    setSelectedGrantedPatient(null);
  };

  const handleClosePendingDetails = () => {
    setSelectedPendingPatient(null);
  };

  return (
    <div className="space-y-6">
      <ProviderDashboardHeader providerName={providerName} />

      <ProviderTabs activeTab={activeTab} onTabChange={handleTabChange}>
        <TabsContent value="all" className="space-y-4">
          <ProviderPatientsTable
            patients={paginatedPatients}
            isLoading={allPatientsLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onPatientClick={handlePatientClick}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            getConsentStatus={getConsentStatus}
            onExportCSV={exportPatientsToCSV}
            onPrint={printPatients}
            debouncedSearchQuery={debouncedSearchQuery}
          />
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <ProviderPendingRequests
            requests={stablePendingRequests}
            isLoading={pendingRequestsLoading}
            searchQuery={searchQuery}
            debouncedSearchQuery={debouncedSearchQuery}
            onSearchChange={setSearchQuery}
            onRequestClick={handlePendingRequestClick}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onExportCSV={exportPendingToCSV}
            onPrint={printPending}
          />
        </TabsContent>

        <TabsContent value="granted" className="space-y-4">
          <ProviderGrantedConsents
            patients={stableGrantedPatients as { data: any[]; pagination: any } | undefined}
            isLoading={grantedPatientsLoading}
            searchQuery={searchQuery}
            debouncedSearchQuery={debouncedSearchQuery}
            onSearchChange={setSearchQuery}
            onPatientClick={handleGrantedPatientClick}
            page={page}
            limit={limit}
            onPageChange={setPage}
            onExportCSV={exportGrantedToCSV}
            onPrint={printGranted}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <ProviderConsentHistory
            history={historyData}
            isLoading={historyLoading}
            searchQuery={searchQuery}
            debouncedSearchQuery={debouncedSearchQuery}
            onSearchChange={setSearchQuery}
            onEventClick={(event) => setSelectedHistoryEvent(event)}
            onExportCSV={exportHistoryToCSV}
            onPrint={printHistory}
          />
        </TabsContent>
      </ProviderTabs>

      {/* Patient Details Card (Medical Chart) - from "Patients" tab */}
      {selectedPatient && account && (
        <PatientDetailsCard
          patientId={selectedPatient.patientId}
          patientWalletAddress={selectedPatient.blockchainIntegration?.walletAddress}
          providerAddress={account}
          onClose={handleCloseDetails}
        />
      )}

      {/* Granted Consent Details Card - from "Granted Consent" tab */}
      {selectedGrantedPatient && account && (
        <GrantedConsentDetailsCard
          patientId={selectedGrantedPatient.patientId}
          patientWalletAddress={selectedGrantedPatient.patientWalletAddress}
          providerAddress={account}
          onClose={handleCloseGrantedDetails}
          onOpenMedicalChart={handleOpenMedicalChart}
        />
      )}

      {/* Pending Request Patient Details Card - from "Pending" tab */}
      {selectedPendingPatient && account && (
        <GrantedConsentDetailsCard
          patientId={selectedPendingPatient.patientId}
          patientWalletAddress={selectedPendingPatient.patientWalletAddress}
          providerAddress={account}
          onClose={handleClosePendingDetails}
          onOpenMedicalChart={handleOpenMedicalChart}
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
    </div>
  );
}
