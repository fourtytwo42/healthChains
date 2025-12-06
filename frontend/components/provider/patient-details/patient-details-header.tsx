'use client';

import { format } from 'date-fns';

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

  return (
    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="font-semibold text-base mb-1">{patientName || 'N/A'}</p>
        <p className="text-muted-foreground text-xs">
          {demographics.dateOfBirth ? `DOB: ${format(new Date(demographics.dateOfBirth), 'MMM d, yyyy')}` : ''}
          {demographics.age ? ` • Age: ${demographics.age}` : ''}
          {demographics.gender ? ` • ${demographics.gender}` : ''}
        </p>
        {patientId && (
          <p className="text-muted-foreground text-xs font-mono mt-1">
            <strong>Patient ID:</strong> {patientId}
          </p>
        )}
        {patientWalletAddress && (
          <p className="text-muted-foreground text-xs font-mono mt-1">
            <strong>Wallet:</strong> {patientWalletAddress.slice(0, 6)}...{patientWalletAddress.slice(-4)}
          </p>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {demographics.contact?.phone && (
          <p><strong>Phone:</strong> {demographics.contact.phone}</p>
        )}
        {demographics.contact?.email && (
          <p><strong>Email:</strong> {demographics.contact.email}</p>
        )}
        {patientAddress !== 'N/A' && (
          <p><strong>Address:</strong> {patientAddress}</p>
        )}
      </div>
    </div>
  );
}

