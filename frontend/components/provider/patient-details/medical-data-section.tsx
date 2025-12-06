'use client';

import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Info, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { dataTypeDescriptions } from '@/lib/badge-utils';
import { format } from 'date-fns';
import { LucideIcon } from 'lucide-react';

interface MedicalDataSectionProps {
  title: string;
  icon: LucideIcon;
  dataType: string;
  hasData: boolean;
  isEmpty: boolean;
  hasConsent: boolean;
  consents: any[];
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function MedicalDataSection({
  title,
  icon: Icon,
  dataType,
  hasData,
  isEmpty,
  hasConsent,
  consents,
  isExpanded,
  onToggle,
  children,
}: MedicalDataSectionProps) {
  if (!hasConsent) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-base cursor-help">{title}</CardTitle>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">
                      {dataTypeDescriptions[dataType] || `${title} - Medical data section`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge variant="outline" className="text-xs">No Consent</Badge>
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent className="pt-0">
            <div className="p-4 bg-muted/30 rounded-lg border border-dashed">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Data Not Available</p>
                  <p className="text-xs text-muted-foreground">
                    This section is not available because you don't have consent to view {title.toLowerCase()}. 
                    Request consent from the patient to access this data.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  if (isEmpty || !hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="text-base cursor-help">{title}</CardTitle>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" sideOffset={8} className="z-[100]">
                  <p className="text-xs max-w-xs">
                    {dataTypeDescriptions[dataType] || `${title} - Medical data section`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">No data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader 
        className="pb-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="text-base cursor-help">{title}</CardTitle>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" sideOffset={8} className="z-[100]">
                  <p className="text-xs max-w-xs">
                    {dataTypeDescriptions[dataType] || `${title} - Medical data section`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" align="start" sideOffset={8} className="z-[100]">
                  <div className="space-y-1">
                    <p className="font-semibold text-xs">Consent Details</p>
                    {consents.map((c: any, idx: number) => (
                      <div key={idx} className="text-xs">
                        <p>Purposes: {c.purposes?.join(', ') || c.purpose}</p>
                        {c.expirationTime && (
                          <p>Expires: {format(new Date(c.expirationTime), 'MMM d, yyyy')}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

