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
/**
 * Hardhat Default Accounts (0-19)
 * These are the actual addresses from Hardhat's default mnemonic:
 * "test test test test test test test test test test test junk"
 * 
 * These addresses are static and will always be the same when using Hardhat.
 * Private keys are documented in docs/TEST_ACCOUNTS.md
 */
const HARDHAT_PATIENT_ADDRESSES = [
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Account #0
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Account #1
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Account #2
  '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Account #3
  '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', // Account #4
  '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', // Account #5
  '0x976EA74026E726554dB657fA54763abd0C3a0aa9', // Account #6
  '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', // Account #7
  '0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f', // Account #8
  '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720'  // Account #9
];

const HARDHAT_PROVIDER_ADDRESSES = [
  '0xBcd4042DE499D14e55001CcbB24a551F3b954096', // Account #10 (updated to match Hardhat)
  '0x71bE63f3384f5fb98995898A86B02Fb2426c5788', // Account #11 (updated to match Hardhat)
  '0xFABB0ac9d68B0B445fB7357272Ff202C5651694a', // Account #12 (updated to match Hardhat)
  '0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec', // Account #13 (updated to match Hardhat)
  '0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097', // Account #14 (updated to match Hardhat)
  '0xcd3B766CCDd6AE721141F452C550Ca635964ce71', // Account #15 (updated to match Hardhat)
  '0x2546BcD3c84621e976D8185a91A922aE77ECEc30', // Account #16 (updated to match Hardhat)
  '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E', // Account #17 (updated to match Hardhat)
  '0xdD2FD4581271e230360230F9337D5c0430Bf44C0', // Account #18 (updated to match Hardhat)
  '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199'  // Account #19 (updated to match Hardhat)
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
const consentService = require('./services/consentService');
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

// Get patient data by type (with optional consent checking)
app.get('/api/patients/:patientId/data/:dataType', async (req, res) => {
  const { patientId, dataType } = req.params;
  const { providerAddress } = req.query;
  
  const patient = mockPatients.mockPatients.patients.find(
    p => p.patientId === patientId
  );

  if (!patient) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Patient not found'
      }
    });
  }

  const patientAddress = patient.blockchainIntegration?.walletAddress;
  if (!patientAddress) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Patient does not have a wallet address'
      }
    });
  }

  // Map data types to patient data structure
  const dataTypeMap = {
    'medical_records': patient.medicalHistory,
    'diagnostic_data': {
      laboratoryResults: patient.laboratoryResults,
      imagingStudies: patient.imagingStudies
    },
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
      error: {
        code: 'INVALID_INPUT',
        message: `Invalid data type. Available types: ${Object.keys(dataTypeMap).join(', ')}`
      }
    });
  }

  // If providerAddress is provided, check consent
  if (providerAddress) {
    try {
      const consentStatus = await consentService.getConsentStatus(
        patientAddress,
        providerAddress,
        dataType
      );

      if (!consentStatus.hasConsent || consentStatus.isExpired) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: `Provider does not have active consent for data type: ${dataType}`,
            details: {
              hasConsent: consentStatus.hasConsent,
              isExpired: consentStatus.isExpired,
              dataType
            }
          }
        });
      }
    } catch (error) {
      // If consent check fails (e.g., contract not initialized), allow access for development
      // In production, this should be more strict
      console.warn('Consent check failed, allowing access:', error.message);
    }
  }

  res.json({
    success: true,
    data: data,
    dataType: dataType,
    patientId: patientId
  });
});

// Get user role by address
app.get('/api/user/role', (req, res) => {
  const { address } = req.query;
  
  if (!address) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_PARAMETER',
        message: 'address query parameter is required'
      }
    });
  }

  // Normalize address for comparison
  const normalizedAddress = address.toLowerCase();
  
  // Check if address is a patient
  const patient = mockPatients.mockPatients.patients.find(
    p => p.blockchainIntegration?.walletAddress?.toLowerCase() === normalizedAddress
  );
  
  // Check if address is a provider
  const provider = mockProviders.mockProviders.providers.find(
    p => p.blockchainIntegration?.walletAddress?.toLowerCase() === normalizedAddress
  );

  let role = 'unknown';
  const result = { role };

  if (patient && provider) {
    role = 'both';
    result.role = role;
    result.patientId = patient.patientId;
    result.providerId = provider.providerId;
  } else if (patient) {
    role = 'patient';
    result.role = role;
    result.patientId = patient.patientId;
  } else if (provider) {
    role = 'provider';
    result.role = role;
    result.providerId = provider.providerId;
  }

  res.json({
    success: true,
    data: result
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

// Helper function to add pagination to array
function paginateArray(array, page = 1, limit = 10) {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 10);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginated = array.slice(startIndex, endIndex);
  
  return {
    data: paginated,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: array.length,
      totalPages: Math.ceil(array.length / limitNum)
    }
  };
}

// Provider-specific endpoints
// GET /api/provider/:providerAddress/consents
app.get('/api/provider/:providerAddress/consents', async (req, res, next) => {
  try {
    const { providerAddress } = req.params;
    const { page = 1, limit = 10, includeExpired = false } = req.query;
    
    // Get all consents for this provider
    const consents = await consentService.getProviderConsents(
      providerAddress,
      includeExpired === 'true'
    );
    
    const result = paginateArray(consents, page, limit);
    
    res.json({
      success: true,
      ...result,
      metadata: {
        timestamp: new Date().toISOString(),
        providerAddress
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/provider/:providerAddress/patients
app.get('/api/provider/:providerAddress/patients', async (req, res, next) => {
  try {
    const { providerAddress } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Get all consents for this provider
    const consents = await consentService.getProviderConsents(providerAddress, false);
    
    // Get unique patient addresses from consents
    const patientAddresses = [...new Set(consents.map(c => c.patientAddress))];
    
    // Map to patient data with consent info
    const patientsWithConsents = patientAddresses.map(patientAddress => {
      const patient = mockPatients.mockPatients.patients.find(
        p => p.blockchainIntegration?.walletAddress?.toLowerCase() === patientAddress.toLowerCase()
      );
      
      if (!patient) return null;
      
      // Get consents for this patient from this provider
      const patientConsents = consents.filter(c => 
        c.patientAddress.toLowerCase() === patientAddress.toLowerCase()
      );
      
      return {
        ...patient,
        consents: patientConsents.map(c => ({
          consentId: c.consentId,
          dataType: c.dataType,
          purpose: c.purpose,
          expirationTime: c.expirationTime,
          isExpired: c.isExpired,
          isActive: c.isActive
        }))
      };
    }).filter(p => p !== null);
    
    const result = paginateArray(patientsWithConsents, page, limit);
    
    res.json({
      success: true,
      ...result,
      metadata: {
        timestamp: new Date().toISOString(),
        providerAddress
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/provider/:providerAddress/patient/:patientId/data
app.get('/api/provider/:providerAddress/patient/:patientId/data', async (req, res, next) => {
  try {
    const { providerAddress, patientId } = req.params;
    
    const patient = mockPatients.mockPatients.patients.find(
      p => p.patientId === patientId
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Patient not found'
        }
      });
    }

    const patientAddress = patient.blockchainIntegration?.walletAddress;
    if (!patientAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Patient does not have a wallet address'
        }
      });
    }

    // Get all consents for this provider-patient pair
    const consents = await consentService.getProviderConsents(providerAddress, false);
    const patientConsents = consents.filter(c => 
      c.patientAddress.toLowerCase() === patientAddress.toLowerCase() &&
      c.isActive &&
      !c.isExpired
    );

    // Build data object with only consented data types
    const consentedDataTypes = new Set(patientConsents.map(c => c.dataType));
    
    // Start with full patient object, then filter data types
    const result = {
      patientId: patient.patientId,
      demographics: patient.demographics, // Always include demographics
      insurance: patient.insurance, // Always include insurance
      metadata: patient.metadata, // Always include metadata
      consentedData: {},
      consentInfo: patientConsents.map(c => ({
        dataType: c.dataType,
        purpose: c.purpose,
        expirationTime: c.expirationTime,
        consentId: c.consentId
      })),
      // Track which data types are available but not consented
      unavailableDataTypes: []
    };

    // Map data types to patient data structure
    const dataTypeMap = {
      'medical_records': () => patient.medicalHistory,
      'diagnostic_data': () => ({
        laboratoryResults: patient.laboratoryResults,
        imagingStudies: patient.imagingStudies
      }),
      'genetic_data': () => patient.geneticData,
      'imaging_data': () => patient.imagingStudies,
      'laboratory_results': () => patient.laboratoryResults,
      'prescription_history': () => patient.currentMedications,
      'vital_signs': () => patient.vitalSigns,
      'treatment_history': () => ({
        conditions: patient.medicalHistory.conditions,
        surgeries: patient.medicalHistory.surgeries
      })
    };

    // Check all possible data types and include only those with consent
    const allDataTypes = ['medical_records', 'diagnostic_data', 'genetic_data', 'imaging_data', 
                          'laboratory_results', 'prescription_history', 'vital_signs', 'treatment_history'];
    
    for (const dataType of allDataTypes) {
      const getter = dataTypeMap[dataType];
      if (getter) {
        const data = getter();
        // Only include if data exists and provider has consent
        if (data !== null && data !== undefined) {
          if (consentedDataTypes.has(dataType)) {
            result.consentedData[dataType] = data;
          } else {
            // Track what's available but not consented
            result.unavailableDataTypes.push(dataType);
          }
        }
      }
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Patient-specific endpoints
// GET /api/patient/:patientAddress/consents
app.get('/api/patient/:patientAddress/consents', async (req, res, next) => {
  try {
    const { patientAddress } = req.params;
    const { page = 1, limit = 10, includeExpired = false } = req.query;
    
    const consents = await consentService.getPatientConsents(
      patientAddress,
      includeExpired === 'true'
    );
    
    const result = paginateArray(consents, page, limit);
    
    res.json({
      success: true,
      ...result,
      metadata: {
        timestamp: new Date().toISOString(),
        patientAddress
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/patient/:patientAddress/pending-requests
app.get('/api/patient/:patientAddress/pending-requests', async (req, res, next) => {
  try {
    const { patientAddress } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    let requests = [];
    
    // Try to get requests from contract, but fall back to event-based querying if it fails
    try {
      requests = await consentService.getPatientRequests(patientAddress, 'pending');
    } catch (contractError) {
      // Fallback: Query events to reconstruct pending requests
      console.warn('Contract getPatientRequests failed, using event-based fallback:', contractError.message);
      
      try {
        // Get all access request events for this patient
        const events = await consentService.getAccessRequestEvents(patientAddress);
        
        // Find all AccessRequested events that don't have corresponding AccessApproved or AccessDenied events
        const requestedEvents = events.filter(e => e.type === 'AccessRequested');
        const approvedRequestIds = new Set(
          events.filter(e => e.type === 'AccessApproved').map(e => e.requestId)
        );
        const deniedRequestIds = new Set(
          events.filter(e => e.type === 'AccessDenied').map(e => e.requestId)
        );
        
        // Get pending requests (requested but not approved or denied)
        const pendingRequestIds = requestedEvents
          .filter(e => !approvedRequestIds.has(e.requestId) && !deniedRequestIds.has(e.requestId))
          .map(e => e.requestId);
        
        // Fetch full request details for pending requests
        requests = await Promise.all(
          pendingRequestIds.map(async (requestId) => {
            try {
              return await consentService.getAccessRequest(requestId);
            } catch (error) {
              // If request doesn't exist, return null (will be filtered out)
              return null;
            }
          })
        );
        
        // Filter out nulls
        requests = requests.filter(r => r !== null);
      } catch (eventError) {
        console.error('Event-based fallback also failed:', eventError.message);
        // Return empty array if both methods fail
        requests = [];
      }
    }
    
    // Enrich with provider info
    const enrichedRequests = requests.map(request => {
      const provider = mockProviders.mockProviders.providers.find(
        p => p.blockchainIntegration?.walletAddress?.toLowerCase() === request.requester.toLowerCase()
      );
      
      return {
        ...request,
        provider: provider ? {
          providerId: provider.providerId,
          organizationName: provider.organizationName,
          providerType: provider.providerType
        } : null
      };
    });
    
    const result = paginateArray(enrichedRequests, page, limit);
    
    res.json({
      success: true,
      ...result,
      metadata: {
        timestamp: new Date().toISOString(),
        patientAddress
      }
    });
  } catch (error) {
    next(error);
  }
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

