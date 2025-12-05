'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@/contexts/wallet-context';
import { useRole } from '@/hooks/use-role';
import { 
  LayoutDashboard,
  HeartPulse,
  Building2,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Sidebar Navigation Component - Role-based navigation
 */
export function Sidebar() {
  const pathname = usePathname();
  const { account } = useWallet();
  const { role, isLoading } = useRole(account);

  // Determine navigation based on role
  const getNavigation = () => {
    if (!account || isLoading) {
      return [];
    }

    if (role?.role === 'provider' || role?.role === 'both') {
      return [
        { name: 'Provider Dashboard', href: '/provider', icon: Building2 },
      ];
    }

    if (role?.role === 'patient') {
      return [
        { name: 'Patient Dashboard', href: '/patient', icon: User },
      ];
    }

    // Unknown role - show nothing or default
    return [];
  };

  const navigation = getNavigation();

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center border-b px-6">
        <HeartPulse className="h-6 w-6 text-primary" />
        <span className="ml-2 text-lg font-semibold">HealthChains</span>
      </div>
      <nav aria-label="Sidebar Navigation" className="flex-1 space-y-1 px-3 py-4">
        {isLoading ? (
          <div className="space-y-1">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : navigation.length > 0 ? (
          navigation.map((item) => {
            const isActive = pathname === item.href || (item.href === '/provider' && pathname.startsWith('/provider')) || (item.href === '/patient' && pathname.startsWith('/patient'));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })
        ) : (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            Connect wallet to view navigation
          </div>
        )}
      </nav>
    </div>
  );
}

