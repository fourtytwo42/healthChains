'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-context';
import { useRole } from '@/hooks/use-role';
import { useProviders, usePatients } from '@/hooks/use-api';
import { 
  LayoutDashboard,
  HeartPulse,
  Building2,
  User,
  ChevronLeft,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const SIDEBAR_STORAGE_KEY = 'healthchains-sidebar-collapsed';

/**
 * Sidebar Navigation Component - Role-based navigation
 */
export function Sidebar() {
  const pathname = usePathname();
  const { account } = useWallet();
  const { role, isLoading } = useRole(account);
  
  // Load collapsed state from localStorage (default to true - collapsed)
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  useEffect(() => {
    // Load state from localStorage on mount
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      setIsCollapsed(stored === 'true');
    }
  }, []);
  
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newState));
  };

  // Fetch providers and patients to get names
  const { data: providersData } = useProviders();
  const { data: patientsData } = usePatients({
    enabled: !!account,
  });

  // Find current provider and patient
  const currentProvider = providersData?.find((p: any) => 
    p.blockchainIntegration?.walletAddress?.toLowerCase() === account?.toLowerCase()
  );
  const currentPatient = patientsData?.find((p: any) => 
    p.blockchainIntegration?.walletAddress?.toLowerCase() === account?.toLowerCase()
  );

  const providerName = currentProvider?.organizationName || 'Provider Dashboard';
  const patientName = currentPatient?.demographics
    ? `${currentPatient.demographics.firstName} ${currentPatient.demographics.lastName}`.trim()
    : 'Patient Dashboard';

  // Get user display name for chat
  const getUserDisplayName = () => {
    if (role?.role === 'provider' || role?.role === 'both') {
      return providerName;
    }
    if (role?.role === 'patient') {
      return patientName;
    }
    return 'User';
  };

  // Determine navigation based on role
  const getNavigation = () => {
    if (!account || isLoading) {
      return [];
    }

    const dashboardHref = role?.role === 'provider' || role?.role === 'both' ? '/provider' : '/patient';
    const dashboardIcon = role?.role === 'provider' || role?.role === 'both' ? Building2 : User;

    return [
      { name: 'Dashboard', href: dashboardHref, icon: dashboardIcon },
      { name: 'Chat', href: '/chat', icon: MessageSquare },
    ];
  };

  const navigation = getNavigation();

  return (
    <div className={cn(
      "flex h-full flex-col border-r bg-sidebar transition-all duration-300 relative",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className={cn(
        "flex h-16 items-center border-b transition-all duration-300",
        isCollapsed ? "px-3 justify-center" : "px-6"
      )}>
        <HeartPulse className="h-6 w-6 text-primary flex-shrink-0" />
        {!isCollapsed && (
          <span className="ml-2 text-lg font-semibold whitespace-nowrap">HealthChains</span>
        )}
      </div>
      
      {/* Navigation */}
      <nav aria-label="Sidebar Navigation" className={cn(
        "flex-1 space-y-1 py-4 transition-all duration-300",
        isCollapsed ? "px-2" : "px-3"
      )}>
        {isLoading ? (
          <div className="space-y-1">
            <Skeleton className={cn(isCollapsed ? "h-10 w-10" : "h-10 w-full")} />
            <Skeleton className={cn(isCollapsed ? "h-10 w-10" : "h-10 w-full")} />
          </div>
        ) : navigation.length > 0 ? (
          navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href === '/provider' && pathname.startsWith('/provider')) || 
              (item.href === '/patient' && pathname.startsWith('/patient')) ||
              (item.href === '/chat' && pathname.startsWith('/chat'));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center rounded-lg py-2 text-sm font-medium transition-colors',
                  isCollapsed ? 'justify-center px-2' : 'gap-3 px-3',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="whitespace-nowrap truncate">{item.name}</span>
                )}
              </Link>
            );
          })
        ) : (
          <div className={cn(
            "text-sm text-muted-foreground",
            isCollapsed ? "px-2 text-center" : "px-3"
          )}>
            {isCollapsed ? '...' : 'Connect wallet to view navigation'}
          </div>
        )}
      </nav>
      
      {/* Toggle Button */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            "w-full justify-center transition-all duration-300",
            isCollapsed ? "px-2" : "px-3"
          )}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span className="whitespace-nowrap">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

