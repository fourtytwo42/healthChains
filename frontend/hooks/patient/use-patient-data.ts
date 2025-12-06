'use client';

import { useState, useMemo } from 'react';
import { useProviderPatientData } from '@/hooks/use-api';
import { format } from 'date-fns';

export function usePatientData(providerAddress: string, patientId: string) {
  const { data, isLoading, error } = useProviderPatientData(providerAddress, patientId);
  const [expandedSection, setExpandedSection] = useState<string | null>('vital_signs');
  const [vitalSignsPageIndex, setVitalSignsPageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Extract data directly
  const patientData = data?.data;
  const consentedData = (patientData as any)?.consentedData || {};
  const consentInfo = (patientData as any)?.consentInfo || [];
  const demographics = (patientData as any)?.demographics || {};
  const hasNoConsent = consentInfo.length === 0;

  // Helper functions
  const getConsentForDataType = (dataType: string) => {
    return consentInfo.filter((c: any) => {
      if (c.dataTypes && Array.isArray(c.dataTypes)) {
        return c.dataTypes.includes(dataType);
      }
      return c.dataType === dataType;
    });
  };

  const hasConsentForDataType = (dataType: string) => {
    return consentInfo.some((c: any) => {
      if (c.dataTypes && Array.isArray(c.dataTypes)) {
        return c.dataTypes.includes(dataType);
      }
      return c.dataType === dataType;
    });
  };

  // Memoize chart data
  const vitalSignsChartData = useMemo(() => {
    if (!consentedData.vital_signs || !Array.isArray(consentedData.vital_signs)) {
      return [];
    }
    
    return consentedData.vital_signs
      .slice(-30)
      .map((vital: any) => ({
        date: format(new Date(vital.timestamp), 'MMM d'),
        timestamp: vital.timestamp,
        systolic: vital.bloodPressure?.systolic || null,
        diastolic: vital.bloodPressure?.diastolic || null,
        heartRate: vital.heartRate || null,
        temperature: vital.temperature ? parseFloat(vital.temperature) : null,
        oxygenSaturation: vital.oxygenSaturation || null,
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
      rows.push(['Age', demographics.age || 'N/A']);
      rows.push(['Gender', demographics.gender || 'N/A']);
      rows.push(['Phone', demographics.contact?.phone || 'N/A']);
      rows.push(['Email', demographics.contact?.email || 'N/A']);
      rows.push(['Export Date', format(new Date(), 'yyyy-MM-dd HH:mm:ss')]);
      rows.push([]);
      
      // Vital Signs
      if (consentedData.vital_signs && Array.isArray(consentedData.vital_signs)) {
        rows.push(['VITAL SIGNS']);
        rows.push(['Date', 'Systolic BP', 'Diastolic BP', 'Heart Rate (bpm)', 'Temperature (°C)', 'O2 Saturation (%)']);
        (consentedData.vital_signs as any[]).forEach((vital: any) => {
          rows.push([
            format(new Date(vital.timestamp), 'yyyy-MM-dd HH:mm'),
            vital.bloodPressure?.systolic || '',
            vital.bloodPressure?.diastolic || '',
            vital.heartRate || '',
            vital.temperature || '',
            vital.oxygenSaturation || ''
          ]);
        });
        rows.push([]);
      }
      
      // Medications
      if (consentedData.current_medications && Array.isArray(consentedData.current_medications)) {
        rows.push(['CURRENT MEDICATIONS']);
        rows.push(['Name', 'Dosage', 'Frequency', 'Prescriber']);
        (consentedData.current_medications as any[]).forEach((med: any) => {
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
      const conditions = (consentedData.medical_records as any)?.conditions || (consentedData.treatment_history as any)?.conditions || [];
      if (conditions.length > 0) {
        rows.push(['MEDICAL CONDITIONS']);
        rows.push(['Name', 'Code', 'Category', 'Status', 'Diagnosis Date']);
        conditions.forEach((condition: any) => {
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
      const allergies = (consentedData.medical_records as any)?.allergies || [];
      if (allergies.length > 0) {
        rows.push(['ALLERGIES']);
        rows.push(['Allergen', 'Severity']);
        allergies.forEach((allergy: any) => {
          rows.push([
            allergy.allergen || '',
            allergy.severity || ''
          ]);
        });
        rows.push([]);
      }
      
      // Laboratory Results
      const labResults = (consentedData.laboratory_results || (consentedData.diagnostic_data as any)?.laboratoryResults) as any[] || [];
      if (labResults.length > 0) {
        rows.push(['LABORATORY RESULTS']);
        labResults.forEach((lab: any) => {
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
      const imagingStudies = (consentedData.imaging_studies || (consentedData.diagnostic_data as any)?.imagingStudies || consentedData.imaging_data) as any[] || [];
      if (imagingStudies.length > 0) {
        rows.push(['IMAGING STUDIES']);
        rows.push(['Study Type', 'Date', 'Findings', 'Radiologist']);
        imagingStudies.forEach((study: any) => {
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
      if (consentedData.genetic_data) {
        rows.push(['GENETIC DATA']);
        if ((consentedData.genetic_data as any).geneticMarkers) {
          rows.push(['Marker', 'Value']);
          Object.entries((consentedData.genetic_data as any).geneticMarkers).forEach(([key, value]) => {
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
        (consentedData.vital_signs as any[]).forEach((vital: any) => {
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
        (consentedData.current_medications as any[]).forEach((med: any) => {
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
      
      // Conditions
      const conditions = (consentedData.medical_records as any)?.conditions || (consentedData.treatment_history as any)?.conditions || [];
      if (conditions.length > 0) {
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
        conditions.forEach((condition: any) => {
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
      const allergies = (consentedData.medical_records as any)?.allergies || [];
      if (allergies.length > 0) {
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
        allergies.forEach((allergy: any) => {
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
      const labResults = (consentedData.laboratory_results || (consentedData.diagnostic_data as any)?.laboratoryResults) as any[] || [];
      if (labResults.length > 0) {
        htmlContent += `<div class="section"><div class="section-title">Laboratory Results</div>`;
        labResults.forEach((lab: any) => {
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
      const imagingStudies = (consentedData.imaging_studies || (consentedData.diagnostic_data as any)?.imagingStudies || consentedData.imaging_data) as any[] || [];
      if (imagingStudies.length > 0) {
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
        imagingStudies.forEach((study: any) => {
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
      if (consentedData.genetic_data && (consentedData.genetic_data as any).geneticMarkers) {
        htmlContent += `<div class="section"><div class="section-title">Genetic Data</div><ul>`;
        Object.entries((consentedData.genetic_data as any).geneticMarkers).forEach(([key, value]) => {
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

