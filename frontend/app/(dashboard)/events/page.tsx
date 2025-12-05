'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useConsentEvents, useAccessRequestEvents, usePatients } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, FileCheck, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

/**
 * Events Page - View blockchain events timeline
 */
export default function EventsPage() {
  const { data: patients } = usePatients();
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [eventType, setEventType] = useState<'consent' | 'requests'>('consent');

  const { data: consentEvents, isLoading: consentLoading } = useConsentEvents(
    selectedPatient || undefined
  );
  const { data: requestEvents, isLoading: requestLoading } = useAccessRequestEvents(
    selectedPatient || undefined
  );

  const isLoading = eventType === 'consent' ? consentLoading : requestLoading;
  const events = eventType === 'consent' ? consentEvents : requestEvents;

  const getEventIcon = (type: string) => {
    if (type.includes('Consent')) {
      return <FileCheck className="h-4 w-4" />;
    }
    return <MessageSquare className="h-4 w-4" />;
  };

  const getEventBadge = (type: string) => {
    if (type.includes('Granted') || type.includes('Approved')) {
      return <Badge variant="default" className="bg-green-500/10 text-green-600 dark:text-green-400">{type}</Badge>;
    }
    if (type.includes('Revoked') || type.includes('Denied')) {
      return <Badge variant="destructive">{type}</Badge>;
    }
    return <Badge variant="outline">{type}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Events</h1>
        <p className="text-muted-foreground">View blockchain events and transaction history</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Timeline</CardTitle>
          <CardDescription>Filter events by patient and type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">Patient (Optional)</label>
              <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                <SelectTrigger>
                  <SelectValue placeholder="All patients..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All patients</SelectItem>
                  {patients?.map((patient) => (
                    <SelectItem key={patient.patientId} value={patient.patientId}>
                      {patient.demographics.firstName} {patient.demographics.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={eventType} onValueChange={(v) => setEventType(v as typeof eventType)}>
            <TabsList>
              <TabsTrigger value="consent">Consent Events</TabsTrigger>
              <TabsTrigger value="requests">Request Events</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : events && events.length > 0 ? (
            <div className="space-y-4">
              {events.map((event, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-1">{getEventIcon(event.type)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {getEventBadge(event.type)}
                      <span className="text-xs text-muted-foreground">
                        Block {event.blockNumber}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      {event.type.includes('Consent') && 'consentId' in event && (
                        <p>
                          <span className="font-medium">Consent ID:</span>{' '}
                          <span className="font-mono">{event.consentId}</span>
                        </p>
                      )}
                      {event.type.includes('Request') && 'requestId' in event && (
                        <p>
                          <span className="font-medium">Request ID:</span>{' '}
                          <span className="font-mono">{event.requestId}</span>
                        </p>
                      )}
                      <p>
                        <span className="font-medium">Patient:</span>{' '}
                        <span className="font-mono text-xs">
                          {event.patient.slice(0, 6)}...{event.patient.slice(-4)}
                        </span>
                      </p>
                      {'provider' in event && event.provider && (
                        <p>
                          <span className="font-medium">Provider:</span>{' '}
                          <span className="font-mono text-xs">
                            {event.provider.slice(0, 6)}...{event.provider.slice(-4)}
                          </span>
                        </p>
                      )}
                      {'dataType' in event && event.dataType && (
                        <p>
                          <span className="font-medium">Data Type:</span>{' '}
                          <Badge variant="outline" className="text-xs">
                            {event.dataType}
                          </Badge>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                      <span>{format(new Date(event.timestamp), 'MMM d, yyyy HH:mm:ss')}</span>
                      <span className="font-mono">
                        TX: {event.transactionHash.slice(0, 10)}...
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No events found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

