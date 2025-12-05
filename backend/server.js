const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Auto-load mockup data when server starts
const mockPatients = require('./data/mockup-patients');
const mockProviders = require('./data/mockup-providers');

/**
 * Hardhat default accounts (first 20) mapped to patients/providers
 * Ensures deterministic wallet addresses that exist on the local chain.
 * Reference: https://hardhat.org/hardhat-network/reference/#accounts
 */
const HARDHAT_PATIENT_ADDRESSES = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
  '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
  '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
  '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
  '0x23618e81E3f5cdF7f54C3d65f7Fb9f8Ff5f3b7fF',
  '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720'
];

const HARDHAT_PROVIDER_ADDRESSES = [
  '0xbcd4042DE499D14e55001CcbB24a551F3b954096',
  '0x71be63f3384f5fb98995898a86b02fb2426c5788',
  '0xfabb0ac9d68b0b445fb7357272ff202c5651694a',
  '0x1cbda3414b8fda29e7ca743c7d5d7a4918f9ce47',
  '0x6EDe1597c05A0ca77045ff79fD3F783C237F267f',
  '0x2a871d0798f97b9b9455a5c5d3ba1b1c531c05c5',
  '0xf14f9596430931e177469715c591513308244e8f',
  '0xaAfac29bF13d489A9Cf3f7CF9Dd31259Cdd2ADe5',
  '0x5c985E89De1Af5FfdCeEC25792F8eA241DFAbF1A',
  '0x59b670e9fA9D0A427751Af201D676719a970857b'
];

/**
 * Normalize blockchain identities for mock patients/providers
 * without mutating the source data files (protected).
 */
function attachDeterministicWallets() {
  mockPatients.mockPatients.patients.forEach((patient, index) => {
    const walletAddress = HARDHAT_PATIENT_ADDRESSES[index % HARDHAT_PATIENT_ADDRESSES.length];
    patient.blockchainIntegration = {
      ...(patient.blockchainIntegration || {}),
      walletAddress,
      network: 'Hardhat Localhost (1337)',
      smartContractVersion: patient.blockchainIntegration?.smartContractVersion || '1.0.0',
      lastSync: new Date().toISOString()
    };
  });

  mockProviders.mockProviders.providers.forEach((provider, index) => {
    const walletAddress = HARDHAT_PROVIDER_ADDRESSES[index % HARDHAT_PROVIDER_ADDRESSES.length];
    provider.blockchainIntegration = {
      ...(provider.blockchainIntegration || {}),
      walletAddress,
      network: 'Hardhat Localhost (1337)',
      smartContractVersion: provider.blockchainIntegration?.smartContractVersion || '1.0.0',
      lastSync: new Date().toISOString()
    };
  });
}

attachDeterministicWallets();

// Import Web3 services and routes
const web3Service = require('./services/web3Service');
const { consentRouter, requestRouter, eventRouter } = require('./routes/consentRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit request body size

// Log loaded data on startup
console.log('='.repeat(60));
console.log('Healthcare Blockchain Backend Server Starting...');
console.log('='.repeat(60));
console.log(`Loaded ${mockPatients.mockPatients.patients.length} mock patients`);
console.log(`Loaded ${mockProviders.mockProviders.providers.length} mock providers`);
console.log(`Available data types: ${mockPatients.dataTypes.join(', ')}`);
console.log(`Available purposes: ${mockPatients.purposes.join(', ')}`);
console.log('='.repeat(60));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    data: {
      patients: mockPatients.mockPatients.patients.length,
      providers: mockProviders.mockProviders.providers.length
    }
  });
});

// Get all patients
app.get('/api/patients', (req, res) => {
  res.json({
    success: true,
    data: mockPatients.mockPatients.patients,
    metadata: mockPatients.mockPatients.metadata
  });
});

// Get patient by ID
app.get('/api/patients/:patientId', (req, res) => {
  const { patientId } = req.params;
  const patient = mockPatients.mockPatients.patients.find(
    p => p.patientId === patientId
  );

  if (!patient) {
    return res.status(404).json({
      success: false,
      message: 'Patient not found'
    });
  }

  res.json({
    success: true,
    data: patient
  });
});

// Get patient data by type
app.get('/api/patients/:patientId/data/:dataType', (req, res) => {
  const { patientId, dataType } = req.params;
  const patient = mockPatients.mockPatients.patients.find(
    p => p.patientId === patientId
  );

  if (!patient) {
    return res.status(404).json({
      success: false,
      message: 'Patient not found'
    });
  }

  // Map data types to patient data structure
  const dataTypeMap = {
    'medical_records': patient.medicalHistory,
    'diagnostic_data': patient.laboratoryResults,
    'genetic_data': patient.geneticData,
    'imaging_data': patient.imagingStudies,
    'laboratory_results': patient.laboratoryResults,
    'prescription_history': patient.currentMedications,
    'vital_signs': patient.vitalSigns,
    'treatment_history': {
      conditions: patient.medicalHistory.conditions,
      surgeries: patient.medicalHistory.surgeries
    }
  };

  const data = dataTypeMap[dataType];

  if (!data) {
    return res.status(400).json({
      success: false,
      message: `Invalid data type. Available types: ${Object.keys(dataTypeMap).join(', ')}`
    });
  }

  res.json({
    success: true,
    data: data,
    dataType: dataType,
    patientId: patientId
  });
});

// Get all providers
app.get('/api/providers', (req, res) => {
  res.json({
    success: true,
    data: mockProviders.mockProviders.providers,
    metadata: mockProviders.mockProviders.metadata
  });
});

// Get provider by ID
app.get('/api/providers/:providerId', (req, res) => {
  const { providerId } = req.params;
  const provider = mockProviders.mockProviders.providers.find(
    p => p.providerId === providerId
  );

  if (!provider) {
    return res.status(404).json({
      success: false,
      message: 'Provider not found'
    });
  }

  res.json({
    success: true,
    data: provider
  });
});

// Get available data types
app.get('/api/data-types', (req, res) => {
  res.json({
    success: true,
    data: mockPatients.dataTypes
  });
});

// Get available purposes
app.get('/api/purposes', (req, res) => {
  res.json({
    success: true,
    data: mockPatients.purposes
  });
});

// Blockchain contract info endpoint
app.get('/api/contract/info', async (req, res, next) => {
  try {
    // Try to read deployment info if available
    let deploymentInfo = null;
    try {
      const fs = require('fs');
      const path = require('path');
      // deployment.json is in the backend directory (same directory as server.js)
      const deploymentPath = path.join(__dirname, 'deployment.json');
      
      if (fs.existsSync(deploymentPath)) {
        deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error reading deployment info:', error.message);
    }

    // Get network info from Web3 service if initialized
    let networkInfo = null;
    try {
      if (web3Service.isInitialized) {
        networkInfo = await web3Service.getNetworkInfo();
      }
    } catch (error) {
      // Web3 service not initialized or connection failed
      console.warn('Web3 service not available:', error.message);
    }

    res.json({
      success: true,
      contract: {
        name: 'PatientConsentManager',
        network: networkInfo?.name || deploymentInfo?.network || 'localhost',
        address: networkInfo?.address || deploymentInfo?.address || null,
        chainId: networkInfo?.chainId || null,
        deployed: !!(networkInfo?.address || deploymentInfo?.address),
        abi: 'Available after contract compilation'
      },
      deployment: deploymentInfo,
      web3: {
        connected: await web3Service.isConnected(),
        initialized: web3Service.isInitialized
      }
    });
  } catch (error) {
    next(error);
  }
});

// Consent management routes (Web3 integration)
app.use('/api/consent', consentRouter);
app.use('/api/requests', requestRouter);
app.use('/api/events', eventRouter);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Web3 service and start server
async function startServer() {
  try {
    // Initialize Web3 service
    console.log('Initializing Web3 service...');
    await web3Service.initialize();
    console.log('✅ Web3 service initialized successfully\n');
  } catch (error) {
    console.error('⚠️  Warning: Web3 service initialization failed:', error.message);
    console.error('   Some endpoints may not be available. Ensure contract is deployed.\n');
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
    console.log(`\nAvailable endpoints:`);
    console.log(`  GET /health - Health check`);
    console.log(`  GET /api/patients - Get all patients`);
    console.log(`  GET /api/patients/:patientId - Get patient by ID`);
    console.log(`  GET /api/patients/:patientId/data/:dataType - Get patient data by type`);
    console.log(`  GET /api/providers - Get all providers`);
    console.log(`  GET /api/providers/:providerId - Get provider by ID`);
    console.log(`  GET /api/data-types - Get available data types`);
    console.log(`  GET /api/purposes - Get available purposes`);
    console.log(`  GET /api/contract/info - Get contract deployment info`);
    console.log(`\n📋 Consent Management Endpoints (Web3):`);
    console.log(`  GET /api/consent/status - Check consent status`);
    console.log(`  GET /api/consent/:consentId - Get consent record`);
    console.log(`  GET /api/consent/patient/:patientAddress - Get patient consents`);
    console.log(`  GET /api/consent/provider/:providerAddress - Get provider consents`);
    console.log(`  GET /api/requests/:requestId - Get access request`);
    console.log(`  GET /api/requests/patient/:patientAddress - Get patient requests`);
    console.log(`  GET /api/events/consent - Query consent events`);
    console.log(`  GET /api/events/requests - Query access request events`);
    console.log(`\n`);
  });
}

// Start server with Web3 initialization
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

