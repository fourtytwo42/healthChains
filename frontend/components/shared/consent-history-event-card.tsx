'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ColoredBadge, ColoredBadgeList } from '@/components/shared/colored-badge';
import { Button } from '@/components/ui/button';
import React from 'react';
import { FileCheck, X, Clock, MessageSquare, Users, Building2, Calendar, ExternalLink, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { ProviderInfoSection } from '@/components/shared/provider-info-section';
import { apiClient } from '@/lib/api-client';
import { useState, useEffect } from 'react';
import type { ConsentHistoryEvent } from '@/types/consent';
import { toast } from 'sonner';

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

  // Format provider information for display (matching consolidated format)
  const providerName = providerInfo?.organizationName || 'Unknown Provider';
  const providerType = providerInfo?.providerType 
    ? providerInfo.providerType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    : null;
  const providerAddressFormatted = providerInfo?.address
    ? `${providerInfo.address.street || ''}, ${providerInfo.address.city || ''}, ${providerInfo.address.state || ''} ${providerInfo.address.zipCode || ''}`
    : 'N/A';
  
  // Google Maps URL for provider address
  const googleMapsUrl = providerAddressFormatted !== 'N/A' 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(providerAddressFormatted)}`
    : null;
  
  // Copy wallet address handler
  const handleCopyWalletAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Wallet address copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy wallet address');
      console.error('Failed to copy:', error);
    }
  };

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
            <div className="mt-4 text-sm">
              {/* Patient Name - Full width row */}
              <div className="mb-3">
                <p className="font-semibold text-base">{patientName}</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {event.patientInfo.dateOfBirth ? `DOB: ${format(new Date(event.patientInfo.dateOfBirth), 'MMM d, yyyy')}` : ''}
                  {event.patientInfo.age !== undefined ? ` • Age: ${event.patientInfo.age}` : ''}
                  {event.patientInfo.gender ? ` • ${event.patientInfo.gender}` : ''}
                </p>
              </div>
              
              {/* Two column layout below name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {event.patientInfo.patientId && (
                    <p className="text-muted-foreground text-xs font-mono mb-2">
                      <strong>Patient ID:</strong> {event.patientInfo.patientId}
                    </p>
                  )}
                  {event.patient && (
                    <p className="text-muted-foreground text-xs font-mono">
                      <strong>Wallet:</strong> {event.patient.slice(0, 6)}...{event.patient.slice(-4)}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {event.patientInfo.contact?.phone && (
                    <p>
                      <strong>Phone:</strong>{' '}
                      <a 
                        href={`tel:${event.patientInfo.contact.phone}`}
                        className="text-primary hover:underline"
                      >
                        {event.patientInfo.contact.phone}
                      </a>
                    </p>
                  )}
                  {event.patientInfo.contact?.email && (
                    <p>
                      <strong>Email:</strong>{' '}
                      <a 
                        href={`mailto:${event.patientInfo.contact.email}`}
                        className="text-primary hover:underline"
                      >
                        {event.patientInfo.contact.email}
                      </a>
                    </p>
                  )}
                  {patientAddress !== 'N/A' && (
                    <p>
                      <strong>Address:</strong>{' '}
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(patientAddress)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {patientAddress}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Provider Info - Consolidated format matching patient info format */}
          {userRole === 'patient' && event.provider && providerInfo && (
            <div className="mt-4 text-sm">
              {/* Provider Name - Full width row */}
              <div className="mb-3">
                <p className="font-semibold text-base">{providerName}</p>
                {providerType && (
                  <p className="text-muted-foreground text-xs capitalize mt-0.5">
                    {providerType}
                  </p>
                )}
              </div>
              
              {/* Two column layout below name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {providerInfo.specialties && providerInfo.specialties.length > 0 && (
                    <div className="mb-2">
                      <ColoredBadgeList
                        type="specialty"
                        values={providerInfo.specialties}
                        maxDisplay={3}
                        size="sm"
                      />
                    </div>
                  )}
                  {event.provider && (
                    <div className="flex items-center gap-1.5">
                      <p className="text-muted-foreground text-xs font-mono">
                        <strong>Wallet:</strong>{' '}
                        <button
                          onClick={() => handleCopyWalletAddress(event.provider || '')}
                          className="text-primary hover:underline cursor-pointer text-left flex items-center gap-1"
                          title="Click to copy full wallet address"
                        >
                          {event.provider.slice(0, 6)}...{event.provider.slice(-4)}
                          <Copy className="h-3 w-3" />
                        </button>
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {providerInfo.contact?.phone && (
                    <p>
                      <strong>Phone:</strong>{' '}
                      <a 
                        href={`tel:${providerInfo.contact.phone}`}
                        className="text-primary hover:underline"
                      >
                        {providerInfo.contact.phone}
                      </a>
                    </p>
                  )}
                  {providerInfo.contact?.email && (
                    <p>
                      <strong>Email:</strong>{' '}
                      <a 
                        href={`mailto:${providerInfo.contact.email}`}
                        className="text-primary hover:underline"
                      >
                        {providerInfo.contact.email}
                      </a>
                    </p>
                  )}
                  {providerInfo.contact?.website && (
                    <p>
                      <strong>Website:</strong>{' '}
                      <a 
                        href={providerInfo.contact.website.startsWith('http') ? providerInfo.contact.website : `https://${providerInfo.contact.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {providerInfo.contact.website}
                      </a>
                    </p>
                  )}
                  {providerAddressFormatted !== 'N/A' && googleMapsUrl && (
                    <p>
                      <strong>Address:</strong>{' '}
                      <a 
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {providerAddressFormatted}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {/* Event Summary - Compact header info */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  {statusBadge}
                  {isExpired && event.type === 'ConsentGranted' && (
                    <Badge variant="destructive" className="text-xs h-5">Expired</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(new Date(event.timestamp), 'MMM d, yyyy HH:mm')}</span>
                </div>
              </div>
              {(event.consentId !== undefined || event.requestId !== undefined) && (
                <div className="flex items-center gap-4 mt-3 pt-3 border-t">
                  {event.consentId !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Consent ID</p>
                      <span className="text-sm font-mono font-semibold">#{event.consentId}</span>
                    </div>
                  )}
                  {event.requestId !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Request ID</p>
                      <span className="text-sm font-mono font-semibold">#{event.requestId}</span>
                    </div>
                  )}
                  {event.blockNumber !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Block</p>
                      <span className="text-sm font-mono">{event.blockNumber}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data Types and Purposes */}
          {(event.dataTypes || event.dataType || event.purposes || event.purpose) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Access Details</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {event.dataTypes && event.dataTypes.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Data Types</p>
                    <ColoredBadgeList type="dataType" values={event.dataTypes} size="sm" />
                  </div>
                ) : event.dataType && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Data Type</p>
                    <ColoredBadge type="dataType" value={event.dataType} size="sm" />
                  </div>
                )}
                {event.purposes && event.purposes.length > 0 ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Purposes</p>
                    <ColoredBadgeList type="purpose" values={event.purposes} size="sm" />
                  </div>
                ) : event.purpose && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Purpose</p>
                    <ColoredBadge type="purpose" value={event.purpose} size="sm" />
                  </div>
                )}
                {(event.expirationTime || (!event.expirationTime && (event.type === 'ConsentGranted' || event.type === 'AccessRequested'))) && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1.5">Expiration</p>
                    {event.expirationTime ? (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date(event.expirationTime), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-xs h-5">No expiration</Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Blockchain Transaction */}
          {event.transactionHash && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Blockchain Transaction
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Transaction Hash</p>
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <p className="text-xs font-mono break-all flex-1">{event.transactionHash}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(event.transactionHash || '');
                          toast.success('Transaction hash copied to clipboard');
                        } catch (error) {
                          toast.error('Failed to copy transaction hash');
                        }
                      }}
                      title="Copy transaction hash"
                      aria-label="Copy transaction hash to clipboard"
                    >
                      <Copy className="h-3 w-3" />
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

