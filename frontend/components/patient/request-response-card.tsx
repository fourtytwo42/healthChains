'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAccessRequest, useApproveRequest, useDenyRequest } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Calendar, FileText, Check, X, Loader2, Copy, ExternalLink, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { ColoredBadge, ColoredBadgeList } from '@/components/shared/colored-badge';
import { extractDomain, getFullUrl } from '@/lib/badge-utils';
import { ProviderInfoSection } from '@/components/shared/provider-info-section';

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
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-3 flex-shrink-0">
            <DialogTitle className="text-lg">Access Request</DialogTitle>
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

  const requestData = request;

  // Check if request is already processed
  const isProcessed = requestData.status !== 'pending';

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

  // Format provider information for display (matching consolidated format)
  const providerInfo = (requestData as any).provider || null;
  const providerAddress = requestData.requester || 'Unknown';
  const providerName = providerInfo?.organizationName || 'Unknown Provider';
  const providerType = providerInfo?.providerType 
    ? providerInfo.providerType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    : null;
  const providerAddressFormatted = providerInfo?.address
    ? `${providerInfo.address.street || ''}, ${providerInfo.address.city || ''}, ${providerInfo.address.state || ''} ${providerInfo.address.zipCode || ''}`
    : 'N/A';

  return (
    <TooltipProvider>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="pb-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-4 w-4" />
              Access Request
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review the provider's request for access to your health data
            </DialogDescription>
            
            {/* Provider Info - Consolidated format matching patient info format */}
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-base mb-1">{providerName}</p>
                {providerType && (
                  <p className="text-muted-foreground text-xs capitalize">
                    {providerType}
                  </p>
                )}
                {providerInfo?.specialties && providerInfo.specialties.length > 0 && (
                  <div className="mt-1">
                    <ColoredBadgeList
                      type="specialty"
                      values={providerInfo.specialties}
                      maxDisplay={3}
                      size="sm"
                    />
                  </div>
                )}
                {providerAddress && providerAddress !== 'Unknown' && (
                  <p className="text-muted-foreground text-xs font-mono mt-1">
                    <strong>Wallet:</strong> {providerAddress.slice(0, 6)}...{providerAddress.slice(-4)}
                  </p>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {providerInfo?.contact?.phone && (
                  <p><strong>Phone:</strong> {providerInfo.contact.phone}</p>
                )}
                {providerInfo?.contact?.email && (
                  <p><strong>Email:</strong> {providerInfo.contact.email}</p>
                )}
                {providerInfo?.contact?.website && (
                  <p><strong>Website:</strong> {providerInfo.contact.website}</p>
                )}
                {providerAddressFormatted !== 'N/A' && (
                  <p><strong>Address:</strong> {providerAddressFormatted}</p>
                )}
              </div>
            </div>
          </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-3">

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Requested Access
            </CardTitle>
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">Request Date</p>
              <p className="text-xs">
                {format(new Date(requestData.timestamp), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Purposes</p>
                {requestData.purposes && requestData.purposes.length > 0 ? (
                  <ColoredBadgeList type="purpose" values={requestData.purposes} size="sm" />
                ) : (
                  <p className="text-xs text-muted-foreground">No purposes specified</p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Data Types</p>
                {requestData.dataTypes && requestData.dataTypes.length > 0 ? (
                  <ColoredBadgeList type="dataType" values={requestData.dataTypes} size="sm" />
                ) : (
                  <p className="text-xs text-muted-foreground">No data types specified</p>
                )}
              </div>
            </div>

            {requestData.expirationTime && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Expiration
                </p>
                <p className="text-xs">
                  {format(new Date(requestData.expirationTime), 'MMM d, yyyy HH:mm')}
                </p>
              </div>
            )}

            {isProcessed && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Badge
                  variant={
                    requestData.status === 'approved'
                      ? 'default'
                      : requestData.status === 'denied'
                      ? 'destructive'
                      : 'outline'
                  }
                  className="text-xs h-5"
                >
                  {requestData.status}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t flex-shrink-0 mt-2">
          <Button variant="outline" size="sm" onClick={onClose} aria-label={isProcessed ? "Close request response" : "Cancel request response"}>
            {isProcessed ? 'Close' : 'Cancel'}
          </Button>
          {!isProcessed && (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeny}
                disabled={denyRequest.isPending || approveRequest.isPending}
              >
                {denyRequest.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Denying...
                  </>
                ) : (
                  <>
                    <X className="mr-1.5 h-3 w-3" />
                    Deny
                  </>
                )}
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={approveRequest.isPending || denyRequest.isPending}
              >
                {approveRequest.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <Check className="mr-1.5 h-3 w-3" />
                    Approve
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
}

