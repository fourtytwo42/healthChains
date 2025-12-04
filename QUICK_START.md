# Quick Start Guide

## Prerequisites

- Node.js v18+ installed
- MetaMask browser extension
- Git (optional)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Install all dependencies
npm run install:all
```

Or manually:

```bash
# Root
npm install

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Start Local Blockchain

Open a terminal and run:

```bash
cd backend
npx hardhat node
```

Keep this terminal open. You'll see:
- Local network running on `http://127.0.0.1:8545`
- 20 test accounts with private keys
- Each account has 10000 ETH

**Note:** Copy one of the private keys - you'll need it for MetaMask.

### 3. Deploy Smart Contract

Open a **new terminal** and run:

```bash
cd backend
npm run deploy:local
```

This will:
- Compile the contract
- Deploy to local Hardhat network
- Save deployment info to `deployment.json`

You should see output like:
```
PatientConsentManager deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### 4. Configure MetaMask

1. Open MetaMask
2. Click network dropdown → "Add Network" → "Add a network manually"
3. Enter:
   - **Network Name**: Hardhat Local
   - **RPC URL**: `http://127.0.0.1:8545`
   - **Chain ID**: `1337`
   - **Currency Symbol**: `ETH`
4. Click "Save"
5. Import a test account:
   - Click account icon → "Import Account"
   - Paste one of the private keys from step 2
   - Name it "Test Account"

### 5. Start Backend Server

Open a **new terminal** and run:

```bash
cd backend
npm run dev
```

The server will:
- Start on `http://localhost:3001`
- Auto-load mockup patient and provider data
- Display available endpoints

### 6. Start Frontend

Open a **new terminal** and run:

```bash
cd frontend
npm start
```

The frontend will:
- Start on `http://localhost:3000`
- Open automatically in your browser

### 7. Connect and Test

1. In the browser, click "Connect Wallet" in the Web3 Connection section
2. Approve MetaMask connection
3. You should see your account address
4. Try granting consent or requesting access

## Troubleshooting

### Contract Not Deployed

If you see "Contract not deployed" error:
- Make sure you ran `npm run deploy:local`
- Check that `backend/deployment.json` exists
- Verify the contract address in the file

### MetaMask Connection Issues

- Make sure MetaMask is on the "Hardhat Local" network
- Check that you're using a test account with ETH
- Try disconnecting and reconnecting

### Backend Not Loading Data

- Check that the server started successfully
- Look for the startup log showing patient/provider counts
- Verify `backend/data/mockup-patients.js` and `mockup-providers.js` exist

### Frontend Can't Connect to Backend

- Verify backend is running on port 3001
- Check browser console for CORS errors
- Make sure `REACT_APP_API_URL` is set correctly (defaults to `http://localhost:3001`)

## Next Steps

Once everything is running:

1. Review the smart contract code
2. Test all contract functions
3. Enhance the frontend/backend integration
4. Add your improvements

See `ASSESSMENT_INSTRUCTIONS.md` for detailed task requirements.

## Useful Commands

```bash
# Compile contract
cd backend && npm run compile:contract

# Run tests
cd backend && npm run test:contract

# Deploy contract
cd backend && npm run deploy:local

# Start backend
cd backend && npm run dev

# Start frontend
cd frontend && npm start
```

## Need Help?

- Check the main `README.md` for detailed documentation
- Review `ASSESSMENT_INSTRUCTIONS.md` for task requirements
- Check browser console and terminal logs for errors

Good luck! 🚀

