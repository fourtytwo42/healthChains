'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ColoredBadge, ColoredBadgeList } from '@/components/shared/colored-badge';
import { 
  FileText, Pill, Heart, FlaskConical, Scan, Dna, 
  ChevronRight, ChevronLeft, Lock, Calendar, Info, Download, Printer
} from 'lucide-react';
import { dataTypeDescriptions } from '@/lib/badge-utils';
import { useProviderPatientData } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RequestConsentDialog } from '@/components/provider/request-consent-dialog';

interface PatientDetailsCardProps {
  patientId: string;
  patientWalletAddress?: string;
  providerAddress: string;
  onClose: () => void;
}

/**
 * Patient Details Card Component - Medical Chart View
 * Displays patient medical data that the provider has access to based on granted consents
 * 
 * CRITICAL: No useMemo, no useEffect with React Query data dependencies
 * - Use React Query data directly in render
 * - Only use state for UI state (expanded sections)
 * - Calculate derived values directly in render
 */
export function PatientDetailsCard({
  patientId,
  patientWalletAddress,
  providerAddress,
  onClose,
}: PatientDetailsCardProps) {
  // ALL HOOKS MUST BE AT THE TOP - before any early returns
  const [expandedSection, setExpandedSection] = useState<string | null>('vital_signs'); // Default to vital signs open
  const [vitalSignsPageIndex, setVitalSignsPageIndex] = useState(0); // Track which page of readings we're on
  const { data, isLoading, error } = useProviderPatientData(providerAddress, patientId);

  // Extract data directly - no state, no effects, no memoization
  const patientData = data?.data;
  const consentedData = (patientData as any)?.consentedData || {};
  const consentInfo = (patientData as any)?.consentInfo || [];
  const demographics = (patientData as any)?.demographics || {};
  const hasNoConsent = consentInfo.length === 0;

  // Helper functions - regular functions, calculated in render
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

  // Memoize chart data - only recalculate when vital signs data changes
  // This prevents the chart from re-rendering when only the page index changes
  const vitalSignsChartData = useMemo(() => {
    if (!consentedData.vital_signs || !Array.isArray(consentedData.vital_signs)) {
      return [];
    }
    
    return consentedData.vital_signs
      .slice(-30) // Last 30 records
      .map((vital: any) => ({
        date: format(new Date(vital.timestamp), 'MMM d'),
        timestamp: vital.timestamp, // Preserve full timestamp for tooltip
        systolic: vital.bloodPressure?.systolic || null,
        diastolic: vital.bloodPressure?.diastolic || null,
        heartRate: vital.heartRate || null,
        temperature: vital.temperature ? parseFloat(vital.temperature) : null,
        oxygenSaturation: vital.oxygenSaturation || null,
      }))
      .reverse(); // Show oldest to newest
  }, [consentedData.vital_signs]);

  // Custom Tooltip for Vital Signs Chart
  const VitalSignsTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) {
      return null;
    }

    // Get the full data point (includes timestamp)
    const dataPoint = payload[0]?.payload;
    const timestamp = dataPoint?.timestamp;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-[200px]">
        {timestamp && (
          <div className="mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {format(new Date(timestamp), 'MMM d, yyyy')}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {format(new Date(timestamp), 'h:mm a')}
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => {
            if (entry.value === null || entry.value === undefined) return null;
            
            let label = entry.name;
            let unit = '';
            
            // Add units based on metric type
            if (entry.dataKey === 'systolic' || entry.dataKey === 'diastolic') {
              unit = ' mmHg';
            } else if (entry.dataKey === 'heartRate') {
              unit = ' bpm';
            } else if (entry.dataKey === 'temperature') {
              unit = '°C';
            } else if (entry.dataKey === 'oxygenSaturation') {
              unit = '%';
            }
            
            return (
              <div key={index} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{label}:</span>
                </div>
                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {entry.value}{unit}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Medical Chart Section Component - defined inside to access helpers
  const MedicalSection = ({ 
    title, 
    icon: Icon, 
    dataType, 
    children, 
    hasData, 
    isEmpty 
  }: { 
    title: string; 
    icon: React.ElementType;
    dataType: string;
    children?: React.ReactNode;
    hasData: boolean;
    isEmpty: boolean;
  }) => {
    const hasConsent = hasConsentForDataType(dataType);
    const consents = getConsentForDataType(dataType);
    const isExpanded = expandedSection === dataType;

    const handleToggle = () => {
      setExpandedSection(isExpanded ? null : dataType);
    };

    if (!hasConsent) {
      return (
        <Card className="border-dashed">
          <CardHeader 
            className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={handleToggle}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <TooltipProvider>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <CardTitle className="text-base cursor-help">{title}</CardTitle>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        {dataTypeDescriptions[dataType] || `${title} - Medical data section`}
                      </p>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
                <Badge variant="outline" className="text-xs">No Consent</Badge>
              </div>
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </div>
          </CardHeader>
          {isExpanded && (
            <CardContent className="pt-0">
              <div className="p-4 bg-muted/30 rounded-lg border border-dashed">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">Data Not Available</p>
                    <p className="text-xs text-muted-foreground">
                      This section is not available because you don't have consent to view {title.toLowerCase()}. 
                      Request consent from the patient to access this data.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      );
    }

    if (isEmpty || !hasData) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-base cursor-help">{title}</CardTitle>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" sideOffset={8} className="z-[100]">
                    <p className="text-xs max-w-xs">
                      {dataTypeDescriptions[dataType] || `${title} - Medical data section`}
                    </p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">No data available</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader 
          className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={handleToggle}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-base cursor-help">{title}</CardTitle>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" sideOffset={8} className="z-[100]">
                    <p className="text-xs max-w-xs">
                      {dataTypeDescriptions[dataType] || `${title} - Medical data section`}
                    </p>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
              <TooltipProvider>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" sideOffset={8} className="z-[100]">
                    <div className="space-y-1">
                      <p className="font-semibold text-xs">Consent Details</p>
                      {consents.map((c: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <p>Purposes: {c.purposes?.join(', ') || c.purpose}</p>
                          {c.expirationTime && (
                            <p>Expires: {format(new Date(c.expirationTime), 'MMM d, yyyy')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </TooltipContent>
                </UITooltip>
              </TooltipProvider>
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="pt-0">
            {children}
          </CardContent>
        )}
      </Card>
    );
  };

  // CSV Export Function
  const exportToCSV = () => {
    if (!patientData) return;
    
    const rows: string[][] = [];
    
    // Header
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
    
    // Convert to CSV
    const csvContent = rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `medical_chart_${patientData.patientId}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Function
  const handlePrint = () => {
    if (!patientData) return;
    
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
          @media print {
            @page { margin: 1cm; }
            body { margin: 0; }
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            margin: 20px;
            color: #000;
          }
          .header {
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .patient-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 20px;
          }
          .section {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 14px;
            font-weight: bold;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
            margin-bottom: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 6px;
            text-align: left;
          }
          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          .no-data {
            color: #666;
            font-style: italic;
          }
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
    
    htmlContent += `
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Early returns AFTER all hooks
  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Patient Chart...</DialogTitle>
            <DialogDescription>Fetching patient medical data...</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !patientData) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Error Loading Patient Chart</DialogTitle>
            <DialogDescription>
              {error?.message || 'Failed to load patient data'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const patientName = `${demographics.firstName || ''} ${demographics.lastName || ''}`.trim();
  const patientAddress = demographics.address 
    ? `${demographics.address.street || ''}, ${demographics.address.city || ''}, ${demographics.address.state || ''} ${demographics.address.zipCode || ''}`
    : 'N/A';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
        {/* Fixed Header */}
        <DialogHeader className="pb-2 px-6 pt-6 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-lg">
                Medical Chart - {patientData.patientId}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Patient medical data based on granted consents. Click sections to view details.
              </DialogDescription>
              
              {/* Patient Info - Not in scrollable area */}
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-base mb-1">{patientName || 'N/A'}</p>
                  <p className="text-muted-foreground text-xs">
                    {demographics.dateOfBirth ? `DOB: ${format(new Date(demographics.dateOfBirth), 'MMM d, yyyy')}` : ''}
                    {demographics.age ? ` • Age: ${demographics.age}` : ''}
                    {demographics.gender ? ` • ${demographics.gender}` : ''}
                  </p>
                  {patientId && (
                    <p className="text-muted-foreground text-xs font-mono mt-1">
                      <strong>Patient ID:</strong> {patientId}
                    </p>
                  )}
                  {patientWalletAddress && (
                    <p className="text-muted-foreground text-xs font-mono mt-1">
                      <strong>Wallet:</strong> {patientWalletAddress.slice(0, 6)}...{patientWalletAddress.slice(-4)}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {demographics.contact?.phone && (
                    <p><strong>Phone:</strong> {demographics.contact.phone}</p>
                  )}
                  {demographics.contact?.email && (
                    <p><strong>Email:</strong> {demographics.contact.email}</p>
                  )}
                  {patientAddress !== 'N/A' && (
                    <p><strong>Address:</strong> {patientAddress}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 relative">
          <div className="space-y-3">
          {/* Vital Signs with Chart - FIRST, OPEN BY DEFAULT */}
          <MedicalSection
            title="Vital Signs"
            icon={Heart}
            dataType="vital_signs"
            hasData={!!consentedData.vital_signs}
            isEmpty={!consentedData.vital_signs || (consentedData.vital_signs as any[]).length === 0}
          >
            <div className="space-y-4">
              {vitalSignsChartData.length > 0 && (
                <div className="h-64 min-h-[256px] w-full">
                  <ResponsiveContainer width="100%" height={256}>
                    <LineChart data={vitalSignsChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                      <Tooltip content={<VitalSignsTooltip />} />
                      <Legend />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="systolic" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        name="Systolic BP"
                        dot={false}
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="diastolic" 
                        stroke="#f97316" 
                        strokeWidth={2}
                        name="Diastolic BP"
                        dot={false}
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="heartRate" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        name="Heart Rate"
                        dot={false}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="temperature" 
                        stroke="#8b5cf6" 
                        strokeWidth={2}
                        name="Temperature"
                        dot={false}
                      />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="oxygenSaturation" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        name="O2 Saturation"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              
              {/* Paginated Readings Section */}
              {(() => {
                const allReadings = ((consentedData.vital_signs as any) || []).slice().reverse(); // Reverse to show newest first
                const totalReadings = allReadings.length;
                const readingsPerPage = 3;
                const totalPages = Math.ceil(totalReadings / readingsPerPage);
                const startIndex = vitalSignsPageIndex * readingsPerPage;
                const endIndex = startIndex + readingsPerPage;
                const currentReadings = allReadings.slice(startIndex, endIndex);
                const isFirstPage = vitalSignsPageIndex === 0;
                const isLastPage = vitalSignsPageIndex >= totalPages - 1;
                
                if (totalReadings === 0) return null;
                
                return (
                  <div className="flex items-center gap-2">
                    {/* Left Button - only show if not on first page */}
                    {!isFirstPage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVitalSignsPageIndex(prev => Math.max(0, prev - 1))}
                        className="h-8 w-8 p-0 flex-shrink-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    )}
                    
                    {/* Readings Grid */}
                    <div className="grid grid-cols-3 gap-2 text-xs flex-1">
                      {currentReadings.map((vital: any, idx: number) => (
                        <div key={startIndex + idx} className="border rounded p-2">
                          <p className="text-muted-foreground mb-1">
                            {format(new Date(vital.timestamp), 'MMM d, yyyy')}
                          </p>
                          {vital.bloodPressure && (
                            <p>BP: {vital.bloodPressure.systolic}/{vital.bloodPressure.diastolic}</p>
                          )}
                          {vital.heartRate && <p>HR: {vital.heartRate} bpm</p>}
                          {vital.temperature && <p>Temp: {vital.temperature}°C</p>}
                          {vital.oxygenSaturation && <p>O2: {vital.oxygenSaturation}%</p>}
                        </div>
                      ))}
                    </div>
                    
                    {/* Right Button - only show if not on last page */}
                    {!isLastPage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVitalSignsPageIndex(prev => Math.min(totalPages - 1, prev + 1))}
                        className="h-8 w-8 p-0 flex-shrink-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
          </MedicalSection>

          {/* Current Medications - SECOND */}
          <MedicalSection
            title="Current Medications"
            icon={Pill}
            dataType="prescription_history"
            hasData={!!consentedData.current_medications}
            isEmpty={!consentedData.current_medications || (consentedData.current_medications as any[]).length === 0}
          >
            <div className="space-y-2">
              {((consentedData.current_medications as any) || []).map((med: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <span className="font-medium text-sm">{med.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{med.dosage}</span>
                    {med.frequency && (
                      <span className="text-xs text-muted-foreground ml-2">• {med.frequency}</span>
                    )}
                  </div>
                  {med.prescriber && (
                    <span className="text-xs text-muted-foreground">{med.prescriber}</span>
                  )}
                </div>
              ))}
            </div>
          </MedicalSection>

          {/* Medical Records */}
          <MedicalSection
            title="Medical Records"
            icon={FileText}
            dataType="medical_records"
            hasData={!!consentedData.medical_records || !!(consentedData.treatment_history as any)?.conditions}
            isEmpty={(!consentedData.medical_records || 
              (!(consentedData.medical_records as any).conditions?.length && 
               !(consentedData.medical_records as any).allergies?.length)) &&
              (!(consentedData.treatment_history as any)?.conditions?.length)}
          >
            <div className="space-y-3">
              {((consentedData.medical_records as any)?.conditions || (consentedData.treatment_history as any)?.conditions) && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Conditions</h4>
                  <div className="space-y-2">
                    {((consentedData.medical_records as any)?.conditions || (consentedData.treatment_history as any)?.conditions || []).map((condition: any, idx: number) => (
                      <div key={idx} className="border rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{condition.name}</span>
                          <Badge variant="outline" className="text-xs">{condition.code}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span>Category: {condition.category}</span>
                          {condition.diagnosisDate && (
                            <span className="ml-3">Diagnosed: {format(new Date(condition.diagnosisDate), 'MMM d, yyyy')}</span>
                          )}
                          {condition.status && <span className="ml-3">Status: {condition.status}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(consentedData.medical_records as any)?.allergies && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Allergies</h4>
                  <div className="space-y-1">
                    {((consentedData.medical_records as any).allergies || []).map((allergy: any, idx: number) => (
                      <div key={idx} className="text-sm">
                        <span className="font-medium">{allergy.allergen}</span>
                        {allergy.severity && <span className="text-muted-foreground ml-2">({allergy.severity})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </MedicalSection>

          {/* Laboratory Results */}
          <MedicalSection
            title="Laboratory Results"
            icon={FlaskConical}
            dataType="laboratory_results"
            hasData={!!consentedData.laboratory_results || !!(consentedData.diagnostic_data as any)?.laboratoryResults}
            isEmpty={(!consentedData.laboratory_results || (consentedData.laboratory_results as any[]).length === 0) && 
                     (!(consentedData.diagnostic_data as any)?.laboratoryResults || ((consentedData.diagnostic_data as any).laboratoryResults as any[]).length === 0)}
          >
            <div className="space-y-2">
              {((consentedData.laboratory_results || (consentedData.diagnostic_data as any)?.laboratoryResults) as any[] || []).map((lab: any, idx: number) => (
                <div key={idx} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{lab.testName}</span>
                    <Badge variant="outline" className="text-xs">{lab.status}</Badge>
                  </div>
                  {lab.resultDate && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Result Date: {format(new Date(lab.resultDate), 'MMM d, yyyy')}
                    </p>
                  )}
                  {lab.results && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {Object.entries(lab.results).map(([key, value]: [string, any]) => (
                        <div key={key} className="text-xs">
                          <span className="text-muted-foreground">{key}:</span> <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </MedicalSection>

          {/* Imaging Studies */}
          <MedicalSection
            title="Imaging Studies"
            icon={Scan}
            dataType="imaging_data"
            hasData={!!consentedData.imaging_studies || !!(consentedData.diagnostic_data as any)?.imagingStudies || !!consentedData.imaging_data}
            isEmpty={(!consentedData.imaging_studies || (consentedData.imaging_studies as any[]).length === 0) && 
                     (!(consentedData.diagnostic_data as any)?.imagingStudies || ((consentedData.diagnostic_data as any).imagingStudies as any[]).length === 0) &&
                     (!consentedData.imaging_data || (consentedData.imaging_data as any[]).length === 0)}
          >
            <div className="space-y-2">
              {((consentedData.imaging_studies || (consentedData.diagnostic_data as any)?.imagingStudies || consentedData.imaging_data) as any[] || []).map((study: any, idx: number) => (
                <div key={idx} className="border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{study.studyType}</span>
                    <Badge variant="outline" className="text-xs">{study.modality}</Badge>
                  </div>
                  {study.performedDate && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Performed: {format(new Date(study.performedDate), 'MMM d, yyyy')}
                    </p>
                  )}
                  {study.findings && (
                    <p className="text-xs text-muted-foreground">{study.findings}</p>
                  )}
                </div>
              ))}
            </div>
          </MedicalSection>

          {/* Genetic Data */}
          <MedicalSection
            title="Genetic Data"
            icon={Dna}
            dataType="genetic_data"
            hasData={!!consentedData.genetic_data}
            isEmpty={!consentedData.genetic_data}
          >
            {consentedData.genetic_data && (
              <div className="space-y-3">
                {(consentedData.genetic_data as any).variants && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Variants</h4>
                    <div className="space-y-2">
                      {((consentedData.genetic_data as any).variants || []).map((variant: any, idx: number) => (
                        <div key={idx} className="border rounded p-2">
                          <div className="font-medium text-sm">{variant.gene}: {variant.variant}</div>
                          {variant.classification && (
                            <Badge variant="outline" className="text-xs mt-1">{variant.classification}</Badge>
                          )}
                          {variant.significance && (
                            <p className="text-xs text-muted-foreground mt-1">{variant.significance}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(consentedData.genetic_data as any).pharmacogenomics && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Pharmacogenomics</h4>
                    <div className="space-y-1">
                      {Object.entries((consentedData.genetic_data as any).pharmacogenomics).map(([drug, info]: [string, any]) => (
                        <div key={drug} className="text-sm">
                          <span className="font-medium">{drug}:</span> <span className="text-muted-foreground">{info}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </MedicalSection>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex justify-end items-center gap-2 px-6 py-4 border-t">
          <div className="flex items-center gap-2 mr-auto">
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exportToCSV}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Save as CSV</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrint}
                    className="h-8 w-8 p-0"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Print medical chart</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
          {patientWalletAddress && (
            <RequestConsentDialog
              patientAddress={patientWalletAddress}
              patientId={patientId}
              patientName={`${(patientData.demographics as any)?.firstName || ''} ${(patientData.demographics as any)?.lastName || ''}`.trim() || patientId}
            />
          )}
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
