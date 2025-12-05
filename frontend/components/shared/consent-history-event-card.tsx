'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ColoredBadge, ColoredBadgeList } from '@/components/shared/colored-badge';
import { Button } from '@/components/ui/button';
import { FileCheck, X, Clock, MessageSquare, Users, Building2, Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface ConsentHistoryEvent {
  type: string;
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
  providerInfo?: {
    organizationName?: string;
    providerType?: string;
  } | null;
  patientInfo?: {
    patientId?: string;
    firstName?: string;
    lastName?: string;
  } | null;
  isExpired?: boolean;
}

interface ConsentHistoryEventCardProps {
  event: ConsentHistoryEvent;
  onClose: () => void;
  userRole?: 'patient' | 'provider';
}

export function ConsentHistoryEventCard({ event, onClose, userRole = 'patient' }: ConsentHistoryEventCardProps) {
  // Determine event type and styling
  let eventType = '';
  let eventIcon = null;
  let eventColor = '';
  let statusBadge = null;

  if (event.type === 'ConsentGranted') {
    eventType = 'Consent Granted';
    eventIcon = <FileCheck className="h-5 w-5 text-green-500" />;
    eventColor = 'text-green-600';
    statusBadge = <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Granted</Badge>;
  } else if (event.type === 'ConsentRevoked') {
    eventType = 'Consent Revoked';
    eventIcon = <X className="h-5 w-5 text-red-500" />;
    eventColor = 'text-red-600';
    statusBadge = <Badge variant="destructive">Revoked</Badge>;
  } else if (event.type === 'ConsentExpired') {
    eventType = 'Consent Expired';
    eventIcon = <Clock className="h-5 w-5 text-orange-500" />;
    eventColor = 'text-orange-600';
    statusBadge = <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Expired</Badge>;
  } else if (event.type === 'AccessRequested') {
    eventType = userRole === 'patient' ? 'Request Received' : 'Request Sent';
    eventIcon = <MessageSquare className="h-5 w-5 text-blue-500" />;
    eventColor = 'text-blue-600';
    statusBadge = <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Pending</Badge>;
  } else if (event.type === 'AccessApproved') {
    eventType = 'Request Approved';
    eventIcon = <FileCheck className="h-5 w-5 text-green-500" />;
    eventColor = 'text-green-600';
    statusBadge = <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
  } else if (event.type === 'AccessDenied') {
    eventType = 'Request Denied';
    eventIcon = <X className="h-5 w-5 text-red-500" />;
    eventColor = 'text-red-600';
    statusBadge = <Badge variant="destructive">Denied</Badge>;
  }

  const isExpired = event.isExpired || (event.type === 'ConsentGranted' && event.expirationTime && 
    new Date(event.expirationTime) < new Date());

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {eventIcon}
            {eventType}
          </DialogTitle>
          <DialogDescription>
            Detailed information about this consent event
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Timestamp */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {statusBadge}
              </div>
              {isExpired && event.type === 'ConsentGranted' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expiration Status</span>
                  <Badge variant="destructive">Expired</Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Timestamp</span>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {format(new Date(event.timestamp), 'MMMM d, yyyy HH:mm:ss')}
                  </span>
                </div>
              </div>
              {event.blockNumber !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Block Number</span>
                  <span className="text-sm font-mono">{event.blockNumber}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Provider/Patient Information */}
          {(userRole === 'patient' && event.providerInfo) || (userRole === 'provider' && event.patientInfo) ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {userRole === 'patient' ? 'Provider Information' : 'Patient Information'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {userRole === 'patient' && event.providerInfo ? (
                  <>
                    {event.providerInfo.organizationName && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Organization</p>
                        <p className="font-semibold">{event.providerInfo.organizationName}</p>
                      </div>
                    )}
                    {event.providerInfo.providerType && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Provider Type</p>
                        <p className="text-sm capitalize">{event.providerInfo.providerType.replace(/_/g, ' ')}</p>
                      </div>
                    )}
                    {event.provider && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Provider Address</p>
                        <p className="text-sm font-mono break-all">{event.provider}</p>
                      </div>
                    )}
                  </>
                ) : userRole === 'provider' && event.patientInfo ? (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Patient Name</p>
                      <p className="font-semibold">
                        {event.patientInfo.firstName} {event.patientInfo.lastName}
                      </p>
                    </div>
                    {event.patientInfo.patientId && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Patient ID</p>
                        <p className="text-sm font-mono">{event.patientInfo.patientId}</p>
                      </div>
                    )}
                    {event.patient && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Patient Address</p>
                        <p className="text-sm font-mono break-all">{event.patient}</p>
                      </div>
                    )}
                  </>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {/* Consent/Request Details */}
          {(event.consentId !== undefined || event.requestId !== undefined || event.dataType || event.purpose) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {event.consentId !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Consent ID</span>
                    <span className="text-sm font-mono font-semibold">{event.consentId}</span>
                  </div>
                )}
                {event.requestId !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Request ID</span>
                    <span className="text-sm font-mono font-semibold">{event.requestId}</span>
                  </div>
                )}
                {event.dataTypes && event.dataTypes.length > 0 ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Data Types</p>
                    <ColoredBadgeList type="dataType" values={event.dataTypes} size="md" />
                  </div>
                ) : event.dataType && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Data Type</p>
                    <ColoredBadge type="dataType" value={event.dataType} size="md" />
                  </div>
                )}
                {event.purposes && event.purposes.length > 0 ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Purposes</p>
                    <ColoredBadgeList type="purpose" values={event.purposes} size="md" />
                  </div>
                ) : event.purpose && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Purpose</p>
                    <ColoredBadge type="purpose" value={event.purpose} size="md" />
                  </div>
                )}
                {event.expirationTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Expiration Date</span>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {format(new Date(event.expirationTime), 'MMMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                )}
                {!event.expirationTime && (event.type === 'ConsentGranted' || event.type === 'AccessRequested') && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Expiration</span>
                    <Badge variant="secondary">No expiration</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Transaction Information */}
          {event.transactionHash && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Blockchain Transaction</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Transaction Hash</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono break-all">{event.transactionHash}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          // In a real app, this would link to a block explorer
                          navigator.clipboard.writeText(event.transactionHash || '');
                        }}
                        title="Copy transaction hash"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

