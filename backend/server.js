const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Auto-load mockup data when server starts
const mockPatients = require('./data/mockup-patients');
const mockProviders = require('./data/mockup-providers');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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
app.get('/api/contract/info', (req, res) => {
  // Try to read deployment info if available
  let deploymentInfo = null;
  try {
    const fs = require('fs');
    if (fs.existsSync('./deployment.json')) {
      deploymentInfo = JSON.parse(fs.readFileSync('./deployment.json', 'utf8'));
    }
  } catch (error) {
    console.error('Error reading deployment info:', error.message);
  }

  res.json({
    success: true,
    contract: {
      name: 'PatientConsentManager',
      network: deploymentInfo?.network || 'localhost',
      address: deploymentInfo?.address || null,
      deployed: !!deploymentInfo,
      abi: 'Available after contract compilation'
    },
    deployment: deploymentInfo
  });
});

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
  console.log(`\n`);
});

