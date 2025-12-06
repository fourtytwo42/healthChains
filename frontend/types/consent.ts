/**
 * Type definitions for consent-related data structures
 */

export interface ConsentHistoryEvent {
  type: 'ConsentGranted' | 'ConsentRevoked' | 'ConsentExpired' | 'ConsentBatchGranted' | 'AccessRequested' | 'AccessApproved' | 'AccessDenied';
  blockNumber?: number;
  transactionHash?: string;
  consentId?: number;
  requestId?: number;
  patient?: string;
  provider?: string;
  requester?: string;
  dataType?: string;
  dataTypes?: string[];
  purpose?: string;
  purposes?: string[];
  expirationTime?: string | null;
  timestamp: string;
  providerInfo?: ProviderInfo | null;
  patientInfo?: PatientInfo | null;
  isExpired?: boolean;
}

export interface ProviderInfo {
  organizationName?: string;
  providerType?: string;
  specialties?: string[];
  contact?: {
    email?: string;
    website?: string;
    phone?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

export interface PatientInfo {
  patientId?: string;
  firstName?: string;
  lastName?: string;
  age?: number | string;
  gender?: string;
  dateOfBirth?: string | null;
  contact?: {
    phone?: string;
    email?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

export interface ConsentRecord {
  consentId: number;
  patientAddress: string;
  providerAddress: string;
  timestamp: string;
  expirationTime: string | null;
  isActive: boolean;
  dataType?: string;
  purpose?: string;
  dataTypes?: string[];
  purposes?: string[];
  isBatch?: boolean;
  isExpired: boolean;
  allConsents?: Array<{
    consentId: number;
    dataType: string;
    purpose: string;
    expirationTime: string | null;
    isActive: boolean;
    isExpired: boolean;
    timestamp: string;
  }>;
}

export interface AccessRequest {
  requestId: number;
  patientAddress: string;
  requester: string;
  dataTypes: string[];
  purposes: string[];
  timestamp: string;
  expirationTime?: string | null;
  status: 'pending' | 'approved' | 'denied';
  patient?: PatientInfo;
}

export interface ProviderPatient {
  patientId: string;
  patientWalletAddress?: string;
  consents?: ConsentRecord[];
  [key: string]: unknown; // For additional properties
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationData;
}

