'use client';

import { format } from 'date-fns';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

interface PatientDetailsHeaderProps {
  patientId: string;
  patientWalletAddress?: string;
  demographics: any;
}

export function PatientDetailsHeader({
  patientId,
  patientWalletAddress,
  demographics,
}: PatientDetailsHeaderProps) {
  const patientName = `${demographics.firstName || ''} ${demographics.lastName || ''}`.trim();
  const patientAddress = demographics.address 
    ? `${demographics.address.street || ''}, ${demographics.address.city || ''}, ${demographics.address.state || ''} ${demographics.address.zipCode || ''}`
    : 'N/A';
  
  // Google Maps URL for patient address
  const googleMapsUrl = patientAddress !== 'N/A' 
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(patientAddress)}`
    : null;
  
  // Copy wallet address handler
  const handleCopyWalletAddress = async () => {
    if (!patientWalletAddress) return;
    try {
      await navigator.clipboard.writeText(patientWalletAddress);
      toast.success('Wallet address copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy wallet address');
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="mt-4 text-sm">
      {/* Patient Name - Full width row */}
      <div className="mb-3">
        <p className="font-semibold text-base">{patientName || 'N/A'}</p>
      </div>
      
      {/* Row layout: Left item paired with Right item on same row */}
      <div className="space-y-2">
        {/* Row 1: DOB/Age/Sex on left, Phone on right */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-muted-foreground text-xs">
              {demographics.dateOfBirth ? `DOB: ${format(new Date(demographics.dateOfBirth), 'MMM d, yyyy')}` : ''}
              {demographics.age ? ` • Age: ${demographics.age}` : ''}
              {demographics.gender ? ` • ${demographics.gender}` : ''}
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            {demographics.contact?.phone && (
              <p>
                <strong>Phone:</strong>{' '}
                <a 
                  href={`tel:${demographics.contact.phone}`}
                  className="text-primary hover:underline"
                >
                  {demographics.contact.phone}
                </a>
              </p>
            )}
          </div>
        </div>
        
        {/* Row 2: Patient ID on left, Email on right */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            {patientId && (
              <p className="text-muted-foreground text-xs font-mono">
                <strong>Patient ID:</strong> {patientId}
              </p>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {demographics.contact?.email && (
              <p>
                <strong>Email:</strong>{' '}
                <a 
                  href={`mailto:${demographics.contact.email}`}
                  className="text-primary hover:underline"
                >
                  {demographics.contact.email}
                </a>
              </p>
            )}
          </div>
        </div>
        
        {/* Row 3: Wallet on left, Address on right */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            {patientWalletAddress && (
              <div className="flex items-center gap-1.5">
                <p className="text-muted-foreground text-xs font-mono">
                  <strong>Wallet:</strong>{' '}
                  <button
                    onClick={handleCopyWalletAddress}
                    className="text-primary hover:underline cursor-pointer text-left flex items-center gap-1"
                    title="Click to copy full wallet address"
                  >
                    {patientWalletAddress.slice(0, 6)}...{patientWalletAddress.slice(-4)}
                    <Copy className="h-3 w-3" />
                  </button>
                </p>
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {patientAddress !== 'N/A' && googleMapsUrl && (
              <p>
                <strong>Address:</strong>{' '}
                <a 
                  href={googleMapsUrl}
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
    </div>
  );
}

