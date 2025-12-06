'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAccessRequest } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Calendar, FileText, Clock, Copy } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ColoredBadgeList } from '@/components/shared/colored-badge';

interface RequestDetailsCardProps {
  requestId: number;
  onClose: () => void;
}

/**
 * Request Details Card Component
 * Allows providers to view details of their access requests (read-only)
 */
export function RequestDetailsCard({ requestId, onClose }: RequestDetailsCardProps) {
  const { data: request, isLoading, error } = useAccessRequest(requestId);

  // Copy to clipboard handler
  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy address');
      console.error('Failed to copy:', error);
    }
  };

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-3 flex-shrink-0">
            <DialogTitle className="text-lg">Request Details</DialogTitle>
            <DialogDescription className="text-xs">Loading request details...</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="flex justify-end pt-3 border-t flex-shrink-0 mt-2">
            <Button size="sm" onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !request) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-3 flex-shrink-0">
            <DialogTitle className="text-lg">Error</DialogTitle>
            <DialogDescription className="text-xs">
              Failed to load request details. {error?.message || 'Unknown error'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-3 border-t flex-shrink-0 mt-2">
            <Button size="sm" onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const requestData = request as any;
  const patientName = requestData.patient
    ? `${requestData.patient.firstName} ${requestData.patient.lastName}`
    : null;
  const patientId = requestData.patient?.patientId || null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-4 w-4" />
            Request Details
          </DialogTitle>
          <DialogDescription className="text-xs">
            View details of your access request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          {/* Patient Information */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Users className="h-3 w-3" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              {patientName ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Patient Name</p>
                  <p className="font-semibold text-xs">{patientName}</p>
                </div>
              ) : null}
              {patientId ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Patient ID</p>
                  <p className="text-xs font-mono">{patientId}</p>
                </div>
              ) : null}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Patient Address</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs font-mono break-all">{requestData.patientAddress}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 flex-shrink-0"
                    onClick={() => handleCopyAddress(requestData.patientAddress)}
                    title="Copy address"
                    aria-label="Copy patient address to clipboard"
                  >
                    <Copy className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Request Details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <FileText className="h-3 w-3" />
                Requested Access
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Data Types</p>
                  {requestData.dataTypes && requestData.dataTypes.length > 0 ? (
                    <ColoredBadgeList type="dataType" values={requestData.dataTypes} size="sm" />
                  ) : (
                    <span className="text-xs text-muted-foreground">N/A</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Purposes</p>
                  {requestData.purposes && requestData.purposes.length > 0 ? (
                    <ColoredBadgeList type="purpose" values={requestData.purposes} size="sm" />
                  ) : (
                    <span className="text-xs text-muted-foreground">N/A</span>
                  )}
                </div>
              </div>
              {requestData.dataTypes && requestData.purposes && 
               requestData.dataTypes.length > 0 && requestData.purposes.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground">
                    This request will create {requestData.dataTypes.length * requestData.purposes.length} consent record(s) if approved.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Request Information */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3 w-3" />
                Request Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Request ID</p>
                  <p className="text-xs font-mono font-semibold">#{requestData.requestId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800 text-xs h-4">
                    {requestData.status === 'pending' ? 'Pending' : requestData.status === 'approved' ? 'Approved' : 'Denied'}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Request Date</p>
                  <div className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-xs">
                      {format(new Date(requestData.timestamp), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Expiration</p>
                  {requestData.expirationTime ? (
                    <div className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-xs">
                        {format(new Date(requestData.expirationTime), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-xs h-4">No expiration</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-2 border-t flex-shrink-0 mt-2">
          <Button size="sm" onClick={onClose} aria-label="Close request details">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

