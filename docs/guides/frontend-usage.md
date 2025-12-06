# Frontend User Guide

This guide explains how to use the HealthChains web application from a user perspective.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Connecting Your Wallet](#connecting-your-wallet)
3. [Dashboard Overview](#dashboard-overview)
4. [Patient Features](#patient-features)
5. [Provider Features](#provider-features)
6. [Understanding Roles](#understanding-roles)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Edge, Brave)
- MetaMask browser extension installed
- MetaMask configured with the correct network (see [Deployment Guide](../deployment/deployment.md))
- Test account imported into MetaMask (see [Test Accounts](../TEST_ACCOUNTS.md))

### Accessing the Application

1. Navigate to the application URL (e.g., `http://localhost:3000` for local development)
2. The application will load the home page
3. You'll see a "Connect Wallet" button in the header

## Connecting Your Wallet

### Step-by-Step Connection

1. **Click "Connect Wallet"** in the top-right corner
2. **MetaMask will open** - Review the connection request
3. **Select your account** (if you have multiple accounts)
4. **Click "Connect"** in MetaMask
5. **Approve the connection**

### Network Verification

The application automatically verifies you're on the correct network:

- **If correct network**: Connection proceeds normally
- **If wrong network**: You'll see a warning with option to switch networks

**To switch networks**:
1. Click the network warning banner
2. MetaMask will prompt to switch
3. Approve the network switch

### Connection Status

Once connected, you'll see:
- **Your wallet address** displayed in the header (truncated)
- **Network name** shown in the header
- **Role indicator** (Patient or Provider) based on your address

## Dashboard Overview

The dashboard provides an overview of:
- **Total Patients**: Number of patients in the system
- **Total Providers**: Number of providers in the system
- **Your Consents**: Active consents you've granted (as patient)
- **Your Requests**: Pending access requests (as patient)
- **Quick Actions**: Links to main features

## Patient Features

As a **patient**, you can:

### 1. View Your Consents

**Navigate**: Dashboard → "Consents" in sidebar

**You can see**:
- All consents you've granted
- Consent status (Active/Inactive)
- Provider information
- Data types and purposes
- Expiration dates
- Grant and revocation dates

**Filtering Options**:
- By status (Active/Inactive/All)
- By provider
- By data type
- By expiration status

### 2. Grant Consent

**When to use**: Grant access to a provider before they request it

**Steps**:
1. Navigate to "Consents" page
2. Click "Grant Consent" button
3. **Fill in the form**:
   - **Provider Address**: Enter provider's wallet address
   - **Data Type**: Select or enter data type (e.g., "medical_records")
   - **Purpose**: Select or enter purpose (e.g., "treatment")
   - **Expiration**: Optional expiration date (leave empty for no expiration)
4. Click "Grant Consent"
5. **MetaMask will open** - Review and sign the transaction
6. Wait for confirmation
7. Success! The consent will appear in your list

**Note**: You can grant consent to multiple data types/purposes using batch operations (advanced).

### 3. Revoke Consent

**When to use**: When you want to revoke previously granted access

**Steps**:
1. Navigate to "Consents" page
2. Find the consent you want to revoke
3. Click "Revoke" button
4. **MetaMask will open** - Review and sign the transaction
5. Wait for confirmation
6. The consent status will change to "Inactive"

**Important**: Revocation is immediate and permanent. You can grant consent again later if needed.

### 4. Respond to Access Requests

**When to use**: A provider has requested access to your data

**Steps**:
1. Navigate to "Requests" page
2. View pending requests in the "Pending" tab
3. For each request, you'll see:
   - **Provider information**
   - **Requested data types**
   - **Requested purposes**
   - **Expiration date** (if any)
4. **Approve or Deny**:
   - Click "Approve" to grant access (creates consent automatically)
   - Click "Deny" to reject the request
5. **MetaMask will open** - Review and sign the transaction
6. Wait for confirmation
7. The request status will update

**Note**: If a request has expired, it will automatically be denied.

### 5. View Consent History

**Navigate**: Consents page → Filter by "Inactive"

View all your previously granted and revoked consents for audit purposes.

## Provider Features

As a **provider**, you can:

### 1. Browse Patients

**Navigate**: Dashboard → "Patients" in sidebar

**You can see**:
- List of all patients
- Patient demographics
- Search and filter options

**Search Options**:
- By name
- By patient ID
- By wallet address
- By date of birth (supports various formats)
- By other demographics

### 2. View Patient Details

**Steps**:
1. Navigate to "Patients" page
2. Click on a patient row or "View Details"
3. See comprehensive patient information:
   - Demographics
   - Medical history
   - Lab results
   - Imaging studies
   - Genetic data

**Note**: Access to patient data requires active consent. The application will show what you have access to based on granted consents.

### 3. Request Access to Patient Data

**When to use**: When you need access to a patient's data and don't have consent yet

**Steps**:
1. Navigate to "Patients" page
2. Find the patient you want to request access from
3. Click "Request Access" button
4. **Fill in the request form**:
   - **Patient Address**: Automatically filled
   - **Data Types**: Select one or more data types
     - Medical Records
     - Lab Results
     - Imaging Studies
     - Genetic Data
     - etc.
   - **Purposes**: Select one or more purposes
     - Treatment
     - Research
     - Billing
     - etc.
   - **Expiration**: Optional expiration date for the request
5. Click "Request Access"
6. **MetaMask will open** - Review and sign the transaction
7. Wait for confirmation
8. The request will appear in the patient's "Requests" page

**Note**: You can request multiple data types and purposes in a single request.

### 4. View Your Consents

**Navigate**: Consents page

**You can see**:
- All consents patients have granted you
- Consent status
- Data types and purposes you have access to
- Expiration dates

**Filtering**:
- By patient
- By status
- By data type
- By expiration

### 5. View Your Requests

**Navigate**: Requests page

**You can see**:
- All access requests you've created
- Request status (Pending/Approved/Denied)
- Patient information
- Requested data types and purposes

**Tabs**:
- **Pending**: Requests awaiting patient response
- **Approved**: Requests that were approved (consents created)
- **Denied**: Requests that were denied
- **All**: View all requests

## Understanding Roles

### Patient Role

**Who**: Individuals whose healthcare data is being managed

**Capabilities**:
- Grant consent to providers
- Revoke previously granted consent
- Approve or deny access requests
- View consent history
- View access requests they've received

**Wallet**: Must be connected with a patient account address

### Provider Role

**Who**: Healthcare providers, hospitals, clinics, labs, etc.

**Capabilities**:
- Request access to patient data
- View consents patients have granted them
- View patient data (with consent)
- View request history

**Wallet**: Must be connected with a provider account address

**Note**: Role is automatically determined based on your wallet address. Patient addresses (accounts 0-9) are patients; provider addresses (accounts 10-19) are providers.

## Common Tasks

### Task 1: Provider Requests Access from Patient

1. **Provider**: Navigate to Patients → Select patient → Request Access
2. **Provider**: Fill form and sign transaction
3. **Patient**: Navigate to Requests → View pending request
4. **Patient**: Approve or Deny request and sign transaction
5. **Provider**: View updated consent status

### Task 2: Patient Grants Consent Directly

1. **Patient**: Navigate to Consents → Grant Consent
2. **Patient**: Fill form with provider address and sign transaction
3. **Provider**: View new consent in their consents list

### Task 3: Patient Revokes Consent

1. **Patient**: Navigate to Consents → Find consent
2. **Patient**: Click Revoke and sign transaction
3. **Provider**: Consent status updates to Inactive
4. **Provider**: No longer has access to that data

### Task 4: Search for Patient by Birth Date

1. **Provider**: Navigate to Patients
2. **Provider**: Enter date in search box (supports formats like):
   - `01/15/1990` (MM/DD/YYYY)
   - `15/01/1990` (DD/MM/YYYY)
   - `1990/01/15` (YYYY/MM/DD)
   - `January 15, 1990`
   - `1990` (year only)
3. **Provider**: Results filter by matching date of birth

### Task 5: Export Patient List

1. **Provider**: Navigate to Patients
2. **Provider**: Click "Export CSV" button
3. **Provider**: Download CSV file with all patient data
4. **Provider**: Use "Print" for formatted printout

## Understanding Transaction States

When you perform an action that requires a blockchain transaction:

1. **Pending**: Transaction submitted, waiting for confirmation
   - Shows loading indicator
   - MetaMask shows pending transaction

2. **Confirmed**: Transaction confirmed on blockchain
   - Success toast notification
   - UI updates with new data

3. **Failed**: Transaction failed
   - Error toast notification
   - Error message displayed
   - No changes made to blockchain

**Note**: Transactions typically confirm within 1-2 seconds on Hardhat network, but may take longer on mainnet.

## Troubleshooting

### Wallet Won't Connect

**Problem**: MetaMask connection fails

**Solutions**:
- Ensure MetaMask is installed and unlocked
- Check if you've previously denied connection (reset in MetaMask settings)
- Try refreshing the page
- Clear browser cache

### Wrong Network Warning

**Problem**: Application shows "Wrong Network" warning

**Solutions**:
- Click the network warning banner
- Approve network switch in MetaMask
- Manually add network if needed (see Deployment Guide)
- Verify Chain ID matches (should be 1337 for Hardhat)

### Transaction Fails

**Problem**: Transaction fails in MetaMask

**Solutions**:
- Check if you have enough ETH for gas
- Verify network is correct
- Check if transaction would revert (e.g., consent already revoked)
- Review error message in MetaMask
- Try again after a few seconds

### Can't See My Data

**Problem**: Data doesn't appear or is missing

**Solutions**:
- Verify wallet is connected
- Check if you're on the correct network
- Refresh the page
- Check browser console for errors
- Verify backend is running

### Search Not Working

**Problem**: Patient search returns no results

**Solutions**:
- Try different search terms
- Check spelling
- Use partial matches
- For dates, try different formats
- Clear search and try again

### Consent Status Not Updating

**Problem**: Consent status doesn't reflect recent changes

**Solutions**:
- Wait for transaction confirmation
- Refresh the page
- Check blockchain explorer for transaction status
- Verify transaction was successful

## Tips & Best Practices

### For Patients

1. **Review Requests Carefully**: Check data types and purposes before approving
2. **Set Expiration Dates**: Consider setting expiration dates for time-limited access
3. **Regular Audits**: Periodically review your active consents
4. **Revoke When Needed**: Don't hesitate to revoke consent if no longer needed
5. **Verify Provider Addresses**: Double-check provider addresses before granting consent

### For Providers

1. **Request Only What You Need**: Request specific data types and purposes
2. **Set Request Expiration**: Set reasonable expiration dates for requests
3. **Monitor Request Status**: Check request status regularly
4. **Respect Patient Privacy**: Only access data you have consent for
5. **Use Batch Requests**: When requesting multiple items, combine into one request

## Keyboard Shortcuts

- `Ctrl/Cmd + K`: Open search (where applicable)
- `Escape`: Close modals/dialogs
- `Tab`: Navigate form fields

## Browser Compatibility

- ✅ Chrome/Chromium (Recommended)
- ✅ Firefox
- ✅ Edge
- ✅ Brave
- ⚠️ Safari (May have MetaMask limitations)

## Getting Help

If you encounter issues:

1. Check this guide for troubleshooting steps
2. Review [Test Accounts](../TEST_ACCOUNTS.md) for account setup
3. Check [Deployment Guide](../deployment/deployment.md) for network configuration
4. Review browser console for error messages
5. Check backend logs if available

## Next Steps

- [Provider Guide](provider-guide.md) - Detailed provider workflows
- [Patient Guide](patient-guide.md) - Detailed patient workflows
- [API Documentation](../api/api-overview.md) - Backend API reference

