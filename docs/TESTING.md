# Testing Guide

## Overview

This project includes comprehensive testing infrastructure covering:
- **Smart Contract Tests** (Hardhat/Mocha) - 95%+ coverage
- **Backend Unit Tests** (Mocha/Chai/Sinon) - 80%+ coverage target
- **Backend Integration Tests** (Supertest) - API endpoint testing
- **Frontend Unit Tests** (Jest/React Testing Library) - 70%+ coverage target
- **Frontend E2E Tests** (Playwright) - Critical user flows

## Quick Start

### Run All Tests

```bash
# From project root
npm run test:all
```

This runs all test suites in sequence and provides a summary.

### Run Individual Test Suites

```bash
# Smart contract tests
npm run test:contract

# Backend tests (unit + integration)
npm run test:backend

# Frontend unit tests
npm run test:frontend

# Frontend E2E tests
npm run test:e2e
```

## Test Structure

```
.
├── backend/
│   ├── test/
│   │   ├── PatientConsentManager.test.js    # Smart contract tests
│   │   ├── services/                        # Backend unit tests
│   │   │   ├── consentService.test.js
│   │   │   └── web3Service.test.js
│   │   └── integration/                     # Backend integration tests
│   │       ├── consentRoutes.test.js
│   │       ├── patientRoutes.test.js
│   │       ├── providerRoutes.test.js
│   │       └── healthRoutes.test.js
├── frontend/
│   ├── tests/
│   │   ├── __tests__/                       # Frontend unit tests
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   ├── e2e/                             # E2E tests
│   │   │   ├── wallet-connection.spec.ts
│   │   │   ├── consent-granting.spec.ts
│   │   │   └── navigation.spec.ts
│   │   └── utils/                           # Test utilities
│   │       ├── test-utils.tsx
│   │       ├── mock-wallet.ts
│   │       ├── mock-api.ts
│   │       └── mock-contract.ts
└── scripts/
    └── test-all.sh                          # Master test runner
```

## Smart Contract Tests

### Location
`backend/test/PatientConsentManager.test.js`

### Running Tests

```bash
cd backend
npm test
```

### Test Coverage

- **Security Tests**: Reentrancy, access control, input validation
- **Functionality Tests**: All contract functions and edge cases
- **Gas Benchmarks**: Single vs batch operations, optimization metrics
- **Stress Tests**: Maximum batch size, many consents per patient, concurrent operations

### Key Test Categories

1. **Access Control**: Only patients can grant/revoke their own consents
2. **Input Validation**: Address validation, string length limits, expiration checks
3. **Gas Optimization**: Batch operations vs individual calls
4. **Stress Testing**: 50+ consents in batch, 100+ consents per patient
5. **Integration Scenarios**: Complete workflows (request → approve → grant)

### Example Test

```javascript
it('Should grant consent successfully', async function () {
  const tx = await consentManager.connect(patient).grantConsent(
    provider.address,
    'medical_records',
    expirationTime,
    'treatment'
  );
  const receipt = await tx.wait();
  
  expect(receipt.status).to.equal(1);
});
```

## Backend Tests

### Unit Tests

**Location**: `backend/test/services/`

Tests individual service functions in isolation using mocks.

```bash
cd backend
npm run test:backend
```

### Integration Tests

**Location**: `backend/test/integration/`

Tests API endpoints with real Express app and contract interactions.

```bash
cd backend
npm run test:backend
```

### Test Coverage

- **Consent Routes**: Status checks, history, events
- **Patient Routes**: List, get by ID, get data by type
- **Provider Routes**: List, get by ID
- **Health Routes**: Health check, contract info, data types, purposes
- **Error Handling**: Invalid inputs, missing parameters, not found

### Example Test

```javascript
it('should return consent status', async function () {
  const res = await request(app)
    .get('/api/consent/status')
    .query({
      patientAddress: patientAddress,
      providerAddress: providerAddress,
      dataType: 'medical_records'
    });

  expect(res.status).to.equal(200);
  expect(res.body.success).to.be.true;
});
```

## Frontend Unit Tests

### Location
`frontend/tests/__tests__/`

### Running Tests

```bash
cd frontend
npm test                    # Run once
npm run test:watch         # Watch mode
npm run test:coverage       # With coverage report
```

### Test Utilities

- **test-utils.tsx**: Custom render with providers (React Query, Theme)
- **mock-wallet.ts**: Mock MetaMask wallet for testing
- **mock-api.ts**: MSW handlers for API mocking
- **mock-contract.ts**: Mock ethers contract instances

### Test Coverage

- **Components**: Wallet connector, consent grant dialog, layouts
- **Hooks**: API hooks, wallet context
- **Utilities**: Contract utilities, API client

### Example Test

```typescript
it('should display connected wallet address', () => {
  mockUseWallet.mockReturnValue({
    isConnected: true,
    account: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    // ...
  });

  render(<WalletConnector />);
  expect(screen.getByText('0xf39f...2266')).toBeInTheDocument();
});
```

## Frontend E2E Tests

### Location
`frontend/tests/e2e/`

### Setup

```bash
cd frontend
npx playwright install --with-deps chromium
```

### Running Tests

```bash
cd frontend
npm run test:e2e           # Headless
npm run test:e2e:ui        # UI mode
npm run test:e2e:headed    # Headed browser
```

### Test Scenarios

- **Wallet Connection**: Connect/disconnect, network switching
- **Consent Granting**: Complete form flow, multi-select, date picker
- **Navigation**: Page routing, header/sidebar consistency

### Example Test

```typescript
test('should connect wallet successfully', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Connect Wallet').click();
  await page.getByRole('button', { name: /connect metamask/i }).click();
  
  await expect(page.getByText(/0xf39f...2266/i)).toBeVisible();
});
```

## Writing New Tests

### Smart Contract Tests

1. Use Hardhat's `ethers.getSigners()` for accounts
2. Deploy contract in `before()` hook
3. Test both success and failure cases
4. Include gas measurements for optimization

```javascript
describe('New Feature', function () {
  it('Should do something', async function () {
    const tx = await contract.connect(signer).newFunction();
    const receipt = await tx.wait();
    expect(receipt.status).to.equal(1);
  });
});
```

### Backend Tests

1. Create Express app in `before()` hook
2. Use Supertest for HTTP requests
3. Mock external dependencies (Web3 service)
4. Test error cases

```javascript
describe('New Endpoint', function () {
  it('should return data', async function () {
    const res = await request(app)
      .get('/api/new-endpoint');
    
    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
  });
});
```

### Frontend Unit Tests

1. Use `render` from `test-utils.tsx` for providers
2. Mock hooks and API calls
3. Test user interactions with `@testing-library/user-event`
4. Test loading, error, and success states

```typescript
it('should handle user interaction', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);
  
  await user.click(screen.getByRole('button'));
  expect(screen.getByText('Expected')).toBeInTheDocument();
});
```

### E2E Tests

1. Mock `window.ethereum` for MetaMask
2. Use Playwright's page object model for complex flows
3. Test critical user journeys end-to-end
4. Include assertions for UI state

```typescript
test('should complete workflow', async ({ page }) => {
  await page.goto('/');
  // ... perform actions
  await expect(page.getByText('Success')).toBeVisible();
});
```

## Coverage Goals

- **Smart Contracts**: 95%+ (maintained)
- **Backend**: 80%+ (target)
- **Frontend**: 70%+ (target)

### View Coverage Reports

```bash
# Backend
cd backend
npm test -- --coverage

# Frontend
cd frontend
npm run test:coverage
```

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm run test:all
```

## Debugging Tests

### Smart Contract Tests

```bash
# Run with console.log output
cd backend
npm test -- --grep "test name"

# Run single test file
npm test -- test/PatientConsentManager.test.js
```

### Backend Tests

```bash
# Run with verbose output
cd backend
npm test -- --reporter spec

# Run single test file
npm test -- test/integration/consentRoutes.test.js
```

### Frontend Tests

```bash
# Run in watch mode
cd frontend
npm run test:watch

# Run single test file
npm test -- consent-grant-dialog.test.tsx
```

### E2E Tests

```bash
# Run with UI mode (interactive)
cd frontend
npm run test:e2e:ui

# Run with headed browser
npm run test:e2e:headed

# Debug specific test
npm run test:e2e -- wallet-connection.spec.ts
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Mock External Dependencies**: Don't rely on external services
3. **Test Edge Cases**: Empty inputs, null values, boundary conditions
4. **Clear Test Names**: Describe what is being tested
5. **Arrange-Act-Assert**: Structure tests clearly
6. **Fast Tests**: Unit tests should be fast (< 100ms each)
7. **E2E for Critical Paths**: Only test critical user journeys end-to-end

## Troubleshooting

### Tests Failing Locally

1. Ensure Hardhat node is running for contract tests
2. Check environment variables are set correctly
3. Verify all dependencies are installed
4. Clear test caches: `npm test -- --clearCache`

### E2E Tests Failing

1. Ensure frontend dev server is running
2. Check Playwright browsers are installed
3. Verify MetaMask mocks are set up correctly
4. Check for timing issues (add `waitFor`)

### Coverage Not Meeting Goals

1. Identify untested code paths
2. Add tests for error cases
3. Test edge cases and boundary conditions
4. Review coverage reports to find gaps

## Additional Resources

- [Hardhat Testing Guide](https://hardhat.org/docs/guides/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Mocha Documentation](https://mochajs.org/)

