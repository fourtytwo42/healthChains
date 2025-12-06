'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, Printer, History, FileCheck, X, Clock, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { ColoredBadge } from '@/components/shared/colored-badge';
import { format } from 'date-fns';
import type { ConsentHistoryEvent } from '@/types/consent';

interface ProviderConsentHistoryProps {
  history: ConsentHistoryEvent[] | undefined;
  isLoading: boolean;
  searchQuery: string;
  debouncedSearchQuery: string;
  onSearchChange: (value: string) => void;
  onEventClick: (event: ConsentHistoryEvent) => void;
  onExportCSV: () => void;
  onPrint: () => void;
}

export function ProviderConsentHistory({
  history,
  isLoading,
  searchQuery,
  debouncedSearchQuery,
  onSearchChange,
  onEventClick,
  onExportCSV,
  onPrint,
}: ProviderConsentHistoryProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Consent History
              </CardTitle>
              <CardDescription>
                Complete timeline of all consent-related actions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Consent History
              </CardTitle>
              <CardDescription>
                Complete timeline of all consent-related actions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onExportCSV}
                      className="h-8 w-8 p-0"
                      aria-label="Export consent history to CSV"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Export consent history to CSV</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onPrint}
                      className="h-8 w-8 p-0"
                      aria-label="Print consent history"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Print consent history</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by any column value..."
                  value={searchQuery}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                  }}
                  className="pl-8 w-64"
                  aria-label="Search consent history"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'No history events found matching your search' : 'No consent history'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter history events by search query
  const filteredHistory = history.filter((event: ConsentHistoryEvent) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const patientName = event.patientInfo
      ? `${event.patientInfo.firstName} ${event.patientInfo.lastName}`.toLowerCase()
      : '';
    const patientId = event.patientInfo?.patientId?.toLowerCase() || '';
    const patientAddress = (event.patient || '').toLowerCase();
    const dataTypes = (event.dataTypes || []).map((dt: string) => dt.toLowerCase()).join(' ') || 
                     (event.dataType ? event.dataType.toLowerCase() : '');
    const purposes = (event.purposes || []).map((p: string) => p.toLowerCase()).join(' ') || 
                    (event.purpose ? event.purpose.toLowerCase() : '');
    return patientName.includes(query) || 
           patientId.includes(query) || 
           patientAddress.includes(query) ||
           dataTypes.includes(query) ||
           purposes.includes(query);
  });

  if (filteredHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Consent History
              </CardTitle>
              <CardDescription>
                Complete timeline of all consent-related actions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onExportCSV}
                      className="h-8 w-8 p-0"
                      aria-label="Export consent history to CSV"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Export consent history to CSV</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onPrint}
                      className="h-8 w-8 p-0"
                      aria-label="Print consent history"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Print consent history</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by any column value..."
                  value={searchQuery}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                  }}
                  className="pl-8 w-64"
                  aria-label="Search consent history"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {debouncedSearchQuery ? 'No history events found matching your search' : 'No consent history'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Consent History
            </CardTitle>
            <CardDescription>
              Complete timeline of all consent-related actions
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onExportCSV}
                    className="h-8 w-8 p-0"
                    aria-label="Export consent history to CSV"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export consent history to CSV</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onPrint}
                    className="h-8 w-8 p-0"
                    aria-label="Print consent history"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Print consent history</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by any column value..."
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                }}
                className="pl-8 w-64"
                aria-label="Search consent history"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {filteredHistory.map((event: ConsentHistoryEvent, index: number) => {
            // Determine event type and styling
            let eventType = '';
            let eventIcon = null;
            let eventColor = '';
            let eventBgColor = '';
            let eventBorderColor = '';
            let statusBadge = null;

            if (event.type === 'ConsentGranted') {
              eventType = 'Consent Granted';
              eventIcon = <FileCheck className="h-5 w-5" />;
              eventColor = 'text-green-700 dark:text-green-400';
              eventBgColor = 'bg-green-50 dark:bg-green-950/20';
              eventBorderColor = 'border-green-200 dark:border-green-800';
              statusBadge = <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">Granted</Badge>;
            } else if (event.type === 'ConsentRevoked') {
              eventType = 'Consent Revoked';
              eventIcon = <X className="h-5 w-5" />;
              eventColor = 'text-red-700 dark:text-red-400';
              eventBgColor = 'bg-red-50 dark:bg-red-950/20';
              eventBorderColor = 'border-red-200 dark:border-red-800';
              statusBadge = <Badge variant="destructive">Revoked</Badge>;
            } else if (event.type === 'ConsentExpired') {
              eventType = 'Consent Expired';
              eventIcon = <Clock className="h-5 w-5" />;
              eventColor = 'text-orange-700 dark:text-orange-400';
              eventBgColor = 'bg-orange-50 dark:bg-orange-950/20';
              eventBorderColor = 'border-orange-200 dark:border-orange-800';
              statusBadge = <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">Expired</Badge>;
            } else if (event.type === 'AccessRequested') {
              eventType = 'Request Sent';
              eventIcon = <Users className="h-5 w-5" />;
              eventColor = 'text-blue-700 dark:text-blue-400';
              eventBgColor = 'bg-blue-50 dark:bg-blue-950/20';
              eventBorderColor = 'border-blue-200 dark:border-blue-800';
              statusBadge = <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">Pending</Badge>;
            } else if (event.type === 'AccessApproved') {
              eventType = 'Request Approved';
              eventIcon = <FileCheck className="h-5 w-5" />;
              eventColor = 'text-green-700 dark:text-green-400';
              eventBgColor = 'bg-green-50 dark:bg-green-950/20';
              eventBorderColor = 'border-green-200 dark:border-green-800';
              statusBadge = <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">Approved</Badge>;
            } else if (event.type === 'AccessDenied') {
              eventType = 'Request Denied';
              eventIcon = <X className="h-5 w-5" />;
              eventColor = 'text-red-700 dark:text-red-400';
              eventBgColor = 'bg-red-50 dark:bg-red-950/20';
              eventBorderColor = 'border-red-200 dark:border-red-800';
              statusBadge = <Badge variant="destructive">Denied</Badge>;
            }

            const isExpired = event.isExpired || (event.type === 'ConsentGranted' && event.expirationTime && 
              new Date(event.expirationTime) < new Date());

            return (
              <Card
                key={`${event.type}-${event.consentId || event.requestId}-${index}`}
                className={`cursor-pointer transition-all hover:shadow-sm hover:border-opacity-80 border-l-4 py-0 ${eventBorderColor} ${eventBgColor}`}
                onClick={() => onEventClick(event)}
              >
                <CardContent className="py-1 px-2">
                  <div className="flex items-center gap-2">
                    {eventIcon && (
                      <div className={`flex-shrink-0 p-1.5 rounded ${eventBgColor} ${eventColor} flex items-center justify-center`}>
                        {React.cloneElement(eventIcon, { className: 'h-5 w-5' })}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          <h3 className={`font-semibold text-[11px] leading-none ${eventColor}`}>
                            {eventType}
                          </h3>
                          {statusBadge}
                          {isExpired && event.type === 'ConsentGranted' && (
                            <Badge variant="destructive" className="text-[9px] h-3 px-1">Expired</Badge>
                          )}
                        </div>
                        <p className="text-[9px] text-muted-foreground whitespace-nowrap leading-none">
                          {format(new Date(event.timestamp), 'MMM d, yyyy • h:mm a')}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-1.5 gap-y-0 text-xs">
                        <div>
                          {event.patientInfo ? (
                            <>
                              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Patient</p>
                              <p className="text-[11px] font-semibold truncate leading-tight">
                                {event.patientInfo.firstName} {event.patientInfo.lastName}
                              </p>
                              {event.patientInfo.patientId && (
                                <p className="text-[9px] text-muted-foreground font-mono truncate leading-tight">
                                  {event.patientInfo.patientId}
                                </p>
                              )}
                            </>
                          ) : event.patient ? (
                            <>
                              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Patient</p>
                              <p className="text-[11px] font-mono truncate leading-tight">{event.patient.slice(0, 8)}...{event.patient.slice(-6)}</p>
                            </>
                          ) : (
                            <>
                              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Patient</p>
                              <p className="text-[11px] text-muted-foreground leading-tight">—</p>
                            </>
                          )}
                        </div>

                        <div>
                          {event.dataTypes && event.dataTypes.length > 0 && event.purposes && event.purposes.length > 0 ? (
                            <>
                              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Access</p>
                              <div className="flex flex-wrap gap-0.5 -mt-0.5">
                                {event.dataTypes.slice(0, 2).map((dt: string, idx: number) => (
                                  <ColoredBadge key={idx} type="dataType" value={dt} size="sm" />
                                ))}
                                {event.dataTypes.length > 2 && (
                                  <Badge variant="outline" className="text-[9px] h-3 px-1">+{event.dataTypes.length - 2}</Badge>
                                )}
                                {event.purposes.slice(0, 2).map((p: string, idx: number) => (
                                  <ColoredBadge key={idx} type="purpose" value={p} size="sm" />
                                ))}
                                {event.purposes.length > 2 && (
                                  <Badge variant="outline" className="text-[9px] h-3 px-1">+{event.purposes.length - 2}</Badge>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Access</p>
                              <p className="text-[11px] text-muted-foreground leading-tight">—</p>
                            </>
                          )}
                        </div>

                        <div>
                          {event.expirationTime && (event.type === 'ConsentGranted' || event.type === 'AccessRequested') ? (
                            <>
                              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Expires</p>
                              <div className="flex items-center gap-0.5">
                                <Clock className="h-2 w-2 text-muted-foreground flex-shrink-0" />
                                <p className="text-[11px] truncate leading-tight">
                                  {format(new Date(event.expirationTime), 'MMM d, yyyy')}
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">Expires</p>
                              <p className="text-[11px] text-muted-foreground leading-tight">—</p>
                            </>
                          )}
                        </div>

                        <div>
                          {event.consentId !== undefined || event.requestId !== undefined ? (
                            <>
                              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">
                                {event.consentId !== undefined ? 'Consent ID' : 'Request ID'}
                              </p>
                              <p className="text-[11px] font-mono font-semibold leading-tight">
                                #{event.consentId ?? event.requestId}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide leading-tight mb-0.5">ID</p>
                              <p className="text-[11px] text-muted-foreground leading-tight">—</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

