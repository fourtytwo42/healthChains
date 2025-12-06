# HealthChains - Healthcare Blockchain Consent Management System

A decentralized patient consent management system built on Ethereum, enabling secure, transparent, and auditable healthcare data access permissions. This system allows patients to grant, manage, and revoke consent for healthcare providers to access their medical data, with all consent records stored immutably on the blockchain.

## 🎯 Overview

HealthChains provides a complete solution for managing patient consent in healthcare settings using blockchain technology. It ensures:

- **Transparency**: All consent decisions are recorded on-chain
- **Security**: Patient private keys never leave their wallets
- **Auditability**: Complete immutable audit trail of all consent activities
- **User Control**: Patients maintain full control over their data access permissions
- **Efficiency**: Gas-optimized smart contracts with batch operations support

## 📚 Documentation Index

### 🏗️ Architecture & Design

- **[Architecture Overview](docs/architecture/overview.md)** - System architecture, design decisions, and technical choices
- **[Smart Contract Design](docs/architecture/smart-contract-design.md)** - Contract structure, data models, and design rationale

### 🚀 Getting Started

- **[Quick Start Guide](QUICK_START.md)** - Get up and running in minutes
- **[Deployment Guide](docs/deployment/deployment.md)** - Deploy to various environments

### 📖 User Guides

- **[Frontend User Guide](docs/guides/frontend-usage.md)** - How to use the web application
- **[Test Accounts](docs/TEST_ACCOUNTS.md)** - List of test accounts and credentials

### 🧪 Testing

- **[Testing Overview](docs/TESTING.md)** - Complete testing documentation
- **[Test Accounts](docs/TEST_ACCOUNTS.md)** - Test account credentials

### 🔒 Security

- **[Security Overview](docs/security/security-overview.md)** - Security architecture and practices

### ⚡ Features

- **[Core Features](docs/features/core-features.md)** - Main functionality overview

### 🔧 API Documentation

- **[API Overview](docs/api/api-overview.md)** - REST API documentation

### 📈 Scalability & Performance

- **[Scalability Overview](docs/scalability/overview.md)** - Scaling considerations and strategies

### 📝 Additional Documentation

- **[Smart Contract Design](docs/architecture/smart-contract-design.md)** - Complete contract design and API reference
- **[Backend README](backend/README.md)** - Backend-specific documentation
- **[Frontend README](frontend/README.md)** - Frontend-specific documentation
- **[PM2 Setup](PM2_SETUP.md)** - Process management setup

## 🏃 Quick Start

```bash
# 1. Install dependencies
npm install
cd backend && npm install
cd ../frontend && npm install

# 2. Start Hardhat blockchain
cd backend && npx hardhat node

# 3. Deploy contract (in new terminal)
cd backend && npm run deploy:hardhat

# 4. Start backend (in new terminal)
cd backend && npm run dev

# 5. Start frontend (in new terminal)
cd frontend && npm run dev
```

See [Quick Start Guide](QUICK_START.md) for detailed instructions.

## 📁 Project Structure

```
healthChains/
├── backend/                 # Node.js/Express backend
│   ├── contracts/          # Solidity smart contracts
│   ├── services/           # Business logic (Web3, Consent)
│   ├── routes/             # Express API routes
│   ├── middleware/         # Validation and error handling
│   ├── data/               # Mockup data (auto-loads)
│   ├── scripts/            # Deployment scripts
│   ├── test/               # Unit and integration tests
│   └── server.js           # Express server entry point
├── frontend/               # Next.js frontend
│   ├── app/                # Next.js App Router pages
│   ├── components/         # React components
│   ├── contexts/           # React contexts (Wallet)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities (API, contract)
│   └── public/             # Static assets
├── docs/                   # Comprehensive documentation
│   ├── architecture/       # Architecture documentation
│   ├── deployment/         # Deployment guides
│   ├── guides/             # User and developer guides
│   ├── security/           # Security documentation
│   ├── scalability/        # Scalability considerations
│   ├── features/           # Feature documentation
│   └── api/                # API documentation
└── README.md              # This file
```

## 🏛️ Architecture Overview

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

## ✨ Key Features

- **🔐 Secure Consent Management**: Grant, revoke, and manage patient consents with full blockchain transparency
- **📋 Access Request Workflow**: Providers can request access; patients approve or deny
- **⚡ Batch Operations**: Efficient batch consent operations to reduce gas costs
- **⏰ Expiration Handling**: Automatic expiration checks for time-limited consents
- **📊 Comprehensive Events**: Full audit trail via blockchain events
- **🎨 Modern UI**: Beautiful, responsive interface built with Next.js and Tailwind CSS
- **🔒 Security First**: Reentrancy protection, input validation, access control
- **💰 Gas Optimized**: Efficient storage layout, custom errors, hash-based string storage

## 🛠️ Technology Stack

- **Smart Contracts**: Solidity ^0.8.20, OpenZeppelin Contracts
- **Blockchain**: Hardhat (development), Ethereum-compatible
- **Backend**: Node.js, Express, Ethers.js v6, JWT Authentication, Redis Caching
- **Frontend**: Next.js 16, React, TypeScript, Tailwind CSS, shadcn/ui
- **Testing**: Hardhat, Mocha, Chai, Jest, Playwright
- **Process Management**: PM2
- **Caching**: Redis (recommended, graceful degradation if unavailable)
- **Authentication**: JWT tokens with MetaMask signature verification

## 🔐 Security Highlights

- ✅ **JWT Authentication**: MetaMask signature-based authentication for all API endpoints
- ✅ **Role-Based Access Control**: Patients and providers have different access levels
- ✅ **Least Privilege**: Users can only access their own data or data they have consent for
- ✅ **ReentrancyGuard**: Protection on all state-changing functions
- ✅ **Comprehensive Input Validation**: All inputs validated at multiple layers
- ✅ **Access Control**: Ownership verification and participant verification middleware
- ✅ **Custom Errors**: Gas-efficient reverts with no sensitive data leakage
- ✅ **Event-Based Queries**: No unbounded loops, scalable off-chain indexing
- ✅ **Redis Caching**: Performance optimization with graceful degradation
- ✅ **No Private Key Storage**: Keys never leave MetaMask wallet

See [Security Documentation](docs/security/security-overview.md) for complete details.

## 📊 Test Coverage

- **Smart Contract**: 79 tests, comprehensive coverage
- **Backend**: Unit and integration tests
- **Frontend**: Unit and E2E tests

## 🚢 Deployment

See the [Deployment Guide](docs/deployment/deployment.md) for:
- Local development deployment
- Production deployment considerations
- Environment configuration
- PM2 process management

## 🤝 Contributing

This is an assessment project. For questions or issues, please refer to the comprehensive documentation in the `/docs` folder.

## 📄 License

MIT License - See LICENSE file for details

## 🆘 Support

For detailed documentation, see:
- **[Architecture Documentation](docs/architecture/overview.md)** - Understanding the system
- **[User Guides](docs/guides/)** - How to use the application
- **[API Documentation](docs/api/)** - Backend API reference
- **[Testing Guide](docs/TESTING.md)** - Testing documentation

---

**Built with ❤️ for secure, transparent healthcare data management**
