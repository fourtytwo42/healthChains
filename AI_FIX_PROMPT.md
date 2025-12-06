# Critical Bug Fix Request: React Infinite Loop Error #310

## Problem Summary
We have a persistent React infinite loop error (#310 - "Maximum update depth exceeded") occurring when clicking on a patient in the provider dashboard. The error happens in a `useMemo` hook in the provider dashboard component, but the root cause appears to be related to React Query hooks and memoization dependencies.

## Error Details
- **Error**: `Minified React error #310` (Maximum update depth exceeded)
- **Location**: `frontend/app/(dashboard)/provider/page.tsx` - specifically in a `useMemo` hook
- **Stack Trace**: Points to `useMemo` at line `a7 (45e140596165300c.js:1:83668)`
- **Trigger**: Clicking on a patient row in the provider dashboard opens `PatientDetailsCard`, which then triggers the infinite loop

## Current Code State

### 1. Provider Dashboard (`frontend/app/(dashboard)/provider/page.tsx`)
```typescript
// Fetch all patients for "All Users" tab
const { data: allPatientsData, isLoading: allPatientsLoading } = usePatients();

// Memoize the patients array to prevent reference changes
const stablePatientsArray = useMemo(() => {
  if (!allPatientsData || !Array.isArray(allPatientsData)) return [];
  return allPatientsData;
}, [allPatientsData]);

// Filter patients by search query
const filteredPatients = useMemo(() => {
  if (!stablePatientsArray.length) return [];
  if (!searchQuery) return stablePatientsArray;
  const query = searchQuery.toLowerCase();
  return stablePatientsArray.filter(patient => {
    const name = `${patient.demographics.firstName} ${patient.demographics.lastName}`.toLowerCase();
    return name.includes(query) || patient.patientId.toLowerCase().includes(query);
  });
}, [stablePatientsArray, searchQuery]);

const paginatedPatients = useMemo(() => {
  return filteredPatients.slice((page - 1) * limit, page * limit);
}, [filteredPatients, page, limit]);
```

### 2. useRole Hook (`frontend/hooks/use-role.ts`)
```typescript
export function useRole(account: string | null): UseRoleResult {
  // Memoize normalized account to prevent query key changes
  const normalizedAccount = useMemo(() => {
    return account?.toLowerCase() || null;
  }, [account]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['userRole', normalizedAccount],
    queryFn: async () => {
      if (!normalizedAccount) {
        return null;
      }
      const result = await apiClient.getUserRole(normalizedAccount);
      return result;
    },
    enabled: !!normalizedAccount,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  // Memoize return value to prevent object recreation
  return useMemo(() => ({
    role: data || null,
    isLoading,
    error: error as Error | null,
  }), [data, isLoading, error]);
}
```

### 3. PatientDetailsCard (`frontend/components/provider/patient-details-card.tsx`)
```typescript
export function PatientDetailsCard({
  patientId,
  providerAddress,
  onClose,
}: PatientDetailsCardProps) {
  const { data, isLoading, error } = useProviderPatientData(providerAddress, patientId);
  
  // ... component logic ...
  
  // DISABLED: Temporarily disabled to prevent infinite loops
  const providerHistory: any[] = [];
  const allPatients: any[] = [];
  const patient = null;
  const patientWalletAddress = null;
  const patientHistory: any[] = [];
}
```

## What We've Tried
1. ✅ Memoized `normalizedAccount` in `useRole` hook
2. ✅ Memoized return value of `useRole` hook
3. ✅ Added `stablePatientsArray` to stabilize array reference
4. ✅ Disabled `useProviderConsentHistory` and `usePatients` in `PatientDetailsCard`
5. ✅ Removed all console.log statements
6. ✅ Increased `staleTime` and `gcTime` in React Query
7. ✅ Disabled all refetch options in React Query

## The Issue
Despite all these fixes, the infinite loop persists. The error occurs in `useMemo` in the provider dashboard, suggesting that:
- Either `allPatientsData` from `usePatients()` is still changing reference on every render
- Or the `useMemo` dependencies are causing a circular dependency
- Or React Query is somehow triggering re-renders that cause the memoization to recalculate

## What We Need
**Please fix the infinite loop by:**
1. Identifying the exact cause of the loop (which hook or dependency is causing it)
2. Implementing a proper fix that prevents the loop
3. Ensuring the fix doesn't break existing functionality
4. Re-enabling the disabled hooks in `PatientDetailsCard` if possible

## Key Files to Review
- `frontend/app/(dashboard)/provider/page.tsx` - Main dashboard with the problematic `useMemo`
- `frontend/hooks/use-role.ts` - Role detection hook
- `frontend/hooks/use-api.ts` - All React Query hooks including `usePatients()`
- `frontend/components/provider/patient-details-card.tsx` - Component that triggers the loop

## Environment
- Next.js 16.0.7
- React 19.2.0
- @tanstack/react-query 5.90.12
- Production build (minified errors)

## Expected Behavior
When clicking on a patient in the provider dashboard:
1. `PatientDetailsCard` should open
2. Patient data should load
3. No infinite loop should occur
4. Component should render normally

## Current Behavior
When clicking on a patient:
1. `PatientDetailsCard` starts to render
2. Infinite loop triggers in `useMemo`
3. Browser becomes unresponsive
4. Error #310 is thrown

Please analyze the code, identify the root cause, and implement a fix. We need a working solution, not just suggestions.

