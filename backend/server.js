const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Auto-load mockup data when server starts
const mockPatients = require('./data/mockup-patients');
const mockProviders = require('./data/mockup-providers');

// Import Web3 services and routes
const web3Service = require('./services/web3Service');
const consentRoutes = require('./routes/consentRoutes');
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
app.use('/api/consent', consentRoutes);
app.use('/api/requests', consentRoutes); // Access request routes
app.use('/api/events', consentRoutes); // Event query routes

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

