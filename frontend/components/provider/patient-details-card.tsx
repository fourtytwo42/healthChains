'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Pill, Heart, FlaskConical, Scan, Dna, 
  ChevronRight, ChevronLeft
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { usePatientData } from '@/hooks/patient/use-patient-data';
import { PatientDetailsHeader } from './patient-details/patient-details-header';
import { VitalSignsChart } from './patient-details/vital-signs-chart';
import { MedicalDataSection } from './patient-details/medical-data-section';
import { ExportPrintControls } from './patient-details/export-print-controls';
import type {
  VitalSign,
  Medication,
  MedicalCondition,
  Allergy,
  LaboratoryResult,
  ImagingStudy,
  GeneticData,
  GeneticVariant,
  DiagnosticData,
  MedicalRecords,
  TreatmentHistory,
} from '@/types/patient';

interface PatientDetailsCardProps {
  patientId: string;
  patientWalletAddress?: string;
  providerAddress: string;
  onClose: () => void;
}

/**
 * Patient Details Card Component - Medical Chart View
 * Displays patient medical data that the provider has access to based on granted consents
 */
export function PatientDetailsCard({
  patientId,
  patientWalletAddress,
  providerAddress,
  onClose,
}: PatientDetailsCardProps) {
  const {
    patientData,
    consentedData,
    consentInfo,
    demographics,
    hasNoConsent,
    isLoading,
    error,
    expandedSection,
    setExpandedSection,
    vitalSignsPageIndex,
    setVitalSignsPageIndex,
    isExporting,
    isPrinting,
    vitalSignsChartData,
    getConsentForDataType,
    hasConsentForDataType,
    exportToCSV,
    handlePrint,
  } = usePatientData(providerAddress, patientId);

  // Early returns AFTER all hooks
  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Loading Patient Chart...</DialogTitle>
            <DialogDescription>Fetching patient medical data...</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="flex justify-end pt-3 border-t flex-shrink-0 mt-2">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !patientData) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Error Loading Patient Chart</DialogTitle>
            <DialogDescription>
              {error?.message || 'Failed to load patient data'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-3 border-t flex-shrink-0 mt-2">
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const patientName = `${demographics.firstName || ''} ${demographics.lastName || ''}`.trim();

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
              
              <PatientDetailsHeader
                patientId={patientId}
                patientWalletAddress={patientWalletAddress}
                demographics={demographics}
              />
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 relative">
          <div className="space-y-3">
            {/* Vital Signs with Chart */}
            <MedicalDataSection
              title="Vital Signs"
              icon={Heart}
              dataType="vital_signs"
              hasData={!!consentedData.vital_signs}
              isEmpty={!consentedData.vital_signs || (consentedData.vital_signs as VitalSign[]).length === 0}
              hasConsent={hasConsentForDataType('vital_signs')}
              consents={getConsentForDataType('vital_signs')}
              isExpanded={expandedSection === 'vital_signs'}
              onToggle={() => setExpandedSection(expandedSection === 'vital_signs' ? null : 'vital_signs')}
            >
              <div className="space-y-4">
                {vitalSignsChartData.length > 0 && (
                  <VitalSignsChart data={vitalSignsChartData} />
                )}
                
                {/* Paginated Readings Section */}
                {(() => {
                  const allReadings = ((consentedData.vital_signs as VitalSign[]) || []).slice().reverse();
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
                      
                      <div className="grid grid-cols-3 gap-2 text-xs flex-1">
                        {currentReadings.map((vital: VitalSign, idx: number) => (
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
            </MedicalDataSection>

            {/* Current Medications */}
            <MedicalDataSection
              title="Current Medications"
              icon={Pill}
              dataType="prescription_history"
              hasData={!!consentedData.current_medications}
              isEmpty={!consentedData.current_medications || (consentedData.current_medications as Medication[]).length === 0}
              hasConsent={hasConsentForDataType('prescription_history')}
              consents={getConsentForDataType('prescription_history')}
              isExpanded={expandedSection === 'medications'}
              onToggle={() => setExpandedSection(expandedSection === 'medications' ? null : 'medications')}
            >
              <div className="space-y-2">
                {((consentedData.current_medications as Medication[]) || []).map((med: Medication, idx: number) => (
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
            </MedicalDataSection>

            {/* Medical Records */}
            <MedicalDataSection
              title="Medical Records"
              icon={FileText}
              dataType="medical_records"
              hasData={!!consentedData.medical_records || !!(consentedData.treatment_history as TreatmentHistory | undefined)?.conditions}
              isEmpty={(!consentedData.medical_records || 
                (!(consentedData.medical_records as MedicalRecords | undefined)?.conditions?.length && 
                 !(consentedData.medical_records as MedicalRecords | undefined)?.allergies?.length)) &&
                (!(consentedData.treatment_history as TreatmentHistory | undefined)?.conditions?.length)}
              hasConsent={hasConsentForDataType('medical_records')}
              consents={getConsentForDataType('medical_records')}
              isExpanded={expandedSection === 'medical_records'}
              onToggle={() => setExpandedSection(expandedSection === 'medical_records' ? null : 'medical_records')}
            >
              <div className="space-y-3">
                {((consentedData.medical_records as MedicalRecords | undefined)?.conditions || (consentedData.treatment_history as TreatmentHistory | undefined)?.conditions) && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Conditions</h4>
                    <div className="space-y-2">
                      {((consentedData.medical_records as MedicalRecords | undefined)?.conditions || (consentedData.treatment_history as TreatmentHistory | undefined)?.conditions || []).map((condition: MedicalCondition, idx: number) => (
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
                {(consentedData.medical_records as MedicalRecords | undefined)?.allergies && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Allergies</h4>
                    <div className="space-y-1">
                      {((consentedData.medical_records as MedicalRecords | undefined)?.allergies || []).map((allergy: Allergy, idx: number) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium">{allergy.allergen}</span>
                          {allergy.severity && <span className="text-muted-foreground ml-2">({allergy.severity})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </MedicalDataSection>

            {/* Laboratory Results */}
            <MedicalDataSection
              title="Laboratory Results"
              icon={FlaskConical}
              dataType="laboratory_results"
              hasData={!!consentedData.laboratory_results || !!(consentedData.diagnostic_data as DiagnosticData | undefined)?.laboratoryResults}
              isEmpty={(!consentedData.laboratory_results || (consentedData.laboratory_results as LaboratoryResult[]).length === 0) && 
                       (!(consentedData.diagnostic_data as DiagnosticData | undefined)?.laboratoryResults || ((consentedData.diagnostic_data as DiagnosticData | undefined)?.laboratoryResults as LaboratoryResult[]).length === 0)}
              hasConsent={hasConsentForDataType('laboratory_results')}
              consents={getConsentForDataType('laboratory_results')}
              isExpanded={expandedSection === 'laboratory_results'}
              onToggle={() => setExpandedSection(expandedSection === 'laboratory_results' ? null : 'laboratory_results')}
            >
              <div className="space-y-2">
                {((consentedData.laboratory_results || (consentedData.diagnostic_data as DiagnosticData | undefined)?.laboratoryResults) as LaboratoryResult[] || []).map((lab: LaboratoryResult, idx: number) => (
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
                        {Object.entries(lab.results || {}).map(([key, value]: [string, unknown]) => (
                          <div key={key} className="text-xs">
                            <span className="text-muted-foreground">{key}:</span> <span className="font-medium">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </MedicalDataSection>

            {/* Imaging Studies */}
            <MedicalDataSection
              title="Imaging Studies"
              icon={Scan}
              dataType="imaging_data"
              hasData={!!consentedData.imaging_studies || !!(consentedData.diagnostic_data as DiagnosticData | undefined)?.imagingStudies || !!consentedData.imaging_data}
              isEmpty={(!consentedData.imaging_studies || (consentedData.imaging_studies as ImagingStudy[]).length === 0) && 
                       (!(consentedData.diagnostic_data as DiagnosticData | undefined)?.imagingStudies || ((consentedData.diagnostic_data as DiagnosticData | undefined)?.imagingStudies as ImagingStudy[]).length === 0) &&
                       (!consentedData.imaging_data || (consentedData.imaging_data as ImagingStudy[]).length === 0)}
              hasConsent={hasConsentForDataType('imaging_data')}
              consents={getConsentForDataType('imaging_data')}
              isExpanded={expandedSection === 'imaging_studies'}
              onToggle={() => setExpandedSection(expandedSection === 'imaging_studies' ? null : 'imaging_studies')}
            >
              <div className="space-y-2">
                {((consentedData.imaging_studies || (consentedData.diagnostic_data as DiagnosticData | undefined)?.imagingStudies || consentedData.imaging_data) as ImagingStudy[] || []).map((study: ImagingStudy, idx: number) => (
                  <div key={idx} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{study.studyType}</span>
                      {study.modality && <Badge variant="outline" className="text-xs">{study.modality}</Badge>}
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
            </MedicalDataSection>

            {/* Genetic Data */}
            <MedicalDataSection
              title="Genetic Data"
              icon={Dna}
              dataType="genetic_data"
              hasData={!!consentedData.genetic_data}
              isEmpty={!consentedData.genetic_data}
              hasConsent={hasConsentForDataType('genetic_data')}
              consents={getConsentForDataType('genetic_data')}
              isExpanded={expandedSection === 'genetic_data'}
              onToggle={() => setExpandedSection(expandedSection === 'genetic_data' ? null : 'genetic_data')}
            >
              {consentedData.genetic_data && (
                <div className="space-y-3">
                  {(consentedData.genetic_data as GeneticData).variants && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Variants</h4>
                      <div className="space-y-2">
                        {((consentedData.genetic_data as GeneticData).variants || []).map((variant: GeneticVariant, idx: number) => (
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
                  {(consentedData.genetic_data as GeneticData).pharmacogenomics && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Pharmacogenomics</h4>
                      <div className="space-y-1">
                        {Object.entries((consentedData.genetic_data as GeneticData).pharmacogenomics || {}).map(([drug, info]: [string, unknown]) => (
                          <div key={drug} className="text-sm">
                            <span className="font-medium">{drug}:</span> <span className="text-muted-foreground">{String(info)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </MedicalDataSection>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="px-6 py-4 border-t flex-shrink-0">
          <ExportPrintControls
            isExporting={isExporting}
            isPrinting={isPrinting}
            onExport={exportToCSV}
            onPrint={handlePrint}
            onClose={onClose}
            patientWalletAddress={patientWalletAddress}
            patientId={patientId}
            patientName={patientName || patientId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
