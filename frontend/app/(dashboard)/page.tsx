'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePatients, useProviders, useContractInfo, useHealthCheck } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Building2, FileCheck, Activity, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Dashboard Page - Overview with key stats and quick actions
 */
export default function DashboardPage() {
  const { data: patients, isLoading: patientsLoading } = usePatients();
  const { data: providers, isLoading: providersLoading } = useProviders();
  const { data: contractInfo, isLoading: contractLoading } = useContractInfo();
  const { data: health, isLoading: healthLoading } = useHealthCheck();

  const stats = [
    {
      name: 'Total Patients',
      value: patients?.length || 0,
      icon: Users,
      href: '/patients',
      loading: patientsLoading,
    },
    {
      name: 'Total Providers',
      value: providers?.length || 0,
      icon: Building2,
      href: '/patients', // Will update when providers page exists
      loading: providersLoading,
    },
    {
      name: 'Contract Status',
      value: contractInfo?.web3?.connected ? 'Connected' : 'Disconnected',
      icon: Activity,
      loading: contractLoading,
    },
    {
      name: 'Backend Status',
      value: health?.status === 'healthy' ? 'Healthy' : 'Unknown',
      icon: AlertCircle,
      loading: healthLoading,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your healthcare consent management system
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.name}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {stat.loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  {stat.href && (
                    <Link href={stat.href}>
                      <Button variant="link" className="p-0 h-auto mt-2">
                        View details →
                      </Button>
                    </Link>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and navigation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/patients">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                View Patients
              </Button>
            </Link>
            <Link href="/consents">
              <Button variant="outline" className="w-full justify-start">
                <FileCheck className="mr-2 h-4 w-4" />
                Manage Consents
              </Button>
            </Link>
            <Link href="/requests">
              <Button variant="outline" className="w-full justify-start">
                <Activity className="mr-2 h-4 w-4" />
                Review Requests
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Backend and blockchain connectivity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {contractLoading || healthLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Backend API</span>
                  <span
                    className={`text-sm font-medium ${
                      health?.status === 'healthy'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {health?.status === 'healthy' ? '✓ Online' : '✗ Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Blockchain</span>
                  <span
                    className={`text-sm font-medium ${
                      contractInfo?.web3?.connected
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-yellow-600 dark:text-yellow-400'
                    }`}
                  >
                    {contractInfo?.web3?.connected ? '✓ Connected' : '⚠ Disconnected'}
                  </span>
                </div>
                {contractInfo?.contract?.address && (
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Contract Address</p>
                    <p className="text-xs font-mono break-all">
                      {contractInfo.contract.address}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

