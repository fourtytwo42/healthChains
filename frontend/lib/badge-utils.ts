/**
 * Badge Utilities - Shared color mappings and descriptions for badges
 * Used across the entire application for consistent styling
 */

/**
 * Descriptions for medical specialties
 */
export const specialtyDescriptions: Record<string, string> = {
  'Cardiology': 'Medical specialty dealing with disorders of the heart and blood vessels',
  'Oncology': 'Medical specialty focused on the diagnosis and treatment of cancer',
  'Neurology': 'Medical specialty dealing with disorders of the nervous system',
  'Orthopedics': 'Medical specialty focused on the musculoskeletal system (bones, joints, muscles)',
  'Pediatrics': 'Medical specialty providing healthcare for infants, children, and adolescents',
  'Internal Medicine': 'Medical specialty focused on the prevention, diagnosis, and treatment of adult diseases',
  'Emergency Medicine': 'Medical specialty focused on the immediate assessment and treatment of acute illnesses and injuries',
  'Radiology': 'Medical specialty using medical imaging to diagnose and treat diseases',
  'Pathology': 'Medical specialty studying the causes and effects of diseases through examination of tissues and body fluids',
  'Psychiatry': 'Medical specialty focused on the diagnosis, treatment, and prevention of mental health disorders',
};

/**
 * Color mappings for specialties - vibrant medical colors
 */
export const specialtyColors: Record<string, { bg: string; text: string }> = {
  'Cardiology': { bg: 'bg-red-500', text: 'text-white' },
  'Oncology': { bg: 'bg-purple-500', text: 'text-white' },
  'Neurology': { bg: 'bg-indigo-500', text: 'text-white' },
  'Orthopedics': { bg: 'bg-blue-500', text: 'text-white' },
  'Pediatrics': { bg: 'bg-pink-500', text: 'text-white' },
  'Internal Medicine': { bg: 'bg-teal-500', text: 'text-white' },
  'Emergency Medicine': { bg: 'bg-orange-500', text: 'text-white' },
  'Radiology': { bg: 'bg-cyan-500', text: 'text-white' },
  'Pathology': { bg: 'bg-amber-500', text: 'text-white' },
  'Psychiatry': { bg: 'bg-emerald-500', text: 'text-white' },
};

/**
 * Get color for a specialty (with fallback)
 */
export const getSpecialtyColor = (specialty: string): { bg: string; text: string } => {
  return specialtyColors[specialty] || { bg: 'bg-slate-500', text: 'text-white' };
};

/**
 * Descriptions for data types
 */
export const dataTypeDescriptions: Record<string, string> = {
  'medical_records': 'Complete medical history including diagnoses, treatments, and clinical notes',
  'diagnostic_data': 'Results from diagnostic tests such as lab work, imaging studies, and pathology reports',
  'genetic_data': 'Genetic information including DNA sequences, genetic test results, and family history',
  'imaging_data': 'Medical images such as X-rays, CT scans, MRI scans, and ultrasounds',
  'laboratory_results': 'Lab test results including blood work, urine analysis, and other diagnostic tests',
  'prescription_history': 'Complete history of medications prescribed, including dosages and dates',
  'vital_signs': 'Measurements of basic body functions including blood pressure, heart rate, temperature, and weight',
  'treatment_history': 'Record of all medical treatments, procedures, surgeries, and therapies received',
};

/**
 * Color mappings for data types - blue/green spectrum
 */
export const dataTypeColors: Record<string, { bg: string; text: string }> = {
  'medical_records': { bg: 'bg-blue-600', text: 'text-white' },
  'diagnostic_data': { bg: 'bg-cyan-600', text: 'text-white' },
  'genetic_data': { bg: 'bg-violet-600', text: 'text-white' },
  'imaging_data': { bg: 'bg-sky-600', text: 'text-white' },
  'laboratory_results': { bg: 'bg-green-600', text: 'text-white' },
  'prescription_history': { bg: 'bg-emerald-600', text: 'text-white' },
  'vital_signs': { bg: 'bg-teal-600', text: 'text-white' },
  'treatment_history': { bg: 'bg-indigo-600', text: 'text-white' },
};

/**
 * Get color for a data type (with fallback)
 */
export const getDataTypeColor = (dataType: string): { bg: string; text: string } => {
  return dataTypeColors[dataType] || { bg: 'bg-slate-600', text: 'text-white' };
};

/**
 * Descriptions for purposes
 */
export const purposeDescriptions: Record<string, string> = {
  'treatment': 'Use of data to provide medical care, diagnose conditions, and develop treatment plans',
  'research': 'Use of data for medical research studies to advance healthcare knowledge and treatments',
  'analytics': 'Use of data for statistical analysis, population health studies, and healthcare quality improvement',
  'diagnosis': 'Use of data to identify and diagnose medical conditions and diseases',
  'preventive_care': 'Use of data for preventive health screenings, vaccinations, and wellness programs',
  'clinical_trial': 'Use of data for participation in clinical trials and experimental treatments',
  'public_health': 'Use of data for public health monitoring, disease surveillance, and health policy development',
};

/**
 * Color mappings for purposes - warm/orange spectrum
 */
export const purposeColors: Record<string, { bg: string; text: string }> = {
  'treatment': { bg: 'bg-rose-500', text: 'text-white' },
  'research': { bg: 'bg-amber-500', text: 'text-white' },
  'analytics': { bg: 'bg-yellow-500', text: 'text-gray-900' },
  'diagnosis': { bg: 'bg-orange-500', text: 'text-white' },
  'preventive_care': { bg: 'bg-lime-500', text: 'text-gray-900' },
  'clinical_trial': { bg: 'bg-fuchsia-500', text: 'text-white' },
  'public_health': { bg: 'bg-red-600', text: 'text-white' },
};

/**
 * Get color for a purpose (with fallback)
 */
export const getPurposeColor = (purpose: string): { bg: string; text: string } => {
  return purposeColors[purpose] || { bg: 'bg-slate-500', text: 'text-white' };
};

/**
 * Extract domain from URL (e.g., https://www.prov-000001.com -> prov-000001.com)
 */
export const extractDomain = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    // If it already looks like a domain (no protocol), return as is
    if (!url.includes('://')) {
      return url.replace(/^www\./, '');
    }
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
    return match ? match[1] : url;
  }
};

/**
 * Get full URL from domain (adds https:// if needed)
 */
export const getFullUrl = (domain: string | null | undefined): string | null => {
  if (!domain) return null;
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    return domain;
  }
  return `https://${domain}`;
};

