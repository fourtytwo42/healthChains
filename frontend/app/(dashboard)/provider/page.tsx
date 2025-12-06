'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePatients } from '@/hooks/use-api';
import { useWallet } from '@/contexts/wallet-context';
import { useRole } from '@/hooks/use-role';
import { useProviderPatients, useProviderConsentsPaginated, useProviderConsentHistory, useProviderPendingRequests, useProviders } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Search, Users, FileCheck, History, X, Clock, MessageSquare, Download, Printer, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ColoredBadge, ColoredBadgeList } from '@/components/shared/colored-badge';
import { format } from 'date-fns';
import { RequestConsentDialog } from '@/components/provider/request-consent-dialog';
import { ConsentHistoryEventCard } from '@/components/shared/consent-history-event-card';
import { RequestDetailsCard } from '@/components/provider/request-details-card';
import { PatientDetailsCard } from '@/components/provider/patient-details-card';
import { GrantedConsentDetailsCard } from '@/components/provider/granted-consent-details-card';
import { Pagination } from '@/components/ui/pagination';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Patient } from '@/lib/api-client';
import { matchesDate } from '@/lib/date-utils';

/**
 * Provider Dashboard Page
 * Microsoft Lists-style table with search, tabs, and pagination
 */
export default function ProviderDashboardPage() {
  const router = useRouter();
  const { account } = useWallet();
  const { role, isLoading: roleLoading } = useRole(account);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedGrantedPatient, setSelectedGrantedPatient] = useState<Patient | null>(null);
  const [selectedPendingPatient, setSelectedPendingPatient] = useState<{ patientId: string; patientWalletAddress?: string } | null>(null);
  const [selectedHistoryEvent, setSelectedHistoryEvent] = useState<any | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'granted' | 'history'>('all');
  const [page, setPage] = useState(1);
  const limit = 10;
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch all patients for "All Users" tab
  const { data: allPatientsData, isLoading: allPatientsLoading } = usePatients({
    enabled: !!account,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch providers to get current provider's name
  const { data: providersData } = useProviders();
  const currentProvider = providersData?.find((p: any) => 
    p.blockchainIntegration?.walletAddress?.toLowerCase() === account?.toLowerCase()
  );
  const providerName = currentProvider?.organizationName || 'Provider Dashboard';

  // Store patients in state - only update when data actually changes
  // This completely avoids useMemo dependencies on React Query data
  const [stablePatients, setStablePatients] = useState<Patient[]>([]);
  const patientsIdsRef = useRef<string>('');
  
  useEffect(() => {
    if (Array.isArray(allPatientsData)) {
      // Compare by patient IDs to detect actual changes
      const newIds = allPatientsData.map(p => p.patientId).sort().join(',');
      if (newIds !== patientsIdsRef.current) {
        patientsIdsRef.current = newIds;
        setStablePatients(allPatientsData);
      }
    }
  }, [allPatientsData]); // Only depend on allPatientsData, not stablePatients
  
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

  // Use data directly - React Query already handles caching and stability
  const stablePendingRequests = pendingRequestsData;
  const stableGrantedPatients = grantedPatientsData;

  // Fetch consent history for "History" tab
  const { data: historyData, isLoading: historyLoading } = useProviderConsentHistory(
    account || '',
    activeTab === 'history' && !!account
  );

  // Fetch all provider consents to determine consent status for each patient
  const { data: allConsentsData } = useProviderConsentsPaginated(
    account || '',
    1,
    1000, // Get all consents
    false, // Include expired
    !!account
  );

  // All possible data types
  const ALL_DATA_TYPES = [
    'medical_records',
    'diagnostic_data',
    'genetic_data',
    'imaging_data',
    'laboratory_results',
    'prescription_history',
    'vital_signs',
    'treatment_history'
  ];

  // Helper function to determine consent status for a patient
  const getConsentStatus = (patientAddress: string) => {
    if (!allConsentsData || !patientAddress) {
      return { status: 'none', dataTypesCount: 0 };
    }

    // Handle both direct array and object with data property
    const consentsArray = Array.isArray(allConsentsData) 
      ? allConsentsData 
      : (allConsentsData as any)?.data || [];

    if (!Array.isArray(consentsArray) || consentsArray.length === 0) {
      return { status: 'none', dataTypesCount: 0 };
    }

    const normalizedPatientAddress = patientAddress.toLowerCase();
    
    // Filter consents for this patient that are active and not expired
    const patientConsents = consentsArray.filter((consent: any) => {
      const consentPatientAddress = consent.patientAddress?.toLowerCase();
      const matchesPatient = consentPatientAddress === normalizedPatientAddress;
      const isActive = consent.isActive !== false; // Default to true if not specified
      const notExpired = !consent.isExpired; // Should be false or undefined for active consents
      
      return matchesPatient && isActive && notExpired;
    });

    if (patientConsents.length === 0) {
      return { status: 'none', dataTypesCount: 0 };
    }

    // Collect all unique data types from consents
    const consentedDataTypes = new Set<string>();
    patientConsents.forEach((consent: any) => {
      if (consent.dataTypes && Array.isArray(consent.dataTypes)) {
        consent.dataTypes.forEach((dt: string) => consentedDataTypes.add(dt));
      } else if (consent.dataType) {
        consentedDataTypes.add(consent.dataType);
      }
    });

    const dataTypesCount = consentedDataTypes.size;
    const totalDataTypes = ALL_DATA_TYPES.length;

    if (dataTypesCount === 0) {
      return { status: 'none', dataTypesCount: 0 };
    } else if (dataTypesCount === totalDataTypes) {
      return { status: 'full', dataTypesCount };
    } else {
      return { status: 'partial', dataTypesCount };
    }
  };

  // Filter and sort patients - use state to avoid useMemo dependency issues
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  
  useEffect(() => {
    if (!Array.isArray(stablePatients) || stablePatients.length === 0) {
      setFilteredPatients([]);
      return;
    }
    
    // Filter by search query across all columns
    let filtered = stablePatients;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = stablePatients.filter(patient => {
        const firstName = patient.demographics?.firstName || '';
        const lastName = patient.demographics?.lastName || '';
        const name = `${firstName} ${lastName}`.toLowerCase();
        const patientId = (patient.patientId || '').toLowerCase();
        const walletAddress = (patient.blockchainIntegration?.walletAddress || '').toLowerCase();
        const dob = String(patient.demographics?.dateOfBirth || '');
        const age = String(patient.demographics?.age || '');
        const gender = (patient.demographics?.gender || '').toLowerCase();
        const phone = String((patient.demographics as any)?.contact?.phone || '');
        const email = String((patient.demographics as any)?.contact?.email || '').toLowerCase();
        const address = (patient.demographics as any)?.address 
          ? `${(patient.demographics as any).address.street} ${(patient.demographics as any).address.city} ${(patient.demographics as any).address.state} ${(patient.demographics as any).address.zipCode}`.toLowerCase()
          : '';
        
        // Enhanced date search with multiple format support
        const dateMatches = dob ? matchesDate(searchQuery, dob) : false;
        
        return name.includes(query) || 
               patientId.includes(query) || 
               walletAddress.includes(query) ||
               dateMatches ||
               age.includes(query) ||
               gender.includes(query) ||
               phone.includes(query) ||
               email.includes(query) ||
               address.includes(query);
      });
    }
    
    // Sort filtered results
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';
        
        switch (sortColumn) {
          case 'name':
            aValue = `${a.demographics?.firstName || ''} ${a.demographics?.lastName || ''}`.toLowerCase();
            bValue = `${b.demographics?.firstName || ''} ${b.demographics?.lastName || ''}`.toLowerCase();
            break;
          case 'patientId':
            aValue = a.patientId?.toLowerCase() || '';
            bValue = b.patientId?.toLowerCase() || '';
            break;
          case 'walletAddress':
            aValue = a.blockchainIntegration?.walletAddress?.toLowerCase() || '';
            bValue = b.blockchainIntegration?.walletAddress?.toLowerCase() || '';
            break;
          case 'dob':
            aValue = a.demographics?.dateOfBirth || '';
            bValue = b.demographics?.dateOfBirth || '';
            break;
          case 'age':
            aValue = a.demographics?.age || 0;
            bValue = b.demographics?.age || 0;
            break;
          case 'gender':
            aValue = a.demographics?.gender?.toLowerCase() || '';
            bValue = b.demographics?.gender?.toLowerCase() || '';
            break;
          case 'phone':
            aValue = (a.demographics as any)?.contact?.phone || '';
            bValue = (b.demographics as any)?.contact?.phone || '';
            break;
          case 'email':
            aValue = ((a.demographics as any)?.contact?.email || '').toLowerCase();
            bValue = ((b.demographics as any)?.contact?.email || '').toLowerCase();
            break;
          case 'address':
            aValue = (a.demographics as any)?.address 
              ? `${(a.demographics as any).address.city} ${(a.demographics as any).address.state}`.toLowerCase()
              : '';
            bValue = (b.demographics as any)?.address 
              ? `${(b.demographics as any).address.city} ${(b.demographics as any).address.state}`.toLowerCase()
              : '';
            break;
          case 'consent':
            const aConsent = getConsentStatus(a.blockchainIntegration?.walletAddress || '');
            const bConsent = getConsentStatus(b.blockchainIntegration?.walletAddress || '');
            aValue = aConsent.status;
            bValue = bConsent.status;
            break;
        }
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    setFilteredPatients(filtered);
  }, [stablePatients, searchQuery, sortColumn, sortDirection]);

  // Simple pagination - direct calculation, no memoization
  const paginatedPatients = filteredPatients.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(filteredPatients.length / limit);
  
  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, start with ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(1); // Reset to first page when sorting
  };
  
  // Get sort icon for column header
  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };


  const handlePatientClick = (patientId: string) => {
    const patient = stablePatients.find((p) => p.patientId === patientId);
    setSelectedPatient(patient || null);
  };

  const handleCloseDetails = () => {
    setSelectedPatient(null);
  };

  const handleCloseGrantedDetails = () => {
    setSelectedGrantedPatient(null);
  };

  const handleOpenMedicalChart = (patientId: string) => {
    // Find patient from stablePatients (all patients list)
    const patient = stablePatients.find((p) => p.patientId === patientId);
    if (patient) {
      setSelectedPatient(patient);
      // Close the granted consent details card
      setSelectedGrantedPatient(null);
      setSelectedPendingPatient(null);
    }
  };

  const handleClosePendingDetails = () => {
    setSelectedPendingPatient(null);
  };

  const handleGrantedPatientClick = (patientId: string) => {
    const patientsData = stableGrantedPatients as { data: any[]; pagination: any } | undefined;
    const patient = patientsData?.data?.find((p: any) => p.patientId === patientId);
    setSelectedGrantedPatient(patient || null);
  };

  const handlePendingRequestClick = (request: any) => {
    // Find patient by address from all patients list
    const patientAddress = request.patientAddress?.toLowerCase();
    if (!patientAddress) return;
    
    const patient = stablePatients.find((p: any) => 
      p.blockchainIntegration?.walletAddress?.toLowerCase() === patientAddress
    );
    
    if (patient) {
      setSelectedPendingPatient({
        patientId: patient.patientId,
        patientWalletAddress: patient.blockchainIntegration?.walletAddress
      });
    } else if (request.patient?.patientId) {
      // Fallback: use patient info from request if available
      setSelectedPendingPatient({
        patientId: request.patient.patientId,
        patientWalletAddress: request.patientAddress
      });
    }
  };

  const handleCloseRequestCard = () => {
    setSelectedRequest(null);
  };

  // Export and Print Functions
  const exportPatientsToCSV = () => {
    const rows: any[][] = [['Name', 'Patient ID', 'Wallet Address', 'DOB', 'Age', 'Sex', 'Phone', 'Email', 'Address', 'Consent Status']];
    filteredPatients.forEach((patient) => {
      const hasWallet = !!patient.blockchainIntegration?.walletAddress;
      const patientAddress = patient.blockchainIntegration?.walletAddress || '';
      const consentInfo = getConsentStatus(patientAddress);
      const dob = patient.demographics?.dateOfBirth 
        ? format(new Date(String(patient.demographics.dateOfBirth)), 'MMM d, yyyy')
        : 'N/A';
      const address = (patient.demographics as any)?.address 
        ? `${(patient.demographics as any).address.street}, ${(patient.demographics as any).address.city}, ${(patient.demographics as any).address.state} ${(patient.demographics as any).address.zipCode}`
        : 'N/A';
      rows.push([
        `${patient.demographics?.firstName || ''} ${patient.demographics?.lastName || ''}`.trim(),
        patient.patientId || '',
        hasWallet ? patient.blockchainIntegration?.walletAddress || '' : 'No wallet',
        dob,
        String(patient.demographics?.age ?? 'N/A'),
        patient.demographics?.gender || 'N/A',
        (patient.demographics as any)?.contact?.phone || 'N/A',
        (patient.demographics as any)?.contact?.email || 'N/A',
        address,
        consentInfo.status
      ]);
    });
    const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `patients_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printPatients = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Patients - ${format(new Date(), 'MMMM d, yyyy')}</title>
        <style>
          @media print { @page { margin: 1cm; } body { margin: 0; } }
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>All Patients</h1>
        <p><strong>Export Date:</strong> ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Patient ID</th>
              <th>Wallet Address</th>
              <th>DOB</th>
              <th>Age</th>
              <th>Sex</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Address</th>
              <th>Consent Status</th>
            </tr>
          </thead>
          <tbody>
    `;
    filteredPatients.forEach((patient) => {
      const hasWallet = !!patient.blockchainIntegration?.walletAddress;
      const patientAddress = patient.blockchainIntegration?.walletAddress || '';
      const consentInfo = getConsentStatus(patientAddress);
      const dob = patient.demographics?.dateOfBirth 
        ? format(new Date(String(patient.demographics.dateOfBirth)), 'MMM d, yyyy')
        : 'N/A';
      const address = (patient.demographics as any)?.address 
        ? `${(patient.demographics as any).address.street}, ${(patient.demographics as any).address.city}, ${(patient.demographics as any).address.state} ${(patient.demographics as any).address.zipCode}`
        : 'N/A';
      htmlContent += `
        <tr>
          <td>${patient.demographics?.firstName || ''} ${patient.demographics?.lastName || ''}</td>
          <td>${patient.patientId || ''}</td>
          <td>${hasWallet ? patient.blockchainIntegration?.walletAddress || '' : 'No wallet'}</td>
          <td>${dob}</td>
          <td>${patient.demographics?.age ?? 'N/A'}</td>
          <td>${patient.demographics?.gender || 'N/A'}</td>
          <td>${(patient.demographics as any)?.contact?.phone || 'N/A'}</td>
          <td>${(patient.demographics as any)?.contact?.email || 'N/A'}</td>
          <td>${address}</td>
          <td>${consentInfo.status}</td>
        </tr>
      `;
    });
    htmlContent += `</tbody></table></body></html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const exportPendingToCSV = () => {
    const requestsData = stablePendingRequests as { data: any[]; pagination: any } | undefined;
    if (!requestsData?.data) return;
    const rows: any[][] = [['Patient Name', 'Patient ID', 'Patient Wallet Address', 'Data Types', 'Purposes', 'Request Date', 'Expiration', 'Status']];
    requestsData.data.forEach((request: any) => {
      const patientName = request.patient ? `${request.patient.firstName} ${request.patient.lastName}` : 'Unknown';
      rows.push([
        patientName,
        request.patient?.patientId || '',
        request.patientAddress || 'N/A',
        (request.dataTypes || []).join('; '),
        (request.purposes || []).join('; '),
        format(new Date(request.timestamp), 'yyyy-MM-dd HH:mm'),
        request.expirationTime ? format(new Date(request.expirationTime), 'yyyy-MM-dd HH:mm') : 'No expiration',
        'Pending'
      ]);
    });
    const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pending_requests_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printPending = () => {
    const requestsData = stablePendingRequests as { data: any[]; pagination: any } | undefined;
    if (!requestsData?.data) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pending Requests - ${format(new Date(), 'MMMM d, yyyy')}</title>
        <style>
          @media print { @page { margin: 1cm; } body { margin: 0; } }
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Pending Requests</h1>
        <p><strong>Export Date:</strong> ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
        <table>
          <thead>
            <tr>
              <th>Patient Name</th>
              <th>Patient ID</th>
              <th>Patient Wallet Address</th>
              <th>Data Types</th>
              <th>Purposes</th>
              <th>Request Date</th>
              <th>Expiration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;
    requestsData.data.forEach((request: any) => {
      const patientName = request.patient ? `${request.patient.firstName} ${request.patient.lastName}` : 'Unknown';
      htmlContent += `
        <tr>
          <td>${patientName}</td>
          <td>${request.patient?.patientId || ''}</td>
          <td>${request.patientAddress || 'N/A'}</td>
          <td>${(request.dataTypes || []).join(', ')}</td>
          <td>${(request.purposes || []).join(', ')}</td>
          <td>${format(new Date(request.timestamp), 'MMM d, yyyy HH:mm')}</td>
          <td>${request.expirationTime ? format(new Date(request.expirationTime), 'MMM d, yyyy HH:mm') : 'No expiration'}</td>
          <td>Pending</td>
        </tr>
      `;
    });
    htmlContent += `</tbody></table></body></html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const exportGrantedToCSV = () => {
    const patientsData = stableGrantedPatients as { data: any[]; pagination: any } | undefined;
    if (!patientsData?.data) return;
    const rows: any[][] = [['Patient Name', 'Patient ID', 'Patient Wallet Address', 'Data Types', 'Purposes', 'Granted Date', 'Expiration', 'Status']];
    patientsData.data.forEach((patient: any) => {
      const allDataTypes = new Set<string>();
      const allPurposes = new Set<string>();
      patient.consents?.forEach((c: any) => {
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
      const sortedConsents = patient.consents ? [...patient.consents].sort((a: any, b: any) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      }) : [];
      const latestConsent = sortedConsents[0];
      const patientName = patient.demographics ? `${patient.demographics.firstName} ${patient.demographics.lastName}` : 'Unknown';
      rows.push([
        patientName,
        patient.patientId || '',
        patient.blockchainIntegration?.walletAddress || 'N/A',
        Array.from(allDataTypes).join('; '),
        Array.from(allPurposes).join('; '),
        latestConsent?.timestamp ? format(new Date(latestConsent.timestamp), 'yyyy-MM-dd HH:mm') : 'N/A',
        latestConsent?.expirationTime ? format(new Date(latestConsent.expirationTime), 'yyyy-MM-dd HH:mm') : 'No expiration',
        latestConsent?.isExpired ? 'Expired' : 'Active'
      ]);
    });
    const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `granted_consents_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printGranted = () => {
    const patientsData = stableGrantedPatients as { data: any[]; pagination: any } | undefined;
    if (!patientsData?.data) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Granted Consents - ${format(new Date(), 'MMMM d, yyyy')}</title>
        <style>
          @media print { @page { margin: 1cm; } body { margin: 0; } }
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Granted Consents</h1>
        <p><strong>Export Date:</strong> ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
        <table>
          <thead>
            <tr>
              <th>Patient Name</th>
              <th>Patient ID</th>
              <th>Patient Wallet Address</th>
              <th>Data Types</th>
              <th>Purposes</th>
              <th>Granted Date</th>
              <th>Expiration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;
    patientsData.data.forEach((patient: any) => {
      const allDataTypes = new Set<string>();
      const allPurposes = new Set<string>();
      patient.consents?.forEach((c: any) => {
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
      const sortedConsents = patient.consents ? [...patient.consents].sort((a: any, b: any) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      }) : [];
      const latestConsent = sortedConsents[0];
      const patientName = patient.demographics ? `${patient.demographics.firstName} ${patient.demographics.lastName}` : 'Unknown';
      htmlContent += `
        <tr>
          <td>${patientName}</td>
          <td>${patient.patientId || ''}</td>
          <td>${patient.blockchainIntegration?.walletAddress || 'N/A'}</td>
          <td>${Array.from(allDataTypes).join(', ')}</td>
          <td>${Array.from(allPurposes).join(', ')}</td>
          <td>${latestConsent?.timestamp ? format(new Date(latestConsent.timestamp), 'MMM d, yyyy HH:mm') : 'N/A'}</td>
          <td>${latestConsent?.expirationTime ? format(new Date(latestConsent.expirationTime), 'MMM d, yyyy HH:mm') : 'No expiration'}</td>
          <td>${latestConsent?.isExpired ? 'Expired' : 'Active'}</td>
        </tr>
      `;
    });
    htmlContent += `</tbody></table></body></html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const exportHistoryToCSV = () => {
    if (!historyData || historyData.length === 0) return;
    const rows: any[][] = [['Event Type', 'Patient Name', 'Patient ID', 'Patient Wallet Address', 'Data Types', 'Purposes', 'Timestamp', 'Expiration', 'Status']];
    historyData.forEach((event: any) => {
      const patientName = event.patientInfo ? `${event.patientInfo.firstName} ${event.patientInfo.lastName}` : 'Unknown';
      rows.push([
        event.type || 'Unknown',
        patientName,
        event.patientInfo?.patientId || '',
        event.patient || 'N/A',
        (event.dataTypes || []).join('; '),
        (event.purposes || []).join('; '),
        format(new Date(event.timestamp), 'yyyy-MM-dd HH:mm'),
        event.expirationTime ? format(new Date(event.expirationTime), 'yyyy-MM-dd HH:mm') : 'N/A',
        event.isExpired ? 'Expired' : 'Active'
      ]);
    });
    const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `consent_history_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printHistory = () => {
    if (!historyData || historyData.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Consent History - ${format(new Date(), 'MMMM d, yyyy')}</title>
        <style>
          @media print { @page { margin: 1cm; } body { margin: 0; } }
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Consent History</h1>
        <p><strong>Export Date:</strong> ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
        <table>
          <thead>
            <tr>
              <th>Event Type</th>
              <th>Patient Name</th>
              <th>Patient ID</th>
              <th>Patient Wallet Address</th>
              <th>Data Types</th>
              <th>Purposes</th>
              <th>Timestamp</th>
              <th>Expiration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;
    historyData.forEach((event: any) => {
      const patientName = event.patientInfo ? `${event.patientInfo.firstName} ${event.patientInfo.lastName}` : 'Unknown';
      htmlContent += `
        <tr>
          <td>${event.type || 'Unknown'}</td>
          <td>${patientName}</td>
          <td>${event.patientInfo?.patientId || ''}</td>
          <td>${event.patient || 'N/A'}</td>
          <td>${(event.dataTypes || []).join(', ')}</td>
          <td>${(event.purposes || []).join(', ')}</td>
          <td>${format(new Date(event.timestamp), 'MMM d, yyyy HH:mm')}</td>
          <td>${event.expirationTime ? format(new Date(event.expirationTime), 'MMM d, yyyy HH:mm') : 'N/A'}</td>
          <td>${event.isExpired ? 'Expired' : 'Active'}</td>
        </tr>
      `;
    });
    htmlContent += `</tbody></table></body></html>`;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  // Track if we've already redirected to prevent infinite loops
  const hasRedirected = useRef(false);
  const lastRoleType = useRef<string | undefined>(undefined);
  const lastAccount = useRef<string | null>(null);
  
  // Use role directly - no memoization needed
  const roleType = role?.role;

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
        <h1 className="text-3xl font-bold tracking-tight">{providerName}</h1>
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={exportPatientsToCSV}
                          className="h-8 w-8 p-0"
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
                          onClick={printPatients}
                          className="h-8 w-8 p-0"
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
                      <TableRow className="border-b-2 border-border hover:bg-transparent">
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center">
                            Name
                            {getSortIcon('name')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                          onClick={() => handleSort('patientId')}
                        >
                          <div className="flex items-center">
                            Patient ID
                            {getSortIcon('patientId')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                          onClick={() => handleSort('walletAddress')}
                        >
                          <div className="flex items-center">
                            Wallet Address
                            {getSortIcon('walletAddress')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                          onClick={() => handleSort('dob')}
                        >
                          <div className="flex items-center">
                            DOB
                            {getSortIcon('dob')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                          onClick={() => handleSort('age')}
                        >
                          <div className="flex items-center">
                            Age
                            {getSortIcon('age')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                          onClick={() => handleSort('gender')}
                        >
                          <div className="flex items-center">
                            Sex
                            {getSortIcon('gender')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                          onClick={() => handleSort('phone')}
                        >
                          <div className="flex items-center">
                            Phone
                            {getSortIcon('phone')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                          onClick={() => handleSort('email')}
                        >
                          <div className="flex items-center">
                            Email
                            {getSortIcon('email')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold border-r border-border/50"
                          onClick={() => handleSort('address')}
                        >
                          <div className="flex items-center">
                            Address
                            {getSortIcon('address')}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/70 select-none bg-muted/40 font-semibold"
                          onClick={() => handleSort('consent')}
                        >
                          <div className="flex items-center">
                            Consent
                            {getSortIcon('consent')}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedPatients.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                            {searchQuery ? 'No patients found matching your search' : 'No patients available'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedPatients.map((patient) => {
                          const hasWallet = !!patient.blockchainIntegration?.walletAddress;
                          const patientAddress = patient.blockchainIntegration?.walletAddress || '';
                          const consentInfo = getConsentStatus(patientAddress);
                          
                          // Determine badge styling based on consent status
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
                                paginatedPatients.indexOf(patient) % 2 === 0
                                  ? 'bg-background hover:bg-muted/60'
                                  : 'bg-muted/20 hover:bg-muted/80'
                              }`}
                              onClick={() => hasWallet && handlePatientClick(patient.patientId)}
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={exportPendingToCSV}
                          className="h-8 w-8 p-0"
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
                          onClick={printPending}
                          className="h-8 w-8 p-0"
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
                if (pendingRequestsLoading) {
                  return (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  );
                }

                // Handle case when query is disabled (tab not active) - data will be undefined
                if (!stablePendingRequests) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No pending requests</p>
                    </div>
                  );
                }

                const requestsData = stablePendingRequests as { data: any[]; pagination: any } | undefined;
                if (requestsData?.data && Array.isArray(requestsData.data) && requestsData.data.length > 0) {
                  // Filter requests by search query
                  const filteredRequests = requestsData.data.filter((request: any) => {
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
                                onClick={() => handlePendingRequestClick(request)}
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={exportGrantedToCSV}
                          className="h-8 w-8 p-0"
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
                          onClick={printGranted}
                          className="h-8 w-8 p-0"
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
                if (grantedPatientsLoading) {
                  return (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  );
                }

                // Handle case when query is disabled (tab not active) - data will be undefined
                if (!stableGrantedPatients) {
                  return (
                    <div className="text-center text-muted-foreground py-8">
                      No patients with granted consent
                    </div>
                  );
                }
                
                const patientsData = stableGrantedPatients as { data: any[]; pagination: any } | undefined;
                if (patientsData?.data && Array.isArray(patientsData.data) && patientsData.data.length > 0) {
                  // Filter patients by search query
                  const filteredPatients = patientsData.data.filter((patient: any) => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    const name = `${patient.demographics?.firstName || ''} ${patient.demographics?.lastName || ''}`.toLowerCase();
                    const patientId = (patient.patientId || '').toLowerCase();
                    const walletAddress = (patient.blockchainIntegration?.walletAddress || '').toLowerCase();
                    const dob = String(patient.demographics?.dateOfBirth || '');
                    
                    // Enhanced date search with multiple format support
                    const dateMatches = dob ? matchesDate(searchQuery, dob) : false;
                    
                    // Get all data types and purposes from consents
                    const allDataTypes = new Set<string>();
                    const allPurposes = new Set<string>();
                    patient.consents?.forEach((c: any) => {
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
                            <TableHead>Patient</TableHead>
                            <TableHead>Data Types</TableHead>
                            <TableHead>Purposes</TableHead>
                            <TableHead>Granted Date</TableHead>
                            <TableHead>Expiration</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedFiltered.map((patient: any) => {
                            // Get all unique data types from consents
                            const allDataTypes = new Set<string>();
                            const allPurposes = new Set<string>();
                            
                            // Sort consents by timestamp (most recent first) and get the latest
                            const sortedConsents = patient.consents
                              ? [...patient.consents].sort((a: any, b: any) => {
                                  const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                                  const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                                  return timeB - timeA; // Descending order (newest first)
                                })
                              : [];
                            const latestConsent = sortedConsents[0];
                            
                            patient.consents?.forEach((c: any) => {
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
                            
                            const patientName = patient.demographics
                              ? `${patient.demographics.firstName} ${patient.demographics.lastName}`
                              : `${patient.blockchainIntegration?.walletAddress?.slice(0, 6) || ''}...${patient.blockchainIntegration?.walletAddress?.slice(-4) || ''}`;
                            
                            const walletAddress = patient.blockchainIntegration?.walletAddress || '';
                            
                            return (
                              <TableRow 
                                key={patient.patientId}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => handleGrantedPatientClick(patient.patientId)}
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
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={exportHistoryToCSV}
                          className="h-8 w-8 p-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Export consent history to CSV</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={printHistory}
                          className="h-8 w-8 p-0"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Print consent history</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by any column value..."
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
                      const patientAddress = (event.patient || '').toLowerCase();
                      const dataTypes = (event.dataTypes || []).map((dt: string) => dt.toLowerCase()).join(' ') || 
                                       (event.dataType ? event.dataType.toLowerCase() : '');
                      const purposes = (event.purposes || []).map((p: string) => p.toLowerCase()).join(' ') || 
                                      (event.purpose ? event.purpose.toLowerCase() : '');
                      return patientName.includes(query) || 
                             patientId.includes(query) || 
                             patientAddress.includes(query) ||
                             dataTypes.includes(query) ||
                             purposes.includes(query);
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
                                {/* Column 1: Patient Info - Always render */}
                                <div>
                                  {event.patientInfo ? (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Patient</p>
                                      <p className="text-[11px] font-semibold truncate leading-tight">
                                        {event.patientInfo.firstName} {event.patientInfo.lastName}
                                      </p>
                                      {event.patientInfo.patientId && (
                                        <p className="text-[9px] text-muted-foreground font-mono truncate leading-tight">
                                          {event.patientInfo.patientId}
                                        </p>
                                      )}
                                    </>
                                  ) : event.patient ? (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Patient</p>
                                      <p className="text-[11px] font-mono truncate leading-tight">{event.patient.slice(0, 8)}...{event.patient.slice(-6)}</p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Patient</p>
                                      <p className="text-[11px] text-muted-foreground leading-tight">—</p>
                                    </>
                                  )}
                                </div>

                                {/* Column 2: Access - Always render */}
                                <div>
                                  {event.dataTypes && event.dataTypes.length > 0 && event.purposes && event.purposes.length > 0 ? (
                                    <>
                                      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Access</p>
                                      <div className="flex flex-wrap gap-0.5 -mt-0.5">
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
          patientWalletAddress={selectedGrantedPatient.blockchainIntegration?.walletAddress}
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
