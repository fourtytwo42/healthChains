'use client';

import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RequestConsentDialog } from '@/components/provider/request-consent-dialog';

interface ExportPrintControlsProps {
  isExporting: boolean;
  isPrinting: boolean;
  onExport: () => void;
  onPrint: () => void;
  onClose: () => void;
  patientWalletAddress?: string;
  patientId: string;
  patientName: string;
}

export function ExportPrintControls({
  isExporting,
  isPrinting,
  onExport,
  onPrint,
  onClose,
  patientWalletAddress,
  patientId,
  patientName,
}: ExportPrintControlsProps) {
  return (
    <div className="flex justify-end items-center gap-2">
      <div className="flex items-center gap-2 mr-auto">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onExport}
                disabled={isExporting || isPrinting}
                className="h-8 w-8 p-0"
                aria-label="Export medical chart as CSV"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Save as CSV</p>
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
                disabled={isExporting || isPrinting}
                className="h-8 w-8 p-0"
                aria-label="Print medical chart"
              >
                {isPrinting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Print medical chart</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {patientWalletAddress && (
        <RequestConsentDialog
          patientAddress={patientWalletAddress}
          patientId={patientId}
          patientName={patientName}
        />
      )}
      <Button size="sm" variant="outline" onClick={onClose} aria-label="Close medical chart">
        Close
      </Button>
    </div>
  );
}

