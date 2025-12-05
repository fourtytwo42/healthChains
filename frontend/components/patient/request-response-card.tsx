'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAccessRequest, useApproveRequest, useDenyRequest } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Calendar, FileText, Check, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RequestResponseCardProps {
  requestId: number;
  onClose: () => void;
}

/**
 * Request Response Card Component
 * Allows patients to approve or deny access requests
 */
export function RequestResponseCard({ requestId, onClose }: RequestResponseCardProps) {
  const { data: request, isLoading, error } = useAccessRequest(requestId);
  const approveRequest = useApproveRequest();
  const denyRequest = useDenyRequest();

  const handleApprove = async () => {
    try {
      await approveRequest.mutateAsync({ requestId });
      onClose();
    } catch (error) {
      console.error('Failed to approve request:', error);
    }
  };

  const handleDeny = async () => {
    try {
      await denyRequest.mutateAsync({ requestId });
      onClose();
    } catch (error) {
      console.error('Failed to deny request:', error);
    }
  };

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Request</DialogTitle>
            <DialogDescription>Loading request details...</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !request) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
            <DialogDescription>
              Failed to load request details. {error?.message || 'Unknown error'}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={onClose}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  const requestData = request;

  // Check if request is already processed
  const isProcessed = requestData.status !== 'pending';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Access Request</DialogTitle>
          <DialogDescription>
            Review the provider's request for access to your health data
          </DialogDescription>
        </DialogHeader>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Provider Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(requestData as any).provider ? (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Organization</p>
                    <p className="font-semibold text-lg">{(requestData as any).provider.organizationName}</p>
                    {(requestData as any).provider.providerType && (
                      <p className="text-xs text-muted-foreground capitalize">
                        {(requestData as any).provider.providerType.replace(/_/g, ' ')}
                      </p>
                    )}
                  </div>
                  {(requestData as any).provider.specialties && (requestData as any).provider.specialties.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Specialties</p>
                      <div className="flex flex-wrap gap-1">
                        {(requestData as any).provider.specialties.slice(0, 3).map((specialty: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(requestData as any).provider.contact && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Contact</p>
                      <p className="text-sm">{((requestData as any).provider.contact.email || '').replace('contact@', '')}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Provider Address</p>
                    <p className="font-mono text-xs text-muted-foreground">{requestData.requester || 'Unknown'}</p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Provider Address</p>
                  <p className="font-mono text-sm">{requestData.requester || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground mt-1">Provider information not available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Requested Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Data Type</p>
              {requestData.dataType ? (
                <Badge variant="outline" className="text-base py-1">
                  {requestData.dataType}
                </Badge>
              ) : (
                <p className="text-sm">Not specified</p>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-1">Purpose</p>
              <p className="text-sm font-medium">{requestData.purpose || 'Not specified'}</p>
            </div>

            {requestData.expirationTime && (
              <div>
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Expiration
                </p>
                <p className="text-sm">
                  {format(new Date(requestData.expirationTime), 'PPP')}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground mb-1">Request Date</p>
              <p className="text-sm">
                {format(new Date(requestData.timestamp), 'PPP p')}
              </p>
            </div>

            {isProcessed && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge
                  variant={
                    requestData.status === 'approved'
                      ? 'default'
                      : requestData.status === 'denied'
                      ? 'destructive'
                      : 'outline'
                  }
                >
                  {requestData.status}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {isProcessed ? 'Close' : 'Cancel'}
          </Button>
          {!isProcessed && (
            <>
              <Button
                variant="destructive"
                onClick={handleDeny}
                disabled={denyRequest.isPending || approveRequest.isPending}
              >
                {denyRequest.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Denying...
                  </>
                ) : (
                  <>
                    <X className="mr-2 h-4 w-4" />
                    Deny
                  </>
                )}
              </Button>
              <Button
                onClick={handleApprove}
                disabled={approveRequest.isPending || denyRequest.isPending}
              >
                {approveRequest.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

