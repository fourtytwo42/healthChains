'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Calendar, FileText, Pill, Heart, FlaskConical, Scan, Dna } from 'lucide-react';
import { useProviderPatientData } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PatientDetailsCardProps {
  patientId: string;
  providerAddress: string;
  onClose: () => void;
}

/**
 * Patient Details Card Component
 * Shows all patient data that the provider has consent to access
 */
export function PatientDetailsCard({
  patientId,
  providerAddress,
  onClose,
}: PatientDetailsCardProps) {
  const { data, isLoading, error } = useProviderPatientData(providerAddress, patientId);

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>Loading patient information...</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Handle error case - check if it's a network error or no consent
  if (error) {
    const errorMessage = error?.message || 'Unknown error';
    // Check if it's a "no consent" scenario (404 or specific error codes)
    const isNoConsentError = errorMessage.includes('NOT_FOUND') || 
                             errorMessage.includes('Failed to fetch') ||
                             errorMessage.includes('404');
    
    if (isNoConsentError) {
      return (
        <Dialog open onOpenChange={onClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>No Access</DialogTitle>
              <DialogDescription>
                You don't have consent to view this patient's data yet. The patient needs to approve your consent request first.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Once the patient approves your request, you'll be able to view their data here.
              </p>
              <Button onClick={onClose}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      );
    }
    
    // For other errors, show the error message
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Failed to load patient data. {errorMessage}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={onClose}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  if (!data?.data) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No Access</DialogTitle>
            <DialogDescription>
              You don't have consent to view this patient's data yet. The patient needs to approve your consent request first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Once the patient approves your request, you'll be able to view their data here.
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const patientData = data.data;
  const consentedData = (patientData.consentedData || {}) as Record<string, any>;
  const consentInfo = patientData.consentInfo || [];
  
  // Check if there's no consent granted yet
  const hasNoConsent = Object.keys(consentedData).length === 0 && consentInfo.length === 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Patient Details - {patientData.patientId}
          </DialogTitle>
          <DialogDescription>
            Patient information you have access to based on granted consents
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Demographics - Always visible */}
          <Card>
            <CardHeader>
              <CardTitle>Demographics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">
                    {((patientData.demographics as any)?.firstName || '')} {((patientData.demographics as any)?.lastName || '')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Age</p>
                  <p className="font-medium">{(patientData.demographics as any)?.age || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gender</p>
                  <p className="font-medium">{(patientData.demographics as any)?.gender || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">
                    {(patientData.demographics as any)?.dateOfBirth
                      ? format(new Date((patientData.demographics as any).dateOfBirth), 'PPP')
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Show message if no consent */}
          {hasNoConsent && (
            <Card>
              <CardHeader>
                <CardTitle>No Active Consents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You don't have consent to view this patient's data yet. The patient needs to approve your consent request first.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Once the patient approves your request, you'll be able to view their data here.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Consent Information - Only show if there are consents */}
          {!hasNoConsent && (
            <Card>
              <CardHeader>
                <CardTitle>Active Consents</CardTitle>
              </CardHeader>
              <CardContent>
                {consentInfo.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active consents</p>
                ) : (
                <div className="space-y-2">
                  {consentInfo.map((consent, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Badge variant="outline" className="mr-2">
                          {consent.dataType}
                        </Badge>
                        <span className="text-sm">{consent.purpose}</span>
                      </div>
                      {consent.expirationTime && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          Expires: {format(new Date(consent.expirationTime), 'PPP')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {/* Medical Records - Only show if consent exists */}
          {!hasNoConsent && consentedData.medical_records ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Medical Records
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(consentedData.medical_records as any).conditions && (
                  <div>
                    <h4 className="font-semibold mb-2">Conditions</h4>
                    <div className="space-y-2">
                      {((consentedData.medical_records as any).conditions || []).map((condition: any, idx: number) => (
                        <div key={idx} className="border rounded p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{condition.name}</span>
                            <Badge variant="outline">{condition.code}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <span>Category: {condition.category}</span>
                            {condition.diagnosisDate && <span className="ml-4">Diagnosed: {format(new Date(condition.diagnosisDate), 'PPP')}</span>}
                            {condition.status && <span className="ml-4">Status: {condition.status}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(consentedData.medical_records as any).allergies && (
                  <div>
                    <h4 className="font-semibold mb-2">Allergies</h4>
                    <div className="space-y-2">
                      {((consentedData.medical_records as any).allergies || []).map((allergy: any, idx: number) => (
                        <div key={idx} className="border rounded p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{allergy.allergen}</span>
                            <Badge variant="destructive">{allergy.severity}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Reaction: {allergy.reaction}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(consentedData.medical_records as any).surgeries && (
                  <div>
                    <h4 className="font-semibold mb-2">Surgeries</h4>
                    <div className="space-y-2">
                      {((consentedData.medical_records as any).surgeries || []).map((surgery: any, idx: number) => (
                        <div key={idx} className="border rounded p-3">
                          <div className="font-medium">{surgery.procedure}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {surgery.date && <span>Date: {format(new Date(surgery.date), 'PPP')}</span>}
                            {surgery.surgeon && <span className="ml-4">Surgeon: {surgery.surgeon}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Prescription History - Only show if consent exists */}
          {!hasNoConsent && consentedData.prescription_history ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5" />
                  Prescription History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(consentedData.prescription_history) && (consentedData.prescription_history as any[]).map((med: any, idx: number) => (
                    <div key={idx} className="border rounded p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-lg">{med.name}</span>
                        <Badge variant="outline">{med.dosage}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>Frequency: {med.frequency}</div>
                        {med.startDate && <div>Start Date: {format(new Date(med.startDate), 'PPP')}</div>}
                        {med.prescriber && <div className="col-span-2">Prescriber: {med.prescriber}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Vital Signs - Only show if consent exists */}
          {!hasNoConsent && consentedData.vital_signs ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Vital Signs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(consentedData.vital_signs) && (consentedData.vital_signs as any[]).slice(0, 10).map((vital: any, idx: number) => (
                    <div key={idx} className="border rounded p-3">
                      <div className="text-sm text-muted-foreground mb-2">
                        {vital.timestamp && format(new Date(vital.timestamp), 'PPP p')}
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        {vital.bloodPressure && (
                          <div>
                            <div className="text-xs text-muted-foreground">Blood Pressure</div>
                            <div className="font-medium">{vital.bloodPressure.systolic}/{vital.bloodPressure.diastolic} mmHg</div>
                          </div>
                        )}
                        {vital.heartRate && (
                          <div>
                            <div className="text-xs text-muted-foreground">Heart Rate</div>
                            <div className="font-medium">{vital.heartRate} bpm</div>
                          </div>
                        )}
                        {vital.temperature && (
                          <div>
                            <div className="text-xs text-muted-foreground">Temperature</div>
                            <div className="font-medium">{vital.temperature} °C</div>
                          </div>
                        )}
                        {vital.oxygenSaturation && (
                          <div>
                            <div className="text-xs text-muted-foreground">O2 Saturation</div>
                            <div className="font-medium">{vital.oxygenSaturation}%</div>
                          </div>
                        )}
                        {vital.weight && (
                          <div>
                            <div className="text-xs text-muted-foreground">Weight</div>
                            <div className="font-medium">{vital.weight} kg</div>
                          </div>
                        )}
                        {vital.height && (
                          <div>
                            <div className="text-xs text-muted-foreground">Height</div>
                            <div className="font-medium">{vital.height} cm</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {Array.isArray(consentedData.vital_signs) && (consentedData.vital_signs as any[]).length > 10 && (
                    <div className="text-sm text-muted-foreground text-center">
                      Showing 10 of {(consentedData.vital_signs as any[]).length} records
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Laboratory Results - Only show if consent exists */}
          {!hasNoConsent && consentedData.laboratory_results ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  Laboratory Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.isArray(consentedData.laboratory_results) && (consentedData.laboratory_results as any[]).map((lab: any, idx: number) => (
                    <div key={idx} className="border rounded p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-semibold">{lab.testName}</div>
                          <div className="text-sm text-muted-foreground">Code: {lab.testCode}</div>
                        </div>
                        <Badge variant={lab.status === 'completed' ? 'default' : 'secondary'}>
                          {lab.status}
                        </Badge>
                      </div>
                      {lab.orderDate && (
                        <div className="text-sm text-muted-foreground mb-2">
                          Ordered: {format(new Date(lab.orderDate), 'PPP')}
                          {lab.resultDate && <span className="ml-4">Results: {format(new Date(lab.resultDate), 'PPP')}</span>}
                        </div>
                      )}
                      {lab.results && (
                        <div className="mt-3">
                          <div className="text-sm font-semibold mb-2">Results</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(lab.results).map(([key, value]: [string, any]) => (
                              <div key={key} className="flex justify-between border-b pb-1">
                                <span className="text-muted-foreground">{key}:</span>
                                <span className="font-medium">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {lab.referenceRange && Object.keys(lab.referenceRange).length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-semibold mb-2">Reference Ranges</div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            {Object.entries(lab.referenceRange).map(([key, value]: [string, any]) => (
                              <div key={key} className="flex justify-between">
                                <span>{key}:</span>
                                <span>{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {lab.orderingPhysician && (
                        <div className="text-sm text-muted-foreground mt-2">
                          Ordering Physician: {lab.orderingPhysician}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Imaging Studies - Only show if consent exists */}
          {!hasNoConsent && consentedData.imaging_data ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scan className="h-5 w-5" />
                  Imaging Studies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.isArray(consentedData.imaging_data) && (consentedData.imaging_data as any[]).map((study: any, idx: number) => (
                    <div key={idx} className="border rounded p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-semibold">{study.studyType}</div>
                          <div className="text-sm text-muted-foreground">
                            {study.modality} - {study.bodyPart}
                          </div>
                        </div>
                        <Badge variant={study.status === 'completed' ? 'default' : 'secondary'}>
                          {study.status}
                        </Badge>
                      </div>
                      {study.orderDate && (
                        <div className="text-sm text-muted-foreground mb-2">
                          Ordered: {format(new Date(study.orderDate), 'PPP')}
                          {study.performedDate && <span className="ml-4">Performed: {format(new Date(study.performedDate), 'PPP')}</span>}
                        </div>
                      )}
                      {study.findings && (
                        <div className="mt-3 p-3 bg-muted rounded">
                          <div className="text-sm font-semibold mb-1">Findings</div>
                          <div className="text-sm">{study.findings}</div>
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground mt-2 space-x-4">
                        {study.radiologist && <span>Radiologist: {study.radiologist}</span>}
                        {study.orderingPhysician && <span>Ordering: {study.orderingPhysician}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Genetic Data - Only show if consent exists */}
          {!hasNoConsent && consentedData.genetic_data ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dna className="h-5 w-5" />
                  Genetic Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(consentedData.genetic_data as any).sequencingDate && (
                  <div>
                    <div className="text-sm text-muted-foreground">Sequencing Date</div>
                    <div className="font-medium">
                      {format(new Date((consentedData.genetic_data as any).sequencingDate), 'PPP')}
                    </div>
                  </div>
                )}
                {(consentedData.genetic_data as any).variants && Array.isArray((consentedData.genetic_data as any).variants) && (
                  <div>
                    <h4 className="font-semibold mb-2">Genetic Variants</h4>
                    <div className="space-y-3">
                      {((consentedData.genetic_data as any).variants || []).map((variant: any, idx: number) => (
                        <div key={idx} className="border rounded p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{variant.gene}</span>
                            <Badge variant={variant.classification === 'Pathogenic' ? 'destructive' : 'outline'}>
                              {variant.classification}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Variant: {variant.variant}
                          </div>
                          {variant.significance && (
                            <div className="text-sm mt-1">{variant.significance}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(consentedData.genetic_data as any).pharmacogenomics && (
                  <div>
                    <h4 className="font-semibold mb-2">Pharmacogenomics</h4>
                    <div className="space-y-2">
                      {Object.entries((consentedData.genetic_data as any).pharmacogenomics || {}).map(([drug, info]: [string, any]) => (
                        <div key={drug} className="border rounded p-3">
                          <div className="font-medium">{drug}</div>
                          <div className="text-sm text-muted-foreground mt-1">{info}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Diagnostic Data - Only show if consent exists */}
          {!hasNoConsent && consentedData.diagnostic_data ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5" />
                  Diagnostic Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(consentedData.diagnostic_data as any).laboratoryResults && (
                  <div>
                    <h4 className="font-semibold mb-2">Laboratory Results</h4>
                    <div className="space-y-3">
                      {Array.isArray((consentedData.diagnostic_data as any).laboratoryResults) && 
                       ((consentedData.diagnostic_data as any).laboratoryResults as any[]).map((lab: any, idx: number) => (
                        <div key={idx} className="border rounded p-3">
                          <div className="font-medium">{lab.testName}</div>
                          <div className="text-sm text-muted-foreground">Code: {lab.testCode}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(consentedData.diagnostic_data as any).imagingStudies && (
                  <div>
                    <h4 className="font-semibold mb-2">Imaging Studies</h4>
                    <div className="space-y-3">
                      {Array.isArray((consentedData.diagnostic_data as any).imagingStudies) && 
                       ((consentedData.diagnostic_data as any).imagingStudies as any[]).map((study: any, idx: number) => (
                        <div key={idx} className="border rounded p-3">
                          <div className="font-medium">{study.studyType}</div>
                          <div className="text-sm text-muted-foreground">{study.modality} - {study.bodyPart}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Treatment History - Only show if consent exists */}
          {!hasNoConsent && consentedData.treatment_history ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Treatment History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(consentedData.treatment_history as any).conditions && (
                  <div>
                    <h4 className="font-semibold mb-2">Conditions</h4>
                    <div className="space-y-2">
                      {Array.isArray((consentedData.treatment_history as any).conditions) && 
                       ((consentedData.treatment_history as any).conditions as any[]).map((condition: any, idx: number) => (
                        <div key={idx} className="border rounded p-3">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{condition.name}</span>
                            <Badge variant="outline">{condition.code}</Badge>
                          </div>
                          {condition.diagnosisDate && (
                            <div className="text-sm text-muted-foreground mt-1">
                              Diagnosed: {format(new Date(condition.diagnosisDate), 'PPP')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(consentedData.treatment_history as any).surgeries && (
                  <div>
                    <h4 className="font-semibold mb-2">Surgeries</h4>
                    <div className="space-y-2">
                      {Array.isArray((consentedData.treatment_history as any).surgeries) && 
                       ((consentedData.treatment_history as any).surgeries as any[]).map((surgery: any, idx: number) => (
                        <div key={idx} className="border rounded p-3">
                          <div className="font-medium">{surgery.procedure}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {surgery.date && <span>Date: {format(new Date(surgery.date), 'PPP')}</span>}
                            {surgery.surgeon && <span className="ml-4">Surgeon: {surgery.surgeon}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Show unavailable data types if any */}
          {(patientData as any).unavailableDataTypes && (patientData as any).unavailableDataTypes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Data Not Available</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  The following data types are available for this patient but you do not have consent to access:
                </p>
                <div className="flex flex-wrap gap-2">
                  {((patientData as any).unavailableDataTypes || []).map((dataType: string) => (
                    <Badge key={dataType} variant="secondary">{dataType}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* This message is now shown in the "No Active Consents" card above when hasNoConsent is true */}
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

