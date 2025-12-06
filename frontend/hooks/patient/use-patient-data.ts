'use client';

import { useState, useMemo } from 'react';
import { useProviderPatientData } from '@/hooks/use-api';
import { format } from 'date-fns';
import type {
  ProviderPatientData,
  Demographics,
  ConsentInfo,
  ConsentedData,
  VitalSignsChartDataPoint,
  VitalSign,
  Medication,
  MedicalCondition,
  Allergy,
  LaboratoryResult,
  ImagingStudy,
  GeneticData,
  DiagnosticData,
  MedicalRecords,
  TreatmentHistory,
} from '@/types/patient';

export function usePatientData(providerAddress: string, patientId: string) {
  const { data, isLoading, error } = useProviderPatientData(providerAddress, patientId);
  const [expandedSection, setExpandedSection] = useState<string | null>('vital_signs');
  const [vitalSignsPageIndex, setVitalSignsPageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Extract data directly with proper typing
  const patientData = data?.data as ProviderPatientData | undefined;
  const consentedData: ConsentedData = patientData?.consentedData || {};
  const consentInfo: ConsentInfo[] = patientData?.consentInfo || [];
  const demographics: Demographics = patientData?.demographics || {};
  const hasNoConsent = consentInfo.length === 0;

  // Helper functions
  const getConsentForDataType = (dataType: string): ConsentInfo[] => {
    return consentInfo.filter((c: ConsentInfo) => {
      if (c.dataTypes && Array.isArray(c.dataTypes)) {
        return c.dataTypes.includes(dataType);
      }
      return c.dataType === dataType;
    });
  };

  const hasConsentForDataType = (dataType: string): boolean => {
    return consentInfo.some((c: ConsentInfo) => {
      if (c.dataTypes && Array.isArray(c.dataTypes)) {
        return c.dataTypes.includes(dataType);
      }
      return c.dataType === dataType;
    });
  };

  // Memoize chart data
  const vitalSignsChartData = useMemo((): VitalSignsChartDataPoint[] => {
    if (!consentedData.vital_signs || !Array.isArray(consentedData.vital_signs)) {
      return [];
    }
    
    return consentedData.vital_signs
      .slice(-30)
      .map((vital: VitalSign) => ({
        date: format(new Date(vital.timestamp), 'MMM d'),
        timestamp: vital.timestamp,
        systolic: typeof vital.bloodPressure?.systolic === 'number' 
          ? vital.bloodPressure.systolic 
          : (typeof vital.bloodPressure?.systolic === 'string' 
            ? parseFloat(vital.bloodPressure.systolic) || null 
            : null),
        diastolic: typeof vital.bloodPressure?.diastolic === 'number'
          ? vital.bloodPressure.diastolic
          : (typeof vital.bloodPressure?.diastolic === 'string'
            ? parseFloat(vital.bloodPressure.diastolic) || null
            : null),
        heartRate: typeof vital.heartRate === 'number'
          ? vital.heartRate
          : (typeof vital.heartRate === 'string'
            ? parseFloat(vital.heartRate) || null
            : null),
        temperature: vital.temperature ? parseFloat(String(vital.temperature)) : null,
        oxygenSaturation: typeof vital.oxygenSaturation === 'number'
          ? vital.oxygenSaturation
          : (typeof vital.oxygenSaturation === 'string'
            ? parseFloat(vital.oxygenSaturation) || null
            : null),
      }))
      .reverse();
  }, [consentedData.vital_signs]);

  // Export and Print functions
  const exportToCSV = async () => {
    if (!patientData) return;
    setIsExporting(true);
    try {
      const rows: string[][] = [];
      
      rows.push(['Medical Chart Export']);
      rows.push(['Patient ID', patientData.patientId]);
      rows.push(['Name', `${demographics.firstName || ''} ${demographics.lastName || ''}`.trim()]);
      rows.push(['Date of Birth', demographics.dateOfBirth || 'N/A']);
      rows.push(['Age', String(demographics.age || 'N/A')]);
      rows.push(['Gender', demographics.gender || 'N/A']);
      rows.push(['Phone', demographics.contact?.phone || 'N/A']);
      rows.push(['Email', demographics.contact?.email || 'N/A']);
      rows.push(['Export Date', format(new Date(), 'yyyy-MM-dd HH:mm:ss')]);
      rows.push([]);
      
      // Vital Signs
      if (consentedData.vital_signs && Array.isArray(consentedData.vital_signs)) {
        rows.push(['VITAL SIGNS']);
        rows.push(['Date', 'Systolic BP', 'Diastolic BP', 'Heart Rate (bpm)', 'Temperature (°C)', 'O2 Saturation (%)']);
        (consentedData.vital_signs as VitalSign[]).forEach((vital: VitalSign) => {
          rows.push([
            format(new Date(vital.timestamp), 'yyyy-MM-dd HH:mm'),
            String(vital.bloodPressure?.systolic || ''),
            String(vital.bloodPressure?.diastolic || ''),
            String(vital.heartRate || ''),
            String(vital.temperature || ''),
            String(vital.oxygenSaturation || '')
          ]);
        });
        rows.push([]);
      }
      
      // Medications
      if (consentedData.current_medications && Array.isArray(consentedData.current_medications)) {
        rows.push(['CURRENT MEDICATIONS']);
        rows.push(['Name', 'Dosage', 'Frequency', 'Prescriber']);
        (consentedData.current_medications as Medication[]).forEach((med: Medication) => {
          rows.push([
            med.name || '',
            med.dosage || '',
            med.frequency || '',
            med.prescriber || ''
          ]);
        });
        rows.push([]);
      }
      
      // Conditions
      const medicalRecords = consentedData.medical_records as MedicalRecords | undefined;
      const treatmentHistory = consentedData.treatment_history as TreatmentHistory | undefined;
      const conditions: MedicalCondition[] = medicalRecords?.conditions || treatmentHistory?.conditions || [];
      if (conditions.length > 0) {
        rows.push(['MEDICAL CONDITIONS']);
        rows.push(['Name', 'Code', 'Category', 'Status', 'Diagnosis Date']);
        conditions.forEach((condition: MedicalCondition) => {
          rows.push([
            condition.name || '',
            condition.code || '',
            condition.category || '',
            condition.status || '',
            condition.diagnosisDate ? format(new Date(condition.diagnosisDate), 'yyyy-MM-dd') : ''
          ]);
        });
        rows.push([]);
      }
      
      // Allergies
      const allergies: Allergy[] = medicalRecords?.allergies || [];
      if (allergies.length > 0) {
        rows.push(['ALLERGIES']);
        rows.push(['Allergen', 'Severity']);
        allergies.forEach((allergy: Allergy) => {
          rows.push([
            allergy.allergen || '',
            allergy.severity || ''
          ]);
        });
        rows.push([]);
      }
      
      // Laboratory Results
      const diagnosticData = consentedData.diagnostic_data as DiagnosticData | undefined;
      const labResults: LaboratoryResult[] = consentedData.laboratory_results || diagnosticData?.laboratoryResults || [];
      if (labResults.length > 0) {
        rows.push(['LABORATORY RESULTS']);
        labResults.forEach((lab: LaboratoryResult) => {
          rows.push([`Test: ${lab.testName || 'N/A'}`]);
          rows.push(['Result Date', lab.resultDate ? format(new Date(lab.resultDate), 'yyyy-MM-dd') : 'N/A']);
          rows.push(['Status', lab.status || 'N/A']);
          if (lab.results) {
            Object.entries(lab.results).forEach(([key, value]) => {
              rows.push([key, String(value)]);
            });
          }
          rows.push([]);
        });
      }
      
      // Imaging Studies
      const imagingStudies: ImagingStudy[] = consentedData.imaging_studies || diagnosticData?.imagingStudies || consentedData.imaging_data || [];
      if (imagingStudies.length > 0) {
        rows.push(['IMAGING STUDIES']);
        rows.push(['Study Type', 'Date', 'Findings', 'Radiologist']);
        imagingStudies.forEach((study: ImagingStudy) => {
          rows.push([
            study.studyType || '',
            study.studyDate ? format(new Date(study.studyDate), 'yyyy-MM-dd') : '',
            study.findings || '',
            study.radiologist || ''
          ]);
        });
        rows.push([]);
      }
      
      // Genetic Data
      const geneticData = consentedData.genetic_data as GeneticData | undefined;
      if (geneticData) {
        rows.push(['GENETIC DATA']);
        if (geneticData.geneticMarkers) {
          rows.push(['Marker', 'Value']);
          Object.entries(geneticData.geneticMarkers).forEach(([key, value]) => {
            rows.push([key, String(value)]);
          });
        }
        rows.push([]);
      }
      
      const csvContent = rows.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `medical_chart_${patientData.patientId}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      await new Promise(resolve => setTimeout(resolve, 100));
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = async () => {
    if (!patientData) return;
    setIsPrinting(true);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      
      const patientName = `${demographics.firstName || ''} ${demographics.lastName || ''}`.trim();
      const patientAddress = demographics.address 
        ? `${demographics.address.street || ''}, ${demographics.address.city || ''}, ${demographics.address.state || ''} ${demographics.address.zipCode || ''}`
        : 'N/A';
      
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Medical Chart - ${patientData.patientId}</title>
          <style>
            @media print { @page { margin: 1cm; } body { margin: 0; } }
            body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; margin: 20px; color: #000; }
            .header { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
            .section { margin-bottom: 20px; page-break-inside: avoid; }
            .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .no-data { color: #666; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Medical Chart</h1>
            <p><strong>Patient ID:</strong> ${patientData.patientId}</p>
            <p><strong>Export Date:</strong> ${format(new Date(), 'MMMM d, yyyy h:mm a')}</p>
          </div>
          
          <div class="patient-info">
            <div>
              <p><strong>Name:</strong> ${patientName || 'N/A'}</p>
              <p><strong>Date of Birth:</strong> ${demographics.dateOfBirth ? format(new Date(demographics.dateOfBirth), 'MMMM d, yyyy') : 'N/A'}</p>
              <p><strong>Age:</strong> ${demographics.age || 'N/A'}</p>
              <p><strong>Gender:</strong> ${demographics.gender || 'N/A'}</p>
            </div>
            <div>
              <p><strong>Phone:</strong> ${demographics.contact?.phone || 'N/A'}</p>
              <p><strong>Email:</strong> ${demographics.contact?.email || 'N/A'}</p>
              <p><strong>Address:</strong> ${patientAddress}</p>
            </div>
          </div>
      `;
      
      // Vital Signs
      if (consentedData.vital_signs && Array.isArray(consentedData.vital_signs) && consentedData.vital_signs.length > 0) {
        htmlContent += `
          <div class="section">
            <div class="section-title">Vital Signs</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Systolic BP</th>
                  <th>Diastolic BP</th>
                  <th>Heart Rate</th>
                  <th>Temperature</th>
                  <th>O2 Saturation</th>
                </tr>
              </thead>
              <tbody>
        `;
        (consentedData.vital_signs as VitalSign[]).forEach((vital: VitalSign) => {
          htmlContent += `
            <tr>
              <td>${format(new Date(vital.timestamp), 'MMM d, yyyy HH:mm')}</td>
              <td>${vital.bloodPressure?.systolic || ''}</td>
              <td>${vital.bloodPressure?.diastolic || ''}</td>
              <td>${vital.heartRate || ''}</td>
              <td>${vital.temperature || ''}</td>
              <td>${vital.oxygenSaturation || ''}</td>
            </tr>
          `;
        });
        htmlContent += `</tbody></table></div>`;
      }
      
      // Medications
      if (consentedData.current_medications && Array.isArray(consentedData.current_medications) && consentedData.current_medications.length > 0) {
        htmlContent += `
          <div class="section">
            <div class="section-title">Current Medications</div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Prescriber</th>
                </tr>
              </thead>
              <tbody>
        `;
        (consentedData.current_medications as Medication[]).forEach((med: Medication) => {
          htmlContent += `
            <tr>
              <td>${med.name || ''}</td>
              <td>${med.dosage || ''}</td>
              <td>${med.frequency || ''}</td>
              <td>${med.prescriber || ''}</td>
            </tr>
          `;
        });
        htmlContent += `</tbody></table></div>`;
      }
      
      // Re-extract typed data for print function
      const printMedicalRecords = consentedData.medical_records as MedicalRecords | undefined;
      const printTreatmentHistory = consentedData.treatment_history as TreatmentHistory | undefined;
      const printDiagnosticData = consentedData.diagnostic_data as DiagnosticData | undefined;
      const printGeneticData = consentedData.genetic_data as GeneticData | undefined;
      
      // Conditions
      const printConditions: MedicalCondition[] = printMedicalRecords?.conditions || printTreatmentHistory?.conditions || [];
      if (printConditions.length > 0) {
        htmlContent += `
          <div class="section">
            <div class="section-title">Medical Conditions</div>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Diagnosis Date</th>
                </tr>
              </thead>
              <tbody>
        `;
        printConditions.forEach((condition: MedicalCondition) => {
          htmlContent += `
            <tr>
              <td>${condition.name || ''}</td>
              <td>${condition.code || ''}</td>
              <td>${condition.category || ''}</td>
              <td>${condition.status || ''}</td>
              <td>${condition.diagnosisDate ? format(new Date(condition.diagnosisDate), 'MMM d, yyyy') : ''}</td>
            </tr>
          `;
        });
        htmlContent += `</tbody></table></div>`;
      }
      
      // Allergies
      const printAllergies: Allergy[] = printMedicalRecords?.allergies || [];
      if (printAllergies.length > 0) {
        htmlContent += `
          <div class="section">
            <div class="section-title">Allergies</div>
            <table>
              <thead>
                <tr>
                  <th>Allergen</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
        `;
        printAllergies.forEach((allergy: Allergy) => {
          htmlContent += `
            <tr>
              <td>${allergy.allergen || ''}</td>
              <td>${allergy.severity || ''}</td>
            </tr>
          `;
        });
        htmlContent += `</tbody></table></div>`;
      }
      
      // Laboratory Results
      const printLabResults: LaboratoryResult[] = consentedData.laboratory_results || printDiagnosticData?.laboratoryResults || [];
      if (printLabResults.length > 0) {
        htmlContent += `<div class="section"><div class="section-title">Laboratory Results</div>`;
        printLabResults.forEach((lab: LaboratoryResult) => {
          htmlContent += `<p><strong>${lab.testName || 'Test'}</strong> - ${lab.resultDate ? format(new Date(lab.resultDate), 'MMM d, yyyy') : 'N/A'} - Status: ${lab.status || 'N/A'}</p>`;
          if (lab.results) {
            htmlContent += `<ul>`;
            Object.entries(lab.results).forEach(([key, value]) => {
              htmlContent += `<li>${key}: ${value}</li>`;
            });
            htmlContent += `</ul>`;
          }
        });
        htmlContent += `</div>`;
      }
      
      // Imaging Studies
      const printImagingStudies: ImagingStudy[] = consentedData.imaging_studies || printDiagnosticData?.imagingStudies || consentedData.imaging_data || [];
      if (printImagingStudies.length > 0) {
        htmlContent += `
          <div class="section">
            <div class="section-title">Imaging Studies</div>
            <table>
              <thead>
                <tr>
                  <th>Study Type</th>
                  <th>Date</th>
                  <th>Findings</th>
                  <th>Radiologist</th>
                </tr>
              </thead>
              <tbody>
        `;
        printImagingStudies.forEach((study: ImagingStudy) => {
          htmlContent += `
            <tr>
              <td>${study.studyType || ''}</td>
              <td>${study.studyDate ? format(new Date(study.studyDate), 'MMM d, yyyy') : ''}</td>
              <td>${study.findings || ''}</td>
              <td>${study.radiologist || ''}</td>
            </tr>
          `;
        });
        htmlContent += `</tbody></table></div>`;
      }
      
      // Genetic Data
      if (printGeneticData && printGeneticData.geneticMarkers) {
        htmlContent += `<div class="section"><div class="section-title">Genetic Data</div><ul>`;
        Object.entries(printGeneticData.geneticMarkers).forEach(([key, value]) => {
          htmlContent += `<li><strong>${key}:</strong> ${value}</li>`;
        });
        htmlContent += `</ul></div>`;
      }
      
      htmlContent += `</body></html>`;
      
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      await new Promise(resolve => setTimeout(resolve, 250));
      printWindow.print();
      printWindow.close();
    } finally {
      setIsPrinting(false);
    }
  };

  return {
    // Data
    patientData,
    consentedData,
    consentInfo,
    demographics,
    hasNoConsent,
    isLoading,
    error,
    
    // State
    expandedSection,
    setExpandedSection,
    vitalSignsPageIndex,
    setVitalSignsPageIndex,
    isExporting,
    isPrinting,
    
    // Chart data
    vitalSignsChartData,
    
    // Helpers
    getConsentForDataType,
    hasConsentForDataType,
    
    // Export/Print
    exportToCSV,
    handlePrint,
  };
}

