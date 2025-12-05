import { MainLayout } from '@/components/layout/main-layout';

/**
 * Dashboard Layout - Wraps dashboard routes with main layout
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}

