/**
 * Debounce Hook
 * 
 * Delays execution of a value update until after a specified delay
 */

import { useEffect, useState } from 'react';

/**
 * Hook that debounces a value
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns Debounced value
 * 
 * @example
 * ```tsx
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedSearch = useDebounce(searchQuery, 300);
 * 
 * // Use debouncedSearch in query
 * const { data } = useQuery({
 *   queryKey: ['patients', debouncedSearch],
 *   queryFn: () => fetchPatients(debouncedSearch),
 * });
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up timer to update debounced value
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up timer on value change or unmount
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}


