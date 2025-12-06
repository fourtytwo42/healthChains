# Core Features

This document provides an overview of all core features in HealthChains.

## Table of Contents

1. [Consent Management](#consent-management)
2. [Access Request Workflow](#access-request-workflow)
3. [Batch Operations](#batch-operations)
4. [Event System](#event-system)
5. [Patient Management](#patient-management)
6. [Provider Management](#provider-management)
7. [Search & Filtering](#search--filtering)
8. [Export & Reporting](#export--reporting)

## Consent Management

### Grant Consent

**Purpose**: Allow patients to grant providers access to their healthcare data.

**Features**:
- Grant consent to specific data types (single or multiple)
- Specify purposes for data access (single or multiple)
- Set optional expiration dates
- Always uses efficient `BatchConsentRecord` structure
- Covers all combinations automatically (dataTypes × purposes)

**Use Cases**:
- Patient proactively grants access
- Provider requests and patient approves
- Grant multiple data types/purposes at once (e.g., 3 data types × 2 purposes = 6 combinations in one consent)

**Implementation**: Smart contract function `grantConsent(provider, dataTypes[], expirationTime, purposes[])` with event emission.

### Revoke Consent

**Purpose**: Allow patients to revoke previously granted access.

**Features**:
- Immediate revocation
- Preserves consent history (inactive but visible)
- Works for both single and batch consents
- Requires patient signature

**Use Cases**:
- Patient no longer wants provider to have access
- Consent has been misused
- Provider relationship ended

**Implementation**: Smart contract function `revokeConsent()` with access control.

### View Consents

**Purpose**: View all consent records with filtering and search.

**Features**:
- View active and inactive consents
- Filter by provider, status, data type
- Search functionality
- Sort by date, provider, status
- Export to CSV

**Implementation**: Backend API queries blockchain events and maintains indexes.

## Access Request Workflow

### Request Access

**Purpose**: Allow providers to request access to patient data.

**Features**:
- Request multiple data types in one request
- Request multiple purposes
- Set optional expiration for request
- Automatic notification to patient

**Use Cases**:
- Provider needs access for treatment
- Provider wants access for research
- New provider needs historical data

**Implementation**: Smart contract function `requestAccess()` with event emission.

### Approve/Deny Request

**Purpose**: Allow patients to respond to access requests.

**Features**:
- Approve request (creates consent automatically)
- Deny request (no consent created)
- Automatic expiration handling
- Batch consent creation on approval

**Use Cases**:
- Patient approves legitimate request
- Patient denies inappropriate request
- Request expired before response

**Implementation**: Smart contract function `respondToAccessRequest()` with automatic consent creation.

### View Requests

**Purpose**: View all access requests with status filtering.

**Features**:
- Filter by status (Pending/Approved/Denied)
- View request details
- See requested data types and purposes
- Track request history

**Implementation**: Backend API queries blockchain events and maintains indexes.

## Batch Operations

### Consent Grant with Multiple Combinations

**Purpose**: Grant consent covering multiple data type/purpose combinations in a single transaction.

**Features**:
- Grant to one provider with multiple data types and purposes
- Automatically covers all combinations (dataTypes × purposes)
- Gas-efficient (up to 92% savings vs individual records)
- Atomic operation (all or nothing)
- Always uses `BatchConsentRecord` structure

**Use Cases**:
- Grant access with multiple data types (e.g., medical_records, genetic_data, imaging_data)
- Grant access for multiple purposes (e.g., treatment, research, diagnosis)
- Reduce transaction costs for complex consents

**Implementation**: Smart contract function `grantConsent(provider, dataTypes[], expirationTime, purposes[])` with validation.

**Example**:
- Input: `dataTypes = ["medical_records", "genetic_data"]`, `purposes = ["treatment", "research"]`
- Result: ONE consent covering 4 combinations (2 × 2)
- Gas: ~250,000 gas vs ~1.28M gas for 4 individual records (80% savings)

### Batch Access Request

**Purpose**: Request multiple data types and purposes in one request.

**Features**:
- Request multiple data types
- Request multiple purposes
- Creates cartesian product on approval
- Single transaction for multiple items

**Use Cases**:
- Provider needs multiple data types
- Provider needs data for multiple purposes
- Reduce transaction overhead

**Implementation**: Smart contract function `requestAccess()` with array parameters.

### Batch Consent Record

**Purpose**: Store multiple data types/purposes in one consent record.

**Features**:
- Efficient storage (one struct vs many)
- Gas savings (~200,000 gas for 10 consents)
- Single consent ID for multiple items
- Easy to query and manage

**Implementation**: `BatchConsentRecord` struct with arrays of hashes.

## Event System

### Event Types

**Consent Events**:
- `ConsentGranted`: Consent granted (includes array of consent IDs, typically one)
  - Event structure: `(address indexed patient, uint256[] consentIds, uint128 timestamp)`
  - Always uses `BatchConsentRecord` structure
- `ConsentRevoked`: Consent revoked
- `ConsentExpired`: Consent expired (future use)

**Request Events**:
- `AccessRequested`: Access request created
- `AccessApproved`: Request approved
- `AccessDenied`: Request denied

### Event Querying

**Purpose**: Query blockchain events for consent history and status.

**Features**:
- Query by patient address
- Query by provider address
- Query by consent ID
- Filter by event type
- Date range filtering

**Implementation**: Backend service indexes events and provides query API.

### Audit Trail

**Purpose**: Immutable record of all consent activities.

**Features**:
- All actions logged on blockchain
- Timestamp for each action
- Complete history available
- Cannot be tampered with

**Implementation**: All state changes emit events on blockchain.

## Patient Management

### Patient Directory

**Purpose**: Browse and search patient directory.

**Features**:
- List all patients
- Search by name, ID, address
- Search by date of birth (flexible formats)
- Filter by demographics
- View patient details

**Implementation**: Backend API with mockup data.

### Patient Details

**Purpose**: View comprehensive patient information.

**Features**:
- Demographics
- Medical history
- Lab results
- Imaging studies
- Genetic data
- Consent-based access control

**Implementation**: Backend API with access control based on active consents.

## Provider Management

### Provider Directory

**Purpose**: Browse and search provider directory.

**Features**:
- List all providers
- Search by name, organization
- View provider details
- View staff and facilities

**Implementation**: Backend API with mockup data.

### Provider Details

**Purpose**: View provider organization information.

**Features**:
- Organization information
- Staff members
- Facilities
- Equipment
- Compliance records

**Implementation**: Backend API with provider data.

## Search & Filtering

### Patient Search

**Purpose**: Find patients quickly and efficiently.

**Features**:
- Search by name (partial match)
- Search by patient ID
- Search by wallet address
- Search by date of birth:
  - `MM/DD/YYYY`
  - `DD/MM/YYYY`
  - `YYYY/MM/DD`
  - `January 15, 1990`
  - `1990` (year only)
- Search by other demographics

**Implementation**: Frontend filtering with flexible date parsing.

### Consent Filtering

**Purpose**: Filter consents by various criteria.

**Features**:
- Filter by status (Active/Inactive/All)
- Filter by provider
- Filter by data type
- Filter by purpose
- Filter by expiration status
- Sort by date, provider, status

**Implementation**: Frontend filtering with backend data.

### Request Filtering

**Purpose**: Filter access requests by status.

**Features**:
- Filter by status (Pending/Approved/Denied/All)
- Filter by patient
- Filter by provider
- Sort by date, status

**Implementation**: Frontend filtering with backend data.

## Export & Reporting

### CSV Export

**Purpose**: Export data for external analysis.

**Features**:
- Export patient list
- Export consent records
- Export access requests
- All visible columns included
- Formatted CSV format

**Implementation**: Frontend CSV generation from table data.

### Print Functionality

**Purpose**: Print formatted reports.

**Features**:
- Print patient lists
- Print consent records
- Print access requests
- Formatted for printing
- All visible data included

**Implementation**: Frontend HTML/CSS print styles.

## User Interface Features

### Responsive Design

**Purpose**: Works on all device sizes.

**Features**:
- Mobile-first design
- Responsive layouts
- Touch-friendly interfaces
- Adaptive navigation

**Implementation**: Tailwind CSS responsive utilities.

### Dark Mode

**Purpose**: Comfortable viewing in low light.

**Features**:
- Light/dark theme toggle
- System preference detection
- Persistent theme selection
- Smooth transitions

**Implementation**: Next.js theme system with Tailwind.

### Real-time Updates

**Purpose**: Show latest data without page refresh.

**Features**:
- React Query caching
- Automatic refetch on focus
- Transaction status tracking
- Toast notifications

**Implementation**: React Query with automatic refetching.

### Transaction Status

**Purpose**: Keep users informed about blockchain transactions.

**Features**:
- Pending state indication
- Confirmation waiting
- Success/error notifications
- Transaction hash display

**Implementation**: MetaMask transaction tracking with toasts.

## Performance Features

### Gas Optimization

**Purpose**: Minimize transaction costs.

**Features**:
- Struct packing
- Hash storage
- Batch operations
- Custom errors

**Implementation**: Smart contract gas optimizations.

### Caching

**Purpose**: Reduce API calls and improve performance.

**Features**:
- React Query caching
- Stale-while-revalidate
- Request deduplication
- Background refetching

**Implementation**: React Query with default caching.

### Lazy Loading

**Purpose**: Load data on demand.

**Features**:
- Route-based code splitting
- Component lazy loading
- Image optimization
- On-demand data loading

**Implementation**: Next.js automatic code splitting.

## Related Documentation

- [Consent Management](consent-management.md) - Detailed consent workflows
- [Access Requests](access-requests.md) - Request/approval workflow
- [Batch Operations](batch-operations.md) - Batch operation details
- [Event System](event-system.md) - Event logging and querying

