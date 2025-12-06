# Frontend Component Structure

## Overview

The HealthChains frontend has been refactored to follow a modular component architecture, with large components split into smaller, focused components and custom hooks for business logic.

## Component Size Reduction

### Provider Dashboard (`app/(dashboard)/provider/page.tsx`)

**Before**: 2007 lines  
**After**: 216 lines  
**Reduction**: 89% reduction

#### Components Extracted:

1. **`ProviderDashboardHeader`** (`components/provider/dashboard/provider-dashboard-header.tsx`)
   - Displays provider name and description
   - Simple header component

2. **`ProviderTabs`** (`components/provider/dashboard/provider-tabs.tsx`)
   - Tab navigation component
   - Handles tab switching

3. **`ProviderPatientsTable`** (`components/provider/dashboard/provider-patients-table.tsx`)
   - Table displaying all patients
   - Includes search, sorting, and pagination
   - Handles patient selection

4. **`ProviderPendingRequests`** (`components/provider/dashboard/provider-pending-requests.tsx`)
   - Displays pending access requests
   - Includes search and pagination
   - Handles request selection

5. **`ProviderGrantedConsents`** (`components/provider/dashboard/provider-granted-consents.tsx`)
   - Displays patients with granted consents
   - Includes search and pagination
   - Handles patient selection

6. **`ProviderConsentHistory`** (`components/provider/dashboard/provider-consent-history.tsx`)
   - Displays consent history timeline
   - Card-based layout with event styling
   - Handles event selection

#### Custom Hook:

- **`useProviderDashboard`** (`hooks/provider/use-provider-dashboard.ts`)
  - Contains all data fetching logic
  - Handles filtering, sorting, and pagination
  - Manages state for selections and tabs
  - Includes export/print functions

### Patient Details Card (`components/provider/patient-details-card.tsx`)

**Before**: 1239 lines  
**After**: 429 lines  
**Reduction**: 65% reduction

#### Components Extracted:

1. **`PatientDetailsHeader`** (`components/provider/patient-details/patient-details-header.tsx`)
   - Displays patient demographics and contact info
   - Shows patient ID and wallet address

2. **`VitalSignsChart`** (`components/provider/patient-details/vital-signs-chart.tsx`)
   - Recharts line chart for vital signs
   - Custom tooltip component
   - Displays systolic/diastolic BP, heart rate, temperature, O2 saturation

3. **`MedicalDataSection`** (`components/provider/patient-details/medical-data-section.tsx`)
   - Reusable collapsible section component
   - Handles consent status display
   - Shows empty states and no-consent states
   - Used for all medical data sections (vital signs, medications, records, etc.)

4. **`ExportPrintControls`** (`components/provider/patient-details/export-print-controls.tsx`)
   - Export to CSV and Print buttons
   - Loading states for async operations
   - Request consent dialog integration

#### Custom Hook:

- **`usePatientData`** (`hooks/patient/use-patient-data.ts`)
  - Fetches patient data via `useProviderPatientData`
  - Manages expanded sections state
  - Handles vital signs pagination
  - Contains export/print functions
  - Provides helper functions for consent checking

## Directory Structure

```
frontend/
├── app/
│   └── (dashboard)/
│       └── provider/
│           └── page.tsx (216 lines - refactored)
├── components/
│   └── provider/
│       ├── dashboard/
│       │   ├── provider-dashboard-header.tsx
│       │   ├── provider-tabs.tsx
│       │   ├── provider-patients-table.tsx
│       │   ├── provider-pending-requests.tsx
│       │   ├── provider-granted-consents.tsx
│       │   └── provider-consent-history.tsx
│       └── patient-details/
│           ├── patient-details-header.tsx
│           ├── vital-signs-chart.tsx
│           ├── medical-data-section.tsx
│           └── export-print-controls.tsx
└── hooks/
    ├── provider/
    │   └── use-provider-dashboard.ts
    └── patient/
        └── use-patient-data.ts
```

## Benefits

1. **Maintainability**: Smaller, focused components are easier to understand and modify
2. **Reusability**: Components can be reused in different contexts
3. **Testability**: Smaller components are easier to test in isolation
4. **Performance**: Code splitting opportunities for lazy loading
5. **Developer Experience**: Easier to navigate and find specific functionality
6. **Separation of Concerns**: Business logic separated from UI rendering

## Best Practices

1. **Custom Hooks**: Extract data fetching and business logic into custom hooks
2. **Component Composition**: Build complex UIs from smaller, focused components
3. **Single Responsibility**: Each component should have one clear purpose
4. **Props Interface**: Define clear TypeScript interfaces for component props
5. **File Size**: Target component files under 500 lines when possible

## Future Improvements

- Further component memoization for performance
- Lazy loading for heavy components (charts, dialogs)
- Additional test coverage for new components
- Storybook documentation for component library

