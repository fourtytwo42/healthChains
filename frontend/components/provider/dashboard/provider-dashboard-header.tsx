'use client';

interface ProviderDashboardHeaderProps {
  providerName: string;
}

export function ProviderDashboardHeader({ providerName }: ProviderDashboardHeaderProps) {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{providerName}</h1>
      <p className="text-muted-foreground">View and manage patient consent requests</p>
    </div>
  );
}

