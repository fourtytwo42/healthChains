# Healthcare Blockchain Assessment

## Overview

This assessment project is designed to evaluate candidates for the **Senior Blockchain & Web3 Developer** position at AI Health Chains. The project focuses on building a decentralized patient consent management system using blockchain technology.

## Project Structure

```
.
├── backend/                 # Node.js backend server
│   ├── contracts/          # Solidity smart contracts
│   ├── services/           # Business logic services (Web3, Consent)
│   ├── routes/             # Express API routes
│   ├── middleware/         # Validation and error handling
│   ├── data/               # Complex mockup data files (auto-loads on startup)
│   ├── scripts/            # Deployment scripts
│   ├── test/              # Unit and integration tests
│   ├── server.js           # Express server
│   ├── API.md             # Complete API documentation
│   └── README.md          # Backend setup guide
├── frontend/               # Next.js App Router frontend
│   ├── app/               # Next.js App Router pages
│   ├── components/        # React components
│   ├── contexts/          # React contexts (Wallet)
│   ├── hooks/             # Custom hooks (API, mutations)
│   ├── lib/               # Utilities (API client, theme)
│   └── README.md          # Frontend setup guide
├── docs/                   # Documentation
│   ├── SMART_CONTRACT.md  # Smart contract documentation
│   └── ...
└── README.md              # This file
```

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Frontend  │──────▶│   Backend    │──────▶│   Smart     │
│  (Next.js)  │ REST  │  (Express)   │ Web3  │  Contract   │
│             │◀──────│  (Read-only) │◀──────│  (Solidity) │
│             │       └──────────────┘       └─────────────┘
│             │              │                      │
│             │              │                      │
│  MetaMask ──┼──────────────┼──────────────────────┘
│  (Signer)   │              │
└─────────────┘         Blockchain
                         (Hardhat)
```

### Data Flow

1. **Read Operations**: Frontend → Backend API → Smart Contract (read-only via backend)
2. **Write Operations**: Frontend → MetaMask Signer → Smart Contract (direct, user signs)
3. **Wallet Integration**: Frontend connects MetaMask for signing transactions
4. **Transaction Status**: Frontend waits for transaction confirmation, displays via toasts
5. **Security**: Private keys never leave MetaMask; backend never signs user transactions

## Assessment Requirements

### 1. Smart Contract Development (Primary Focus)

**Task:** Build and deploy the `PatientConsentManager.sol` smart contract.

**Requirements:**
- The contract should handle patient consent management
- Implement functions for granting, revoking, and checking consent
- Include access request functionality
- Add proper events for all state changes
- Ensure security best practices (access control, input validation)
- Write comprehensive comments and documentation

**What to Evaluate:**
- Code quality and organization
- Security considerations
- Gas optimization
- Event design
- Error handling
- Solidity best practices

### 2. Backend Integration

**Task:** The backend is already set up with complex mockup data that auto-loads.

**What's Provided:**
- Express server with REST API endpoints
- Complex patient data structures (demographics, medical history, lab results, imaging studies, genetic data)
- Complex provider data structures (staff, facilities, equipment, compliance records)
- Automatic data loading on server startup

**What to Evaluate:**
- Understanding of the existing backend structure
- Ability to integrate Web3/blockchain functionality
- API design and data handling

### 3. Frontend Development (Nice to have)

**Task:** Build a React frontend that connects to Web3 and interacts with the smart contract.

**Requirements:**
- Connect to Web3 wallet (MetaMask)
- Display patient and provider data from backend
- Interact with smart contract functions
- Simple, clean UI
- Handle transaction states and errors

**What to Evaluate:**
- Web3 integration skills
- React component structure
- User experience design
- Error handling
- State management

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MetaMask browser extension (for Web3 connection)
- Hardhat (for smart contract development)

### Installation

1. **Install dependencies:**

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

2. **Set up environment variables:**

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your configuration
```

### Running the Project

1. **Start a local blockchain (in a separate terminal):**

```bash
cd backend
npx hardhat node
```

This will start a local Hardhat network on `http://127.0.0.1:8545`

2. **Deploy the smart contract (in a new terminal):**

```bash
cd backend
npm run deploy:local
```

This will deploy the contract and save the address to `deployment.json`

3. **Start the backend server (in a new terminal):**

```bash
cd backend
npm run dev
```

The backend will start on `http://localhost:3001` and automatically load all mockup data.

4. **Copy contract ABI to frontend (required for direct contract calls):**

```bash
cp backend/artifacts/contracts/PatientConsentManager.sol/PatientConsentManager.json \
   frontend/public/contract-abi.json
```

5. **Start the frontend (in a new terminal):**

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:3000`

**Important**: Make sure to copy the contract ABI to `frontend/public/contract-abi.json` (see step 4 above) before starting the frontend. The ABI is required for direct contract calls via MetaMask.

### Connecting MetaMask

1. Open MetaMask
2. Add a new network:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `1337`
   - Currency Symbol: `ETH`
3. Import one of the Hardhat test accounts (private keys are displayed when you run `npx hardhat node`)

## Assessment Tasks

### Task 1: Smart Contract Review & Enhancement (Required)

Review the provided `PatientConsentManager.sol` contract and:

1. **Identify potential security issues** and suggest improvements
2. **Optimize gas usage** where possible
3. **Add missing functionality** that would be needed for production:
   - Batch operations (grant multiple consents at once)
   - Consent expiration handling
   - Access request approval workflow
   - Additional validation or checks

### Task 2: Backend Web3 Integration (Required)

Enhance the backend to:

1. **Load contract ABI** from compiled artifacts
2. **Create Web3 service** to interact with the contract
3. **Add endpoints** to:
   - Check consent status
   - Get consent history for a patient
   - Get access requests for a patient
   - Query contract events

### Task 3: Frontend Enhancement (Optional)

Improve the frontend:

1. **Load contract ABI** from artifacts (copied to `public/contract-abi.json`)
2. **Display consent history** from the blockchain (via backend API)
3. **Show access requests** and allow approval/denial (via direct MetaMask signing)
4. **Add transaction status** indicators (pending, confirmed, failed)
5. **Improve error handling** and user feedback
6. **Integrate MetaMask** for signing transactions directly (users sign their own transactions)

### Task 4: Additional Features (Bonus)

If time permits, consider:

1. **Event listening** - Listen to contract events in real-time
2. **Consent expiration** - Visual indicators for expiring consents
3. **Data encryption** - Add encryption layer for sensitive data
4. **Multi-signature** - Require multiple approvals for sensitive data access
5. **Analytics dashboard** - Show consent statistics and trends

## Evaluation Criteria

### Smart Contract (45%)
- Code quality and organization
- Security best practices
- Gas optimization
- Comprehensive testing (if provided)
- Documentation

### Backend Integration (35%)
- Web3 integration quality
- API design
- Error handling
- Code organization

### Frontend Development (Nice to have)
- Web3 wallet integration
- User interface quality
- State management
- Error handling

### Overall (20%)
- Code organization
- Documentation
- Best practices
- Problem-solving approach

## Submission Guidelines

1. **Fork or clone** this repository
2. **Complete the assessment tasks** listed above
3. **Document your changes** in code comments and/or a separate document
4. **Test your implementation** thoroughly
5. **Submit** your solution via:
   - GitHub repository link, or
   - Zip file with your code

## Testing

This project includes comprehensive testing infrastructure:

- **Smart Contract Tests**: Hardhat/Mocha tests with 95%+ coverage
- **Backend Tests**: Unit and integration tests using Mocha/Chai/Supertest
- **Frontend Tests**: Unit tests with Jest/React Testing Library and E2E tests with Playwright

### Quick Start

```bash
# Run all tests
npm run test:all

# Run specific test suites
npm run test:contract    # Smart contract tests
npm run test:backend     # Backend tests
npm run test:frontend    # Frontend unit tests
npm run test:e2e         # Frontend E2E tests
```

For detailed testing documentation, see [docs/TESTING.md](docs/TESTING.md).

## Notes

- The mockup data files (`mockup-patients.js` and `mockup-providers.js`) are intentionally complex to test your ability to work with realistic healthcare data structures
- Focus on the smart contract as the primary deliverable
- The backend and frontend are provided as scaffolding - enhance them as needed
- Security is paramount in healthcare applications - demonstrate your understanding of this

## Questions?

If you have any questions about the assessment, please reach out to the hiring team.

## Good Luck! 🚀

We're excited to see what you build!

