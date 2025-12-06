# Test Accounts for MetaMask Import

This document contains all test account private keys and addresses for use with the HealthChains application. These accounts are pre-funded with 10,000 ETH on the Hardhat local network (Chain ID: 1337).

## Overview

The system uses 20 Hardhat default accounts:
- **10 Patient Accounts** (Accounts 0-9)
- **10 Provider Accounts** (Accounts 10-19)

These accounts are automatically mapped to mock patient and provider data when the backend starts.

**Hardhat Mnemonic**: `test test test test test test test test test test test junk`

These accounts are **static and deterministic** - they will always be the same when using Hardhat's default configuration.

## Network Configuration

To use these accounts, configure MetaMask with:

- **Network Name**: Hardhat
- **RPC URL**: `http://127.0.0.1:8545`
- **Chain ID**: `1337`
- **Currency Symbol**: `ETH`

## Importing Accounts into MetaMask

1. Open MetaMask
2. Click the account icon (top right)
3. Select "Import Account"
4. Paste the private key from the table below
5. Click "Import"
6. The account will appear in your MetaMask wallet

**Important**: These accounts are for **testing only**. Never use these private keys on mainnet or any network with real value.

## Patient Accounts

| Index | Address | Private Key | Mock Data ID | Name |
|-------|---------|-------------|--------------|------|
| 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` | PAT-000001 | John Smith |
| 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` | PAT-000002 | Jane Johnson |
| 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` | PAT-000003 | Michael Williams |
| 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` | PAT-000004 | Sarah Brown |
| 4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` | PAT-000005 | David Jones |
| 5 | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | `0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba` | PAT-000006 | Emily Garcia |
| 6 | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | `0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e` | PAT-000007 | Robert Miller |
| 7 | `0x14dC79964da2C08b23698B3D3cc7Ca32193d9955` | `0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356` | PAT-000008 | Jessica Davis |
| 8 | `0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f` | `0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97` | PAT-000009 | William Rodriguez |
| 9 | `0xa0Ee7A142d267C1f36714E4a8F75612F20a79720` | `0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6` | PAT-000010 | Ashley Martinez |

## Provider Accounts

| Index | Address | Private Key | Mock Data ID | Organization Name |
|-------|---------|-------------|--------------|-------------------|
| 10 | `0xBcd4042DE499D14e55001CcbB24a551F3b954096` | `0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897` | PROV-000001 | Metropolitan General Hospital |
| 11 | `0x71bE63f3384f5fb98995898A86B02Fb2426c5788` | `0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82` | PROV-000002 | Advanced Cardiology Clinic |
| 12 | `0xFABB0ac9d68B0B445fB7357272Ff202C5651694a` | `0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1` | PROV-000003 | City Medical Center |
| 13 | `0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec` | `0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd` | PROV-000004 | Regional Diagnostic Labs |
| 14 | `0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097` | `0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa` | PROV-000005 | University Research Institute |
| 15 | `0xcd3B766CCDd6AE721141F452C550Ca635964ce71` | `0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61` | PROV-000006 | Community Health Pharmacy |
| 16 | `0x2546BcD3c84621e976D8185a91A922aE77ECEc30` | `0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0` | PROV-000007 | Precision Imaging Center |
| 17 | `0xbDA5747bFD65F08deb54cb465eB87D40e51B197E` | `0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd` | PROV-000008 | Comprehensive Care Clinic |
| 18 | `0xdD2FD4581271e230360230F9337D5c0430Bf44C0` | `0xde9be858da4a475276426320d5e9262ecfc3ba460bfac56360bfa6c4c28b4ee0` | PROV-000009 | Global Medical Research |
| 19 | `0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199` | `0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e` | PROV-000010 | Elite Diagnostics |

## Quick Reference

### First Provider (Recommended for Testing)
- **Address**: `0xBcd4042DE499D14e55001CcbB24a551F3b954096`
- **Private Key**: `0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897`
- **Organization**: Metropolitan General Hospital (PROV-000001)

### First Patient (Recommended for Testing)
- **Address**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Private Key**: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
- **Name**: John Smith (PAT-000001)

## Testing Workflow

1. **Start Hardhat Node**: `cd backend && npx hardhat node`
2. **Deploy Contract**: `cd backend && npm run deploy:hardhat`
3. **Start Backend**: `cd backend && npm run dev` (or use PM2)
4. **Start Frontend**: `cd frontend && npm run dev` (or use PM2)
5. **Import Account**: Use one of the private keys above to import into MetaMask
6. **Connect Wallet**: Click "Connect Wallet" in the frontend
7. **Test Flow**: 
   - As Provider: Request consent from patients
   - As Patient: Approve/deny requests, view consents

## Account Mapping

The backend automatically maps these accounts to mock data:
- Patient accounts (0-9) → Mock patients (PAT-000001 through PAT-000010)
- Provider accounts (10-19) → Mock providers (PROV-000001 through PROV-000010)

This mapping is defined in `backend/server.js` in the `attachDeterministicWallets()` function.

## Security Warning

⚠️ **NEVER** use these private keys on mainnet or any network with real value. These are test accounts only and their private keys are publicly known.

## Verification

To verify these accounts match Hardhat's default accounts, run:
```bash
cd backend && npx hardhat node
```

The addresses and private keys displayed will match the ones in this document.
