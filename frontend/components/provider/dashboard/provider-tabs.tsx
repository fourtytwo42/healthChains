'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReactNode } from 'react';

interface ProviderTabsProps {
  activeTab: 'all' | 'pending' | 'granted' | 'history';
  onTabChange: (value: string) => void;
  children: ReactNode;
}

export function ProviderTabs({ activeTab, onTabChange, children }: ProviderTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <div className="flex items-center justify-between">
        <TabsList aria-label="Dashboard sections">
          <TabsTrigger value="all">Patients</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="granted">Granted Consent</TabsTrigger>
          <TabsTrigger value="history">Consent History</TabsTrigger>
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}

