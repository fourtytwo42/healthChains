'use client';

import { useState } from 'react';
import { useRequestAccess } from '@/hooks/use-api';
import { useWallet } from '@/contexts/wallet-context';
import { useDataTypes, usePurposes } from '@/hooks/use-api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, CalendarIcon, X, Check, ChevronsUpDown } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface RequestConsentDialogProps {
  patientAddress: string;
  patientId: string;
  patientName: string;
  trigger?: React.ReactNode;
}

/**
 * Multi-Select Component (reused from consent-grant-dialog)
 */
function MultiSelect({
  id,
  labelId,
  ariaLabel,
  options,
  selected,
  onSelectionChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  getLabel,
  getValue,
  showSelectAll = false,
}: {
  id?: string;
  labelId?: string;
  ariaLabel?: string;
  options: any[];
  selected: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  getLabel: (option: any) => string;
  getValue: (option: any) => string;
  showSelectAll?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    const allValues = options.map((opt) => getValue(opt));
    const allSelected = allValues.every((val) => selected.includes(val));
    
    if (allSelected) {
      // Deselect all
      onSelectionChange([]);
    } else {
      // Select all
      onSelectionChange(allValues);
    }
  };

  const handleRemove = (value: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    onSelectionChange(selected.filter((v) => v !== value));
  };

  const selectedOptions = options.filter((opt) => selected.includes(getValue(opt)));
  const allSelected = options.length > 0 && options.every((opt) => selected.includes(getValue(opt)));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          aria-labelledby={labelId}
          aria-label={ariaLabel}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between min-h-10 h-auto"
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedOptions.map((option) => (
                <Badge key={getValue(option)} variant="secondary" className="mr-1 mb-1">
                  {getLabel(option)}
                  <button
                    type="button"
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRemove(getValue(option), e);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => handleRemove(getValue(option), e)}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder || 'Search...'} />
          <CommandList>
            <CommandEmpty>{emptyMessage || 'No results found.'}</CommandEmpty>
            <CommandGroup>
              {showSelectAll && options.length > 0 && (
                <CommandItem
                  value="select-all"
                  onSelect={handleSelectAll}
                  className="font-semibold"
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', allSelected ? 'opacity-100' : 'opacity-0')}
                  />
                  <div className="flex-1">Select All</div>
                </CommandItem>
              )}
              {options.map((option) => {
                const value = getValue(option);
                const isSelected = selected.includes(value);
                return (
                  <CommandItem
                    key={value}
                    value={getLabel(option)}
                    onSelect={() => handleSelect(value)}
                  >
                    <Check
                      className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
                    />
                    <div className="flex-1">{getLabel(option)}</div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Request Consent Dialog Component
 * Allows providers to request access to patient data
 */
export function RequestConsentDialog({
  patientAddress,
  patientId,
  patientName,
  trigger,
}: RequestConsentDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();
  const { account, isConnected } = useWallet();
  const requestAccess = useRequestAccess();
  const { data: dataTypes } = useDataTypes();
  const { data: purposes } = usePurposes();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account || !isConnected) {
      alert('Please connect your wallet');
      return;
    }

    if (selectedDataTypes.length === 0 || selectedPurposes.length === 0) {
      alert('Please select at least one data type and one purpose');
      return;
    }

    try {
      const expirationTime = expirationDate
        ? Math.floor(new Date(expirationDate.setHours(23, 59, 59, 999)).getTime() / 1000)
        : 0;

      // Send arrays - contract will handle batch request automatically
      await requestAccess.mutateAsync({
        patientAddress,
        dataTypes: selectedDataTypes,
        purposes: selectedPurposes,
        expirationTime,
      });

      setOpen(false);
      setSelectedDataTypes([]);
      setSelectedPurposes([]);
      setExpirationDate(undefined);
    } catch (error) {
      console.error('Failed to request access:', error);
    }
  };

  const isFormValid = selectedDataTypes.length > 0 && selectedPurposes.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm">Request Consent</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Request Consent from {patientName}</DialogTitle>
          <DialogDescription>
            Request access to patient data. The patient will be notified and can approve or deny your request.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1">
        <form id="request-consent-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label id="dataTypes-label" htmlFor="dataTypes">
              Data Types <span className="text-destructive">*</span>
            </Label>
            <MultiSelect
              id="dataTypes"
              labelId="dataTypes-label"
              ariaLabel="Data Types"
              options={dataTypes || []}
              selected={selectedDataTypes}
              onSelectionChange={setSelectedDataTypes}
              placeholder="Select data types..."
              searchPlaceholder="Search data types..."
              emptyMessage="No data types found."
              getValue={(type) => type}
              getLabel={(type) => type}
              showSelectAll={true}
            />
            {selectedDataTypes.length === 0 && (
              <p className="text-sm text-destructive">At least one data type is required</p>
            )}
          </div>

          <div className="space-y-2">
            <Label id="purposes-label" htmlFor="purposes">
              Purposes <span className="text-destructive">*</span>
            </Label>
            <MultiSelect
              id="purposes"
              labelId="purposes-label"
              ariaLabel="Purposes"
              options={purposes || []}
              selected={selectedPurposes}
              onSelectionChange={setSelectedPurposes}
              placeholder="Select purposes..."
              searchPlaceholder="Search purposes..."
              emptyMessage="No purposes found."
              getValue={(purpose) => purpose}
              getLabel={(purpose) => purpose}
              showSelectAll={true}
            />
            {selectedPurposes.length === 0 && (
              <p className="text-sm text-destructive">At least one purpose is required</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Expiration Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !expirationDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expirationDate ? format(expirationDate, 'PPP') : 'Select expiration date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expirationDate}
                  onSelect={setExpirationDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </form>
        </div>

        {/* Fixed Footer - Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0 mt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            type="button"
            disabled={!isFormValid || requestAccess.isPending}
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(e as any);
            }}
          >
            {requestAccess.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Requesting...
              </>
            ) : (
              'Request Consent'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

