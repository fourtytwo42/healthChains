'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-context';
import { useAuth } from '@/contexts/auth-context';
import { useRole } from '@/hooks/use-role';
import { 
  usePatients, 
  useProviderPatients, 
  useProviderConsentsPaginated, 
  useProviderConsentHistory, 
  useProviderPendingRequests, 
  useProviders 
} from '@/hooks/use-api';
import { useDebounce } from '@/hooks/use-debounce';
import { matchesDate } from '@/lib/date-utils';
import { format } from 'date-fns';
import type { Patient, ConsentRecord } from '@/lib/api-client';
import type { ConsentHistoryEvent, AccessRequest, ProviderPatient, PaginatedResponse } from '@/types/consent';

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

export function useProviderDashboard() {
  const router = useRouter();
  const { account } = useWallet();
  const { role, isLoading: roleLoading } = useRole(account);
  const { isAuthenticated } = useAuth();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedGrantedPatient, setSelectedGrantedPatient] = useState<ProviderPatient | null>(null);
  const [selectedPendingPatient, setSelectedPendingPatient] = useState<{ patientId: string; patientWalletAddress?: string } | null>(null);
  const [selectedHistoryEvent, setSelectedHistoryEvent] = useState<ConsentHistoryEvent | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'granted' | 'history'>('all');
  const [page, setPage] = useState(1);
  const limit = 10;
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [stablePatients, setStablePatients] = useState<Patient[]>([]);
  const patientsIdsRef = useRef<string>('');

  // Data fetching
  const { data: allPatientsData, isLoading: allPatientsLoading } = usePatients({
    enabled: !!account && isAuthenticated,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: providersData } = useProviders();
  const currentProvider = providersData?.find((p) => 
    p.blockchainIntegration?.walletAddress?.toLowerCase() === account?.toLowerCase()
  );
  const providerName = currentProvider?.organizationName || 'Provider Dashboard';

  const { data: pendingRequestsData, isLoading: pendingRequestsLoading } = useProviderPendingRequests(
    account || '',
    page,
    limit,
    activeTab === 'pending' && !!account && isAuthenticated
  );

  const { data: grantedPatientsData, isLoading: grantedPatientsLoading } = useProviderPatients(
    account || '',
    page,
    limit,
    activeTab === 'granted' && !!account && isAuthenticated
  );

  const { data: historyData, isLoading: historyLoading } = useProviderConsentHistory(
    account || '',
    activeTab === 'history' && !!account && isAuthenticated
  );

  const { data: allConsentsData } = useProviderConsentsPaginated(
    account || '',
    1,
    1000,
    false,
    !!account
  );

  // Use data directly - React Query already handles caching and stability
  const stablePendingRequests = pendingRequestsData;
  const stableGrantedPatients = grantedPatientsData;

  // Update stable patients when data changes
  useEffect(() => {
    if (Array.isArray(allPatientsData)) {
      const newIds = allPatientsData.map(p => p.patientId).sort().join(',');
      if (newIds !== patientsIdsRef.current) {
        patientsIdsRef.current = newIds;
        setStablePatients(allPatientsData);
      }
    }
  }, [allPatientsData]);

  // Helper function to determine consent status for a patient
  const getConsentStatus = (patientAddress: string) => {
    if (!allConsentsData || !patientAddress) {
      return { status: 'none', dataTypesCount: 0 };
    }

    const consentsArray = Array.isArray(allConsentsData) 
      ? allConsentsData 
      : (allConsentsData as any)?.data || [];

    if (!Array.isArray(consentsArray) || consentsArray.length === 0) {
      return { status: 'none', dataTypesCount: 0 };
    }

    const normalizedPatientAddress = patientAddress.toLowerCase();
    
    const patientConsents = consentsArray.filter((consent) => {
      const consentPatientAddress = consent.patientAddress?.toLowerCase();
      const matchesPatient = consentPatientAddress === normalizedPatientAddress;
      const isActive = consent.isActive !== false;
      const notExpired = !consent.isExpired;
      
      return matchesPatient && isActive && notExpired;
    });

    if (patientConsents.length === 0) {
      return { status: 'none', dataTypesCount: 0 };
    }

    const consentedDataTypes = new Set<string>();
    patientConsents.forEach((consent) => {
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

  // Filter and sort patients
  useEffect(() => {
    if (!Array.isArray(stablePatients) || stablePatients.length === 0) {
      setFilteredPatients([]);
      return;
    }
    
    let filtered = stablePatients;
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
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
        
        const dateMatches = dob ? matchesDate(debouncedSearchQuery, dob) : false;
        
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
    
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number = '';
        let bValue: string | number = '';
        
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
            aValue = (a.demographics?.dateOfBirth ? String(a.demographics.dateOfBirth) : '') || '';
            bValue = (b.demographics?.dateOfBirth ? String(b.demographics.dateOfBirth) : '') || '';
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
  }, [stablePatients, debouncedSearchQuery, sortColumn, sortDirection]);

  // Pagination
  const paginatedPatients = filteredPatients.slice((page - 1) * limit, page * limit);
  const totalPages = Math.ceil(filteredPatients.length / limit);

  // Handlers
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const handleTabChange = (v: string) => {
    setActiveTab(v as 'all' | 'pending' | 'granted' | 'history');
    setPage(1);
    setSearchQuery('');
    setSelectedPatient(null);
  };

  const handlePatientClick = (patientId: string) => {
    const patient = stablePatients.find((p) => p.patientId === patientId);
    setSelectedPatient(patient || null);
  };

  const handleGrantedPatientClick = (patientId: string) => {
    const patientsData = stableGrantedPatients as PaginatedResponse<ProviderPatient> | undefined;
    const patient = patientsData?.data?.find((p) => p.patientId === patientId);
    if (patient) {
      const patientWithWallet: ProviderPatient = {
        ...patient,
        patientWalletAddress: patient.patientWalletAddress || 
          (patient as any)?.blockchainIntegration?.walletAddress ||
          undefined
      };
      setSelectedGrantedPatient(patientWithWallet);
    } else {
      setSelectedGrantedPatient(null);
    }
  };

  const handlePendingRequestClick = (request: AccessRequest) => {
    const patientAddress = request.patientAddress?.toLowerCase();
    if (!patientAddress) return;
    
    const patient = stablePatients.find((p) => 
      p.blockchainIntegration?.walletAddress?.toLowerCase() === patientAddress
    );
    
    if (patient) {
      setSelectedPendingPatient({
        patientId: patient.patientId,
        patientWalletAddress: patient.blockchainIntegration?.walletAddress
      });
    } else if (request.patient?.patientId) {
      setSelectedPendingPatient({
        patientId: request.patient.patientId,
        patientWalletAddress: request.patientAddress
      });
    }
  };

  const handleOpenMedicalChart = (patientId: string) => {
    const patient = stablePatients.find((p) => p.patientId === patientId);
    if (patient) {
      setSelectedPatient(patient);
      setSelectedGrantedPatient(null);
      setSelectedPendingPatient(null);
    }
  };

  // Redirect logic
  const hasRedirected = useRef(false);
  const lastRoleType = useRef<string | undefined>(undefined);
  const lastAccount = useRef<string | null>(null);
  const roleType = role?.role;

  useEffect(() => {
    if (roleLoading || !account || hasRedirected.current) {
      return;
    }
    
    if (roleType === lastRoleType.current && account === lastAccount.current) {
      return;
    }
    
    lastRoleType.current = roleType;
    lastAccount.current = account;
    
    if (roleType === 'patient') {
      hasRedirected.current = true;
      router.replace('/patient');
    } else if (roleType === 'unknown') {
      hasRedirected.current = true;
      router.replace('/');
    }
  }, [account, roleType, roleLoading, router]);

  // Export and Print Functions
  const exportPatientsToCSV = () => {
    const rows: string[][] = [['Name', 'Patient ID', 'Wallet Address', 'DOB', 'Age', 'Sex', 'Phone', 'Email', 'Address', 'Consent Status']];
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
    const requestsData = stablePendingRequests as PaginatedResponse<AccessRequest> | undefined;
    if (!requestsData?.data) return;
    const rows: string[][] = [['Patient Name', 'Patient ID', 'Patient Wallet Address', 'Data Types', 'Purposes', 'Request Date', 'Expiration', 'Status']];
    requestsData.data.forEach((request) => {
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
    const requestsData = stablePendingRequests as PaginatedResponse<AccessRequest> | undefined;
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
    const rows: string[][] = [['Patient Name', 'Patient ID', 'Patient Wallet Address', 'Data Types', 'Purposes', 'Granted Date', 'Expiration', 'Status']];
    patientsData?.data.forEach((patient) => {
      const allDataTypes = new Set<string>();
      const allPurposes = new Set<string>();
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
    const rows: string[][] = [['Event Type', 'Patient Name', 'Patient ID', 'Patient Wallet Address', 'Data Types', 'Purposes', 'Timestamp', 'Expiration', 'Status']];
    historyData.forEach((event) => {
      const patientName = event.patientInfo ? `${event.patientInfo.firstName} ${event.patientInfo.lastName}` : 'Unknown';
      const evt = event as ConsentHistoryEvent;
      const dataTypes = Array.isArray(evt.dataTypes) ? evt.dataTypes : [];
      const purposes = Array.isArray(evt.purposes) ? evt.purposes : [];
      rows.push([
        event.type || 'Unknown',
        patientName,
        event.patientInfo?.patientId || '',
        event.patient || 'N/A',
        dataTypes.join('; '),
        purposes.join('; '),
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
    historyData.forEach((event) => {
      const patientName = event.patientInfo ? `${event.patientInfo.firstName} ${event.patientInfo.lastName}` : 'Unknown';
      const evt = event as ConsentHistoryEvent;
      const dataTypes = Array.isArray(evt.dataTypes) ? evt.dataTypes : [];
      const purposes = Array.isArray(evt.purposes) ? evt.purposes : [];
      htmlContent += `
        <tr>
          <td>${event.type || 'Unknown'}</td>
          <td>${patientName}</td>
          <td>${event.patientInfo?.patientId || ''}</td>
          <td>${event.patient || 'N/A'}</td>
          <td>${dataTypes.join(', ')}</td>
          <td>${purposes.join(', ')}</td>
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

  return {
    // State
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
    selectedRequest,
    setSelectedRequest,
    activeTab,
    handleTabChange,
    page,
    setPage,
    limit,
    sortColumn,
    sortDirection,
    handleSort,
    
    // Data
    allPatientsLoading,
    pendingRequestsLoading,
    grantedPatientsLoading,
    historyLoading,
    filteredPatients,
    paginatedPatients,
    totalPages,
    stablePatients,
    stablePendingRequests,
    stableGrantedPatients,
    historyData,
    
    // Helpers
    getConsentStatus,
    handlePatientClick,
    handleGrantedPatientClick,
    handlePendingRequestClick,
    handleOpenMedicalChart,
    
    // Export/Print functions
    exportPatientsToCSV,
    printPatients,
    exportPendingToCSV,
    printPending,
    exportGrantedToCSV,
    printGranted,
    exportHistoryToCSV,
    printHistory,
  };
}

