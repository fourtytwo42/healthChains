'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getSpecialtyColor,
  getDataTypeColor,
  getPurposeColor,
  specialtyDescriptions,
  dataTypeDescriptions,
  purposeDescriptions,
} from '@/lib/badge-utils';

interface ColoredBadgeProps {
  type: 'specialty' | 'dataType' | 'purpose';
  value: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Colored Badge Component
 * Displays a badge with color coding and tooltip based on type
 */
export function ColoredBadge({ type, value, size = 'md', className = '' }: ColoredBadgeProps) {
  // Guard against undefined/null values
  if (!value || typeof value !== 'string') {
    return null;
  }

  let colors;
  let description;
  let displayValue = value;

  switch (type) {
    case 'specialty':
      colors = getSpecialtyColor(value);
      description = specialtyDescriptions[value] || `${value} - Medical specialty`;
      break;
    case 'dataType':
      colors = getDataTypeColor(value);
      description = dataTypeDescriptions[value] || `${value.replace(/_/g, ' ')} - Health data type`;
      displayValue = value.replace(/_/g, ' ');
      break;
    case 'purpose':
      colors = getPurposeColor(value);
      description = purposeDescriptions[value] || `${value.replace(/_/g, ' ')} - Purpose for data use`;
      displayValue = value.replace(/_/g, ' ');
      break;
  }

  const sizeClasses = {
    sm: 'text-[10px] py-1 px-1.5',
    md: 'text-xs py-1',
    lg: 'text-sm py-1',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={`${sizeClasses[size]} cursor-help border-0 ${colors.bg} ${colors.text} font-semibold shadow-sm hover:opacity-90 transition-opacity ${className}`}
          >
            {displayValue}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Colored Badge List Component
 * Displays multiple badges with proper spacing
 */
interface ColoredBadgeListProps {
  type: 'specialty' | 'dataType' | 'purpose';
  values: string[];
  size?: 'sm' | 'md' | 'lg';
  maxDisplay?: number;
  className?: string;
}

export function ColoredBadgeList({
  type,
  values,
  size = 'md',
  maxDisplay,
  className = '',
}: ColoredBadgeListProps) {
  if (!values || values.length === 0) return null;

  const displayValues = maxDisplay ? values.slice(0, maxDisplay) : values;
  const remaining = maxDisplay ? values.length - maxDisplay : 0;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {displayValues.map((value, idx) => (
        <ColoredBadge key={idx} type={type} value={value} size={size} />
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className={`${size === 'sm' ? 'text-[10px] h-4 px-1.5' : 'text-xs'}`}>
          +{remaining}
        </Badge>
      )}
    </div>
  );
}

