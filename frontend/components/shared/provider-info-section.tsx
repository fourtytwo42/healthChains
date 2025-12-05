'use client';

import { Building2, Copy, ExternalLink, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColoredBadgeList } from '@/components/shared/colored-badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { getFullUrl, extractDomain } from '@/lib/badge-utils';

interface ProviderInfo {
  organizationName?: string;
  providerType?: string;
  specialties?: string[];
  contact?: {
    email?: string;
    website?: string;
    phone?: string;
  };
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

interface ProviderInfoSectionProps {
  providerInfo: ProviderInfo | null;
  providerAddress: string;
  loading?: boolean;
  showAddress?: boolean;
}

/**
 * Unified Provider Information Section
 * Displays provider info consistently across all cards
 */
export function ProviderInfoSection({ 
  providerInfo, 
  providerAddress, 
  loading = false,
  showAddress = false 
}: ProviderInfoSectionProps) {
  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success('Address copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy address');
      console.error('Failed to copy:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
        <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Organization Name */}
      {providerInfo?.organizationName && (
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Organization</p>
          <p className="font-semibold text-sm">{providerInfo.organizationName}</p>
          {providerInfo.providerType && (
            <p className="text-xs text-muted-foreground capitalize">
              {providerInfo.providerType.replace(/_/g, ' ')}
            </p>
          )}
        </div>
      )}

      {/* Specialties */}
      {providerInfo?.specialties && providerInfo.specialties.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Specialties</p>
          <ColoredBadgeList
            type="specialty"
            values={providerInfo.specialties}
            maxDisplay={3}
            size="sm"
          />
        </div>
      )}

      {/* Contact Information */}
      {providerInfo?.contact && (
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Contact</p>
          <div className="space-y-0.5">
            {/* Website (priority) */}
            {providerInfo.contact.website ? (
              <a
                href={getFullUrl(providerInfo.contact.website) || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"
              >
                <span>{extractDomain(providerInfo.contact.website) || providerInfo.contact.website}</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ) : null}
            
            {/* Email (always show if available, even if website exists) */}
            {providerInfo.contact.email && (
              <a
                href={`mailto:${providerInfo.contact.email}`}
                className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"
              >
                <Mail className="h-2.5 w-2.5" />
                <span>{providerInfo.contact.email}</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Physical Address */}
      {showAddress && providerInfo?.address && (
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Address</p>
          {(() => {
            const addressParts = [
              providerInfo.address.street,
              providerInfo.address.city,
              providerInfo.address.state,
              providerInfo.address.zipCode
            ].filter(Boolean);
            const fullAddress = addressParts.join(', ');
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
            
            return (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 w-fit"
              >
                <span>{fullAddress}</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            );
          })()}
        </div>
      )}

      {/* Provider Wallet Address (always shown, copyable) */}
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">Provider Address</p>
        <div className="flex items-center gap-1.5">
          <p className="font-mono text-xs text-muted-foreground break-all">{providerAddress}</p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 flex-shrink-0"
                  onClick={() => handleCopyAddress(providerAddress)}
                >
                  <Copy className="h-2.5 w-2.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy address to clipboard</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

