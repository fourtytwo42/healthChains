# Frontend - Healthcare Blockchain Assessment

Next.js App Router frontend with Tailwind CSS and shadcn/ui for the Healthcare Blockchain Patient Consent Management system.

## Features

- **Next.js 16** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **React Query** for data fetching and caching
- **MetaMask Wallet Integration** for Web3 transactions
- **Theme System** with light/dark/system modes
- **Responsive Design** with mobile-first approach
- **API Integration** with backend REST APIs only
- **Transaction Management** with toast notifications and status tracking

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Backend server running (see backend README)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local

# Edit .env.local with your backend URL
# NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

### Development

```bash
# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## MetaMask Integration

### Setup

1. Install MetaMask browser extension
2. Add Hardhat local network:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `1337`
   - Currency Symbol: `ETH`
3. Import a test account from Hardhat node (private keys displayed when running `npx hardhat node`)

### Usage

- Click "Connect Wallet" in the header to connect MetaMask
- The app will automatically detect network mismatches and prompt to switch
- **Write operations** (grant consent, revoke, approve/deny requests) are signed directly via MetaMask
- **Read operations** (view consents, requests, events) come from backend REST APIs
- Transaction status is shown via toast notifications
- MetaMask will prompt you to sign each transaction

### Architecture

- **Reads**: Frontend → Backend API → Smart Contract (read-only)
- **Writes**: Frontend → MetaMask Signer → Smart Contract (direct)
- Contract ABI is loaded from `public/contract-abi.json`
- Contract address is fetched from backend `/api/contract/info`

### Contract ABI Setup

The contract ABI file (`public/contract-abi.json`) is required for frontend contract interactions. It's automatically copied from backend artifacts, but if you recompile the contract, you'll need to update it:

```bash
# After recompiling the contract in backend
cp backend/artifacts/contracts/PatientConsentManager.sol/PatientConsentManager.json \
   frontend/public/contract-abi.json
```

The file contains the full contract ABI including all functions and events needed for direct contract calls.

### Environment Variables

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_CHAIN_ID=1337  # Hardhat local network
```

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/       # Dashboard route group
│   │   ├── layout.tsx     # Dashboard layout with sidebar
│   │   ├── page.tsx       # Dashboard home
│   │   ├── patients/      # Patients page
│   │   ├── consents/      # Consents page (with grant/revoke)
│   │   ├── requests/      # Requests page (with approve/deny)
│   │   └── events/        # Events page
│   ├── layout.tsx         # Root layout
│   ├── providers.tsx      # React Query + Theme + Wallet providers
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── layout/           # Layout components
│   ├── wallet-connector.tsx  # MetaMask wallet connector
│   ├── consent-grant-dialog.tsx  # Grant consent form
│   └── theme-toggle.tsx  # Theme switcher
├── contexts/              # React contexts
│   └── wallet-context.tsx  # Wallet state management
├── hooks/                # Custom React hooks
│   └── use-api.ts        # API hooks (queries + mutations with direct contract calls)
├── lib/                  # Utilities
│   ├── api-client.ts     # REST API client (read-only)
│   ├── contract.ts       # Contract interaction utilities (MetaMask signing)
│   ├── theme-provider.tsx # Theme provider wrapper
│   └── utils.ts          # Utility functions
└── public/               # Static assets
    └── contract-abi.json # Contract ABI for direct contract calls
```

## Pages

### Dashboard (`/`)
Overview with key statistics, quick actions, and system status.

### Patients (`/patients`)
Browse and search patient directory with patient details.

### Consents (`/consents`)
View and manage patient consent records with filtering options.

### Requests (`/requests`)
View access requests with status filtering (pending/approved/denied).

### Events (`/events`)
Blockchain events timeline for consents and access requests.

## API Integration

### Read Operations

All **read** data comes from backend REST APIs:
- Patient and provider data
- Consent status and history
- Access requests
- Blockchain events

### Write Operations

All **write** operations (transactions) are signed directly via MetaMask:
- Grant consent
- Revoke consent
- Request access
- Approve/deny requests

The frontend uses direct contract calls with MetaMask signer. See `lib/contract.ts` for contract interaction utilities.

### API Client

Located in `lib/api-client.ts`, provides typed methods for all backend endpoints:

- Health check
- Contract info
- Patients and providers
- Consent operations
- Access requests
- Event queries

### React Query Hooks

Located in `hooks/use-api.ts`, provides React Query hooks with:

- Automatic caching
- Request deduplication
- Error handling
- Loading states
- Retry logic

## Theming

The app supports three theme modes:

- **Light** - Light color scheme
- **Dark** - Dark color scheme  
- **System** - Follows OS preference (default)

Toggle theme using the button in the header.

### Design Tokens

Colors and spacing are defined in `app/globals.css` using CSS variables that adapt to light/dark themes.

## Components

### shadcn/ui Components

- Button
- Input
- Card
- Tabs
- Dialog
- Sonner (toasts)
- Skeleton
- Badge
- Select
- Switch
- Table
- Label

All components are customizable and follow the design system.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL | `http://localhost:3001` |

## Development Notes

### Adding New Pages

1. Create page in `app/(dashboard)/your-page/page.tsx`
2. Add navigation link in `components/layout/sidebar.tsx`
3. Use API hooks from `hooks/use-api.ts`

### Adding New API Endpoints

1. Add method to `lib/api-client.ts`
2. Create hook in `hooks/use-api.ts`
3. Use hook in components

### Styling

- Use Tailwind utility classes
- Follow shadcn/ui patterns
- Use design tokens from `globals.css`
- Ensure dark mode compatibility

## Testing

### Run Tests

```bash
# Unit tests
npm test                    # Run once
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report

# E2E tests
npm run test:e2e           # Headless
npm run test:e2e:ui        # UI mode
npm run test:e2e:headed    # Headed browser
```

### Test Structure

- **Unit Tests** (`tests/__tests__/`): Component, hook, and utility tests
- **E2E Tests** (`tests/e2e/`): End-to-end user flow tests
- **Test Utilities** (`tests/utils/`): Mock utilities and helpers

### Test Coverage

Tests cover:
- ✅ Critical components (wallet connector, consent dialog)
- ✅ Custom hooks (API hooks, wallet context)
- ✅ Utility functions (contract utilities, API client)
- ✅ User interactions and form validation
- ✅ Error states and loading states

For detailed testing documentation, see [docs/TESTING.md](../docs/TESTING.md).

## Performance

- React Query caching reduces API calls
- Skeleton loaders for better perceived performance
- Lazy loading for heavy components
- Optimized bundle with Next.js

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT
