'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ColoredBadge, ColoredBadgeList } from '@/components/shared/colored-badge';
import { Button } from '@/components/ui/button';
import React from 'react';
import { FileCheck, X, Clock, MessageSquare, Users, Building2, Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ProviderInfoSection } from '@/components/shared/provider-info-section';
import { apiClient } from '@/lib/api-client';
import { useState, useEffect } from 'react';
import type { ConsentHistoryEvent } from '@/types/consent';

interface ConsentHistoryEventCardProps {
  event: ConsentHistoryEvent;
  onClose: () => void;
  userRole?: 'patient' | 'provider';
}

export function ConsentHistoryEventCard({ event, onClose, userRole = 'patient' }: ConsentHistoryEventCardProps) {
  const [fullProviderInfo, setFullProviderInfo] = useState<any>(null);
  const [loadingProvider, setLoadingProvider] = useState(false);

  // Provider info should already be included in event from backend
  // Only fetch if completely missing
  useEffect(() => {
    const fetchProviderInfo = async () => {
      // If providerInfo is already included from backend, use it
      if (event.providerInfo && event.providerInfo.organizationName) {
        setFullProviderInfo(event.providerInfo);
        return;
      }
      
      // If we have provider address but no info, we can't fetch it (patients can't access /api/providers)
      // The backend should include providerInfo in events, so this shouldn't happen
      if (userRole === 'patient' && event.provider && !event.providerInfo) {
        console.warn('Provider info missing from event, backend should include it:', event);
        setFullProviderInfo(null);
      }
    };

    fetchProviderInfo();
  }, [event.provider, event.providerInfo, userRole]);

  // Use full provider info if available, otherwise use event.providerInfo
  const providerInfo = fullProviderInfo || event.providerInfo;

  // Determine event type and styling
  let eventType = '';
  let eventIcon = null;
  let eventColor = '';
  let statusBadge = null;

  if (event.type === 'ConsentGranted') {
    eventType = 'Consent Granted';
    eventIcon = <FileCheck className="h-4 w-4 text-green-500" />;
    eventColor = 'text-green-600';
    statusBadge = <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs h-5">Granted</Badge>;
  } else if (event.type === 'ConsentRevoked') {
    eventType = 'Consent Revoked';
    eventIcon = <X className="h-4 w-4 text-red-500" />;
    eventColor = 'text-red-600';
    statusBadge = <Badge variant="destructive" className="text-xs h-5">Revoked</Badge>;
  } else if (event.type === 'ConsentExpired') {
    eventType = 'Consent Expired';
    eventIcon = <Clock className="h-4 w-4 text-orange-500" />;
    eventColor = 'text-orange-600';
    statusBadge = <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs h-5">Expired</Badge>;
  } else if (event.type === 'AccessRequested') {
    eventType = userRole === 'patient' ? 'Request Received' : 'Request Sent';
    eventIcon = <MessageSquare className="h-4 w-4 text-blue-500" />;
    eventColor = 'text-blue-600';
    statusBadge = <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs h-5">Pending</Badge>;
  } else if (event.type === 'AccessApproved') {
    eventType = 'Request Approved';
    eventIcon = <FileCheck className="h-4 w-4 text-green-500" />;
    eventColor = 'text-green-600';
    statusBadge = <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs h-5">Approved</Badge>;
  } else if (event.type === 'AccessDenied') {
    eventType = 'Request Denied';
    eventIcon = <X className="h-4 w-4 text-red-500" />;
    eventColor = 'text-red-600';
    statusBadge = <Badge variant="destructive" className="text-xs h-5">Denied</Badge>;
  }

  const isExpired = event.isExpired || (event.type === 'ConsentGranted' && event.expirationTime && 
    new Date(event.expirationTime) < new Date());

  // Format patient information for display (matching granted consent details card format)
  const patientName = event.patientInfo
    ? `${event.patientInfo.firstName || ''} ${event.patientInfo.lastName || ''}`.trim()
    : 'N/A';
  const patientAddress = event.patientInfo?.address
    ? `${event.patientInfo.address.street || ''}, ${event.patientInfo.address.city || ''}, ${event.patientInfo.address.state || ''} ${event.patientInfo.address.zipCode || ''}`
    : 'N/A';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {eventIcon && React.cloneElement(eventIcon, { className: 'h-4 w-4' })}
            {eventType}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Detailed information about this consent event
          </DialogDescription>
          
          {/* Patient Info - Consolidated format matching granted consent details card */}
          {userRole === 'provider' && event.patientInfo && (
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-base mb-1">{patientName}</p>
                <p className="text-muted-foreground text-xs">
                  {event.patientInfo.dateOfBirth ? `DOB: ${format(new Date(event.patientInfo.dateOfBirth), 'MMM d, yyyy')}` : ''}
                  {event.patientInfo.age !== undefined ? ` • Age: ${event.patientInfo.age}` : ''}
                  {event.patientInfo.gender ? ` • ${event.patientInfo.gender}` : ''}
                </p>
                {event.patientInfo.patientId && (
                  <p className="text-muted-foreground text-xs font-mono mt-1">
                    <strong>Patient ID:</strong> {event.patientInfo.patientId}
                  </p>
                )}
                {event.patient && (
                  <p className="text-muted-foreground text-xs font-mono mt-1">
                    <strong>Wallet:</strong> {event.patient.slice(0, 6)}...{event.patient.slice(-4)}
                  </p>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {event.patientInfo.contact?.phone && (
                  <p><strong>Phone:</strong> {event.patientInfo.contact.phone}</p>
                )}
                {event.patientInfo.contact?.email && (
                  <p><strong>Email:</strong> {event.patientInfo.contact.email}</p>
                )}
                {patientAddress !== 'N/A' && (
                  <p><strong>Address:</strong> {patientAddress}</p>
                )}
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
          {/* Status and Timestamp */}
          <Card className="py-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Event Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  {statusBadge}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Timestamp</p>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-xs">
                      {format(new Date(event.timestamp), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                </div>
                {isExpired && event.type === 'ConsentGranted' && (
                  <div>
                    <p className="text-xs text-muted-foreground">Expiration Status</p>
                    <Badge variant="destructive" className="text-xs h-4">Expired</Badge>
                  </div>
                )}
                {event.blockNumber !== undefined && (
                  <div>
                    <p className="text-xs text-muted-foreground">Block Number</p>
                    <span className="text-xs font-mono">{event.blockNumber}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Provider Information (for patient role) */}
          {userRole === 'patient' && event.provider ? (
            <Card className="py-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  Provider Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ProviderInfoSection
                  providerInfo={providerInfo}
                  providerAddress={event.provider}
                  loading={loadingProvider}
                  showAddress={false}
                />
              </CardContent>
            </Card>
          ) : null}

          {/* Consent/Request Details */}
          {(event.consentId !== undefined || event.requestId !== undefined || event.dataType || event.purpose) && (
            <Card className="py-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-3">
                  {event.consentId !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Consent ID</p>
                      <span className="text-sm font-mono font-semibold">#{event.consentId}</span>
                    </div>
                  )}
                  {event.requestId !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Request ID</p>
                      <span className="text-sm font-mono font-semibold">#{event.requestId}</span>
                    </div>
                  )}
                  {event.dataTypes && event.dataTypes.length > 0 ? (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Data Types</p>
                      <ColoredBadgeList type="dataType" values={event.dataTypes} size="sm" />
                    </div>
                  ) : event.dataType && (
                    <div>
                      <p className="text-xs text-muted-foreground">Data Type</p>
                      <ColoredBadge type="dataType" value={event.dataType} size="sm" />
                    </div>
                  )}
                  {event.purposes && event.purposes.length > 0 ? (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Purposes</p>
                      <ColoredBadgeList type="purpose" values={event.purposes} size="sm" />
                    </div>
                  ) : event.purpose && (
                    <div>
                      <p className="text-xs text-muted-foreground">Purpose</p>
                      <ColoredBadge type="purpose" value={event.purpose} size="sm" />
                    </div>
                  )}
                  {event.expirationTime && (
                    <div>
                      <p className="text-xs text-muted-foreground">Expiration Date</p>
                      <div className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date(event.expirationTime), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                    </div>
                  )}
                  {!event.expirationTime && (event.type === 'ConsentGranted' || event.type === 'AccessRequested') && (
                    <div>
                      <p className="text-xs text-muted-foreground">Expiration</p>
                      <Badge variant="secondary" className="text-xs h-4">No expiration</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction Information */}
          {event.transactionHash && (
            <Card className="py-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Blockchain Transaction</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div>
                  <p className="text-xs text-muted-foreground">Transaction Hash</p>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-mono break-all">{event.transactionHash}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 flex-shrink-0"
                      onClick={() => {
                        // In a real app, this would link to a block explorer
                        navigator.clipboard.writeText(event.transactionHash || '');
                      }}
                      title="Copy transaction hash"
                      aria-label="Copy transaction hash to clipboard"
                    >
                      <ExternalLink className="h-2 w-2" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end pt-1.5 border-t flex-shrink-0 mt-2">
          <Button size="sm" onClick={onClose} aria-label="Close consent history event details">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

