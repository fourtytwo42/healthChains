/**
 * Type definitions for patient-related data structures
 */

export interface Demographics {
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
  [key: string]: unknown;
}

export interface ConsentInfo {
  dataType?: string;
  dataTypes?: string[];
  purpose?: string;
  purposes?: string[];
  expirationTime?: string | null;
  consentId: number;
  timestamp?: string;
  isActive?: boolean;
  isExpired?: boolean;
}

export interface VitalSign {
  timestamp: string;
  bloodPressure?: {
    systolic?: number | string;
    diastolic?: number | string;
  };
  heartRate?: number | string;
  temperature?: string | number;
  oxygenSaturation?: number | string;
}

export interface Medication {
  name?: string;
  dosage?: string;
  frequency?: string;
  prescriber?: string;
  [key: string]: unknown;
}

export interface MedicalCondition {
  name?: string;
  code?: string;
  category?: string;
  status?: string;
  diagnosisDate?: string;
  [key: string]: unknown;
}

export interface Allergy {
  allergen?: string;
  severity?: string;
  [key: string]: unknown;
}

export interface LaboratoryResult {
  testName?: string;
  resultDate?: string;
  status?: string;
  results?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ImagingStudy {
  studyType?: string;
  studyDate?: string;
  performedDate?: string;
  findings?: string;
  radiologist?: string;
  modality?: string;
  [key: string]: unknown;
}

export interface GeneticVariant {
  gene?: string;
  variant?: string;
  classification?: string;
  significance?: string;
  [key: string]: unknown;
}

export interface GeneticData {
  geneticMarkers?: Record<string, unknown>;
  variants?: GeneticVariant[];
  pharmacogenomics?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DiagnosticData {
  laboratoryResults?: LaboratoryResult[];
  imagingStudies?: ImagingStudy[];
  [key: string]: unknown;
}

export interface MedicalRecords {
  conditions?: MedicalCondition[];
  allergies?: Allergy[];
  [key: string]: unknown;
}

export interface TreatmentHistory {
  conditions?: MedicalCondition[];
  [key: string]: unknown;
}

export interface ConsentedData {
  vital_signs?: VitalSign[];
  current_medications?: Medication[];
  medical_records?: MedicalRecords;
  treatment_history?: TreatmentHistory;
  laboratory_results?: LaboratoryResult[];
  imaging_studies?: ImagingStudy[];
  imaging_data?: ImagingStudy[];
  diagnostic_data?: DiagnosticData;
  genetic_data?: GeneticData;
  [key: string]: unknown;
}

export interface ProviderPatientData {
  patientId: string;
  demographics?: Demographics;
  consentedData?: ConsentedData;
  consentInfo?: ConsentInfo[];
  blockchainIntegration?: {
    walletAddress?: string;
  };
  [key: string]: unknown;
}

export interface VitalSignsChartDataPoint {
  date: string;
  timestamp: string;
  systolic: number | null;
  diastolic: number | null;
  heartRate: number | null;
  temperature: number | null;
  oxygenSaturation: number | null;
}

