'use client';

import { useState } from 'react';
import { useGrantConsent } from '@/hooks/use-api';
import { useWallet } from '@/contexts/wallet-context';
import { useProviders, useDataTypes, usePurposes } from '@/hooks/use-api';
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

interface GrantConsentDialogProps {
  trigger?: React.ReactNode;
}

/**
 * Multi-Select Component with Search
 * Scalable component for selecting multiple items from large lists
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
}) {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onSelectionChange(newSelected);
  };

  const handleRemove = (value: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    onSelectionChange(selected.filter((v) => v !== value));
  };

  const selectedOptions = options.filter((opt) => selected.includes(getValue(opt)));

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
                  <Badge
                    key={getValue(option)}
                    variant="secondary"
                    className="mr-1 mb-1"
                  >
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
                      className={cn(
                        'mr-2 h-4 w-4',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
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
 * Grant Consent Dialog Component
 * 
 * Scalable form dialog for granting consent with support for:
 * - Multiple providers (searchable multi-select)
 * - Multiple data types (searchable multi-select)
 * - Multiple purposes (searchable multi-select)
 * - Calendar date picker for expiration
 */
export function GrantConsentDialog({ trigger }: GrantConsentDialogProps) {
  const { account, isConnected } = useWallet();
  const { data: providers } = useProviders();
  const { data: dataTypes } = useDataTypes();
  const { data: purposes } = usePurposes();
  const grantConsent = useGrantConsent();

  const [open, setOpen] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(undefined);

  // Filter providers to only those with wallet addresses
  const providersWithWallets = providers?.filter(
    (p) => p.blockchainIntegration?.walletAddress
  ) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected || !account) {
      return;
    }

    // Validation
    if (selectedProviders.length === 0) {
      return;
    }
    if (selectedDataTypes.length === 0) {
      return;
    }
    if (selectedPurposes.length === 0) {
      return;
    }

    // Calculate expiration time (0 for no expiration)
    // Set to end of day (23:59:59) to ensure it's in the future
    let expirationTime = 0;
    if (expirationDate) {
      // Create a new date at end of day (23:59:59) for the selected date
      const endOfDay = new Date(expirationDate);
      endOfDay.setHours(23, 59, 59, 999);
      const timestamp = Math.floor(endOfDay.getTime() / 1000);
      
      // Validate that expiration is in the future
      const now = Math.floor(Date.now() / 1000);
      if (timestamp <= now) {
        // This shouldn't happen if calendar is working correctly, but add safety check
        throw new Error('Expiration date must be in the future');
      }
      expirationTime = timestamp;
    }

    grantConsent.mutate(
      {
        providers: selectedProviders,
        dataTypes: selectedDataTypes,
        purposes: selectedPurposes,
        expirationTime,
      },
      {
        onSuccess: () => {
          setOpen(false);
          // Reset form
          setSelectedProviders([]);
          setSelectedDataTypes([]);
          setSelectedPurposes([]);
          setExpirationDate(undefined);
        },
      }
    );
  };

  const defaultTrigger = (
    <Button size="sm">
      Grant Consent
    </Button>
  );

  // Calculate total consents that will be created
  const totalConsents = selectedProviders.length * selectedDataTypes.length * selectedPurposes.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Grant Consent</DialogTitle>
          <DialogDescription>
            Grant consent to providers to access your healthcare data. Select multiple options to create multiple consents efficiently.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1">
        {!isConnected ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Please connect your wallet to grant consent.
          </div>
        ) : (
          <form id="grant-consent-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Providers Selection */}
            <div className="space-y-2">
              <Label id="providers-label" htmlFor="providers">Providers</Label>
              <MultiSelect
                id="providers"
                labelId="providers-label"
                ariaLabel="Providers"
                options={providersWithWallets}
                selected={selectedProviders}
                onSelectionChange={setSelectedProviders}
                placeholder="Select providers..."
                searchPlaceholder="Search providers..."
                emptyMessage="No providers found."
                getValue={(provider) => provider.blockchainIntegration!.walletAddress}
                getLabel={(provider) => `${provider.organizationName} (${provider.blockchainIntegration!.walletAddress.slice(0, 6)}...${provider.blockchainIntegration!.walletAddress.slice(-4)})`}
              />
              {selectedProviders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedProviders.length} provider{selectedProviders.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Data Types Selection */}
            <div className="space-y-2">
              <Label id="dataTypes-label" htmlFor="dataTypes">Data Types</Label>
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
              />
              {selectedDataTypes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedDataTypes.length} data type{selectedDataTypes.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Purposes Selection */}
            <div className="space-y-2">
              <Label id="purposes-label" htmlFor="purposes">Purposes</Label>
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
              />
              {selectedPurposes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedPurposes.length} purpose{selectedPurposes.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Expiration Date Picker */}
            <div className="space-y-2">
              <Label htmlFor="expiration">Expiration Date (optional)</Label>
              <div className="relative">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="expiration"
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !expirationDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expirationDate ? (
                        <span className="flex-1 text-left">{format(expirationDate, 'PPP')}</span>
                      ) : (
                        <span>No expiration (select date to set expiration)</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expirationDate}
                      onSelect={(date) => {
                        if (date) {
                          // Ensure date is at least tomorrow (not today)
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const selected = new Date(date);
                          selected.setHours(0, 0, 0, 0);
                          
                          if (selected <= today) {
                            // If today or past, set to tomorrow
                            const tomorrow = new Date(today);
                            tomorrow.setDate(tomorrow.getDate() + 1);
                            setExpirationDate(tomorrow);
                          } else {
                            setExpirationDate(date);
                          }
                        } else {
                          setExpirationDate(undefined);
                        }
                      }}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const checkDate = new Date(date);
                        checkDate.setHours(0, 0, 0, 0);
                        return checkDate <= today;
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {expirationDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setExpirationDate(undefined)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty for no expiration. Selected date must be in the future.
              </p>
            </div>

            {/* Summary */}
            {totalConsents > 0 && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="text-sm font-medium">
                  Summary
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  This will create <span className="font-semibold text-foreground">{totalConsents}</span> consent{totalConsents > 1 ? 's' : ''} in a single transaction:
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>{selectedProviders.length} provider{selectedProviders.length > 1 ? 's' : ''}</li>
                  <li>{selectedDataTypes.length} data type{selectedDataTypes.length > 1 ? 's' : ''}</li>
                  <li>{selectedPurposes.length} purpose{selectedPurposes.length > 1 ? 's' : ''}</li>
                  {expirationDate && (
                    <li>Expires: {format(expirationDate, 'PPP')}</li>
                  )}
                  {!expirationDate && (
                    <li>No expiration</li>
                  )}
                </ul>
              </div>
            )}
          </form>
        )}
        </div>

        {/* Fixed Footer - Buttons */}
        {isConnected && (
          <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={grantConsent.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                grantConsent.isPending ||
                selectedProviders.length === 0 ||
                selectedDataTypes.length === 0 ||
                selectedPurposes.length === 0
              }
              onClick={(e) => {
                e.preventDefault();
                handleSubmit(e as any);
              }}
            >
              {grantConsent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Grant {totalConsents > 0 ? `${totalConsents} Consent${totalConsents > 1 ? 's' : ''}` : 'Consent'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
