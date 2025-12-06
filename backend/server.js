const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

// Import logger first (used throughout)
const logger = require('./utils/logger');

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

// Create lookup Maps for O(1) patient/provider lookups (performance optimization)
const patientById = new Map();
const patientByAddress = new Map();
const providerById = new Map();
const providerByAddress = new Map();

// Build lookup maps at startup
mockPatients.mockPatients.patients.forEach(patient => {
  patientById.set(patient.patientId, patient);
  if (patient.blockchainIntegration?.walletAddress) {
    patientByAddress.set(patient.blockchainIntegration.walletAddress.toLowerCase(), patient);
  }
});

mockProviders.mockProviders.providers.forEach(provider => {
  providerById.set(provider.providerId, provider);
  if (provider.blockchainIntegration?.walletAddress) {
    providerByAddress.set(provider.blockchainIntegration.walletAddress.toLowerCase(), provider);
  }
});

logger.info(`Created lookup maps: ${patientById.size} patients, ${providerById.size} providers`);

// Import Web3 services and routes
const web3Service = require('./services/web3Service');
const consentService = require('./services/consentService');
const cacheService = require('./services/cacheService');
const eventIndexer = require('./services/eventIndexer');
const { consentRouter, requestRouter, eventRouter } = require('./routes/consentRoutes');
const authRouter = require('./routes/authRoutes');
const { authenticate, verifyOwnership, verifyParticipant } = require('./middleware/auth');
const { requireProvider, requirePatient, requirePatientOrProvider, verifyPatientOwnership, verifyProviderAccessWithConsent, getUserRole } = require('./middleware/authorization');
const { normalizeAddress } = require('./utils/addressUtils');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;
const { getApiBaseUrl } = require('./utils/env-config');

// Middleware
// Configure CORS to allow requests from both localhost and production domain
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost and 127.0.0.1
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow production domain
    if (origin.includes('app.qrmk.us') || origin.includes('.qrmk.us')) {
      return callback(null, true);
    }
    
    // Default: allow the request
    callback(null, true);
  },
  credentials: true,
}));

// Add request/response logging (improvement #16 - quick win)
if (process.env.NODE_ENV !== 'test') {
  const morgan = require('morgan');
  // Use 'combined' format for production, 'dev' for development
  const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(morgan(logFormat));
}

// Add compression middleware (performance improvement)
const compression = require('compression');
app.use(compression());

// Add request timeout middleware (reliability improvement)
const timeout = require('connect-timeout');
app.use(timeout('30s')); // 30 second timeout for all requests
app.use((req, res, next) => {
  if (!req.timedout) next();
});

// Add rate limiting (security improvement)
const rateLimit = require('express-rate-limit');

// General API rate limiter (increased 100x for testing - 10x * 10x)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // limit each IP to 10000 requests per windowMs (was 100, increased 100x for testing)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for expensive endpoints (increased 100x for testing - 10x * 10x)
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // 2000 requests per 15 minutes (was 20, increased 100x for testing)
  message: 'Too many requests to this endpoint, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes, but exclude lightweight endpoints
// /api/user/role is a simple Map lookup and should not be rate limited
// /api/auth/message is needed for authentication and should not be rate limited
app.use('/api/', (req, res, next) => {
  // Skip rate limiting for lightweight/essential endpoints
  if (req.path === '/user/role' || req.path === '/auth/message') {
    return next();
  }
  return apiLimiter(req, res, next);
});
app.use('/api/consent/status', strictLimiter);
app.use('/api/events/', strictLimiter);

app.use(express.json({ limit: '1mb' })); // Reduced from 10mb for security

// Log loaded data on startup
logger.info('='.repeat(60));
logger.info('Healthcare Blockchain Backend Server Starting...');
logger.info('='.repeat(60));
logger.info(`Loaded ${mockPatients.mockPatients.patients.length} mock patients`);
logger.info(`Loaded ${mockProviders.mockProviders.providers.length} mock providers`);
logger.info(`Available data types: ${mockPatients.dataTypes.join(', ')}`);
logger.info(`Available purposes: ${mockPatients.purposes.join(', ')}`);
logger.info('='.repeat(60));

// Health check endpoint
app.get('/health', async (req, res) => {
  const cacheHealth = await cacheService.healthCheck();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    data: {
      patients: mockPatients.mockPatients.patients.length,
      providers: mockProviders.mockProviders.providers.length
    },
    cache: cacheHealth
  });
});

// Get all patients - Providers only, returns basic info only
app.get('/api/patients', authenticate, requireProvider, (req, res) => {
  // Return only basic patient info (demographics, contact) - no medical data
  const basicPatientInfo = mockPatients.mockPatients.patients.map(patient => ({
    patientId: patient.patientId,
    demographics: patient.demographics,
    insurance: patient.insurance,
    metadata: patient.metadata,
    blockchainIntegration: patient.blockchainIntegration
  }));
  
  // Add pagination support
  const { page, limit } = req.query;
  const result = paginateArray(basicPatientInfo, page, limit);
  
  res.json({
    success: true,
    ...result,
    metadata: mockPatients.mockPatients.metadata
  });
});

// Get patient by ID - Providers can see basic info, patients can see their own
app.get('/api/patients/:patientId', authenticate, requirePatientOrProvider, async (req, res, next) => {
  try {
    const { patientId } = req.params;
    // Use O(1) Map lookup instead of O(n) array search
    const patient = patientById.get(patientId);

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
    const userRole = getUserRole(req.user.address);
    const isPatient = userRole.role === 'patient' || userRole.role === 'both';
    const isProvider = userRole.role === 'provider' || userRole.role === 'both';

    // If user is a patient, they can only see their own data
    if (isPatient && !isProvider) {
      if (!patientAddress || normalizeAddress(patientAddress) !== normalizeAddress(req.user.address)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'You can only access your own data'
          }
        });
      }
      // Patient can see all their own data
      return res.json({
        success: true,
        data: patient
      });
    }

    // Provider can see basic info only (no medical data without consent)
    if (isProvider) {
      const basicInfo = {
        patientId: patient.patientId,
        demographics: patient.demographics,
        insurance: patient.insurance,
        metadata: patient.metadata,
        blockchainIntegration: patient.blockchainIntegration
      };
      return res.json({
        success: true,
        data: basicInfo
      });
    }

    res.status(403).json({
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'Access denied'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get patient data by type - Requires auth, checks role and consent
app.get('/api/patients/:patientId/data/:dataType', authenticate, requirePatientOrProvider, async (req, res, next) => {
  const { patientId, dataType } = req.params;
  const { providerAddress } = req.query;
  
  // Use O(1) Map lookup instead of O(n) array search
  const patient = patientById.get(patientId);

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

  const userRole = getUserRole(req.user.address);
  const isPatient = userRole.role === 'patient' || userRole.role === 'both';
  const isProvider = userRole.role === 'provider' || userRole.role === 'both';

  // If user is a patient, they can only access their own data
  if (isPatient && !isProvider) {
    if (normalizeAddress(patientAddress) !== normalizeAddress(req.user.address)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only access your own data'
        }
      });
    }
  }

  // If user is a provider, check consent
  if (isProvider) {
    const providerAddress = req.user.address;
    try {
      const consentStatus = await consentService.getConsentStatus(
        normalizeAddress(patientAddress),
        normalizeAddress(providerAddress),
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
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'Failed to verify consent',
          details: { error: error.message }
        }
      });
    }
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

// Get all providers - Providers only
app.get('/api/providers', authenticate, requireProvider, (req, res) => {
  // Add pagination support
  const { page, limit } = req.query;
  const result = paginateArray(mockProviders.mockProviders.providers, page, limit);
  
  res.json({
    success: true,
    ...result,
    metadata: mockProviders.mockProviders.metadata
  });
});

// Get provider by ID
app.get('/api/providers/:providerId', (req, res) => {
  const { providerId } = req.params;
  // Use O(1) Map lookup instead of O(n) array search
  const provider = providerById.get(providerId);

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

// Get available data types - Requires authentication
app.get('/api/data-types', authenticate, (req, res) => {
  res.json({
    success: true,
    data: mockPatients.dataTypes
  });
});

// Get available purposes - Requires authentication
app.get('/api/purposes', authenticate, (req, res) => {
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
app.get('/api/provider/:providerAddress/consents', authenticate, verifyOwnership('providerAddress'), async (req, res, next) => {
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
app.get('/api/provider/:providerAddress/patients', authenticate, verifyOwnership('providerAddress'), async (req, res, next) => {
  try {
    const { providerAddress } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    // Get all consents for this provider
    const consents = await consentService.getProviderConsents(providerAddress, false);
    
    // Get unique patient addresses from consents
    const patientAddresses = [...new Set(consents.map(c => c.patientAddress))];
    
    // Map to patient data with consent info
    const patientsWithConsents = patientAddresses.map(patientAddress => {
      // Use O(1) Map lookup instead of O(n) array search
      const patient = patientByAddress.get(patientAddress.toLowerCase());
      
      if (!patient) return null;
      
      // Get consents for this patient from this provider
      const patientConsents = consents.filter(c => 
        c.patientAddress.toLowerCase() === patientAddress.toLowerCase()
      );
      
      return {
        ...patient,
        consents: patientConsents.map(c => ({
          consentId: c.consentId,
          // Support both single and batch consents
          dataType: c.dataType || (c.dataTypes && c.dataTypes.length > 0 ? c.dataTypes[0] : null),
          dataTypes: c.dataTypes || (c.dataType ? [c.dataType] : []),
          purpose: c.purpose || (c.purposes && c.purposes.length > 0 ? c.purposes[0] : null),
          purposes: c.purposes || (c.purpose ? [c.purpose] : []),
          timestamp: c.timestamp,
          expirationTime: c.expirationTime,
          isExpired: c.isExpired,
          isActive: c.isActive,
          isBatch: c.isBatch || false
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

// GET /api/provider/:providerAddress/pending-requests
app.get('/api/provider/:providerAddress/pending-requests', authenticate, verifyOwnership('providerAddress'), async (req, res, next) => {
  try {
    const { providerAddress } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const requests = await consentService.getProviderPendingRequests(providerAddress);
    
    // Enrich with patient info
    const enrichedRequests = requests.map(request => {
      // Use O(1) Map lookup instead of O(n) array search
      const patient = patientByAddress.get(request.patientAddress.toLowerCase());
      
      return {
        ...request,
        patient: patient ? {
          patientId: patient.patientId,
          firstName: patient.demographics?.firstName,
          lastName: patient.demographics?.lastName
        } : null
      };
    });
    
    const result = paginateArray(enrichedRequests, page, limit);
    
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
// Provider can access patient data if they have consent (removed verifyOwnership to allow access)
app.get('/api/provider/:providerAddress/patient/:patientId/data', authenticate, requireProvider, async (req, res, next) => {
  try {
    const { providerAddress, patientId } = req.params;
    
    // Verify the authenticated user is the provider
    if (normalizeAddress(providerAddress) !== normalizeAddress(req.user.address)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only access data as the authenticated provider'
        }
      });
    }
    
    // Use O(1) Map lookup instead of O(n) array search
    const patient = patientById.get(patientId);

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
    // Handle both single consents (dataType) and batch consents (dataTypes array)
    const consentedDataTypes = new Set();
    patientConsents.forEach(c => {
      if (c.dataTypes && Array.isArray(c.dataTypes)) {
        // Batch consent - add all data types
        c.dataTypes.forEach(dt => consentedDataTypes.add(dt));
      } else if (c.dataType) {
        // Single consent
        consentedDataTypes.add(c.dataType);
      }
    });
    
    // Start with full patient object, then filter data types
    const result = {
      patientId: patient.patientId,
      demographics: patient.demographics, // Always include demographics
      insurance: patient.insurance, // Always include insurance
      metadata: patient.metadata, // Always include metadata
      consentedData: {},
      consentInfo: patientConsents.map(c => ({
        // Support both single and batch consents
        dataType: c.dataType || (c.dataTypes && c.dataTypes.length > 0 ? c.dataTypes[0] : null),
        dataTypes: c.dataTypes || (c.dataType ? [c.dataType] : []),
        purpose: c.purpose || (c.purposes && c.purposes.length > 0 ? c.purposes[0] : null),
        purposes: c.purposes || (c.purpose ? [c.purpose] : []),
        expirationTime: c.expirationTime,
        consentId: c.consentId,
        isBatch: c.isBatch || false
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
app.get('/api/patient/:patientAddress/consents', authenticate, verifyOwnership('patientAddress'), async (req, res, next) => {
  try {
    const { patientAddress } = req.params;
    const { page = 1, limit = 10, includeExpired = false } = req.query;
    
    const consents = await consentService.getPatientConsents(
      patientAddress,
      includeExpired === 'true'
    );
    
    // Enrich with provider info
    const enrichedConsents = consents.map(consent => {
      // Use O(1) Map lookup instead of O(n) array search
      const provider = providerByAddress.get(consent.providerAddress.toLowerCase());
      
      return {
        ...consent,
        provider: provider ? {
          providerId: provider.providerId,
          organizationName: provider.organizationName,
          providerType: provider.providerType,
          address: provider.address,
          contact: provider.contact,
          specialties: provider.specialties
        } : null
      };
    });
    
    const result = paginateArray(enrichedConsents, page, limit);
    
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

// GET /api/patient/:patientAddress/info
// Get patient's own information (patients can access their own info)
app.get('/api/patient/:patientAddress/info', authenticate, verifyOwnership('patientAddress'), async (req, res, next) => {
  try {
    const { patientAddress } = req.params;
    
    // Use O(1) Map lookup instead of O(n) array search
    const patient = patientByAddress.get(normalizeAddress(patientAddress).toLowerCase());

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Patient not found'
        }
      });
    }

    res.json({
      success: true,
      data: patient
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/patient/:patientAddress/pending-requests
app.get('/api/patient/:patientAddress/pending-requests', authenticate, verifyOwnership('patientAddress'), async (req, res, next) => {
  try {
    const { patientAddress } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    let requests = [];
    
    // Try to get requests from contract, but fall back to event-based querying if it fails
    try {
      requests = await consentService.getPatientRequests(patientAddress, 'pending');
    } catch (contractError) {
      // Fallback: Query events to reconstruct pending requests
      logger.warn('Contract getPatientRequests failed, using event-based fallback', { error: contractError.message });
      
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
        logger.error('Event-based fallback also failed', { error: eventError.message, stack: eventError.stack });
        // Return empty array if both methods fail
        requests = [];
      }
    }
    
    // Enrich with provider info
    const enrichedRequests = requests.map(request => {
      // Use O(1) Map lookup instead of O(n) array search
      const provider = providerByAddress.get(request.requester.toLowerCase());
      
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
      // deployment.json is in the backend directory (same directory as server.js)
      const deploymentPath = path.join(__dirname, 'deployment.json');
      
      // Use async file operations (non-blocking)
      try {
        const deploymentContent = await fs.readFile(deploymentPath, 'utf8');
        deploymentInfo = JSON.parse(deploymentContent);
      } catch (readError) {
        // File doesn't exist or can't be read - that's okay
        if (readError.code !== 'ENOENT') {
          logger.warn('Warning: Could not read deployment.json', { error: readError.message });
        }
      }
    } catch (error) {
      logger.error('Error reading deployment info', { error: error.message, stack: error.stack });
    }

    // Get network info from Web3 service if initialized
    let networkInfo = null;
    try {
      if (web3Service.isInitialized) {
        networkInfo = await web3Service.getNetworkInfo();
      }
    } catch (error) {
      // Web3 service not initialized or connection failed
      logger.warn('Web3 service not available', { error: error.message });
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

// Authentication routes (public)
app.use('/api/auth', authRouter);

// Consent management routes (Web3 integration)
// Protect routes that require authentication
app.use('/api/consent', consentRouter);
app.use('/api/requests', requestRouter);
app.use('/api/events', eventRouter);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize Web3 service and start server
async function startServer() {
  try {
    // Initialize cache service
    logger.info('Initializing cache service...');
    await cacheService.initialize();
    logger.info('Cache service initialized successfully');
  } catch (error) {
    logger.warn('Warning: Cache service initialization failed', { error: error.message });
    logger.warn('Continuing without cache. Some endpoints may be slower.');
  }

  try {
    // Initialize event indexer (PostgreSQL)
    logger.info('Initializing event indexer...');
    await eventIndexer.initialize();
    if (eventIndexer.isEventIndexingEnabled()) {
      logger.info('Event indexer initialized successfully (PostgreSQL enabled)');
    } else {
      logger.info('Event indexer disabled (PostgreSQL not enabled or unavailable)');
    }
  } catch (error) {
    logger.warn('Warning: Event indexer initialization failed', { error: error.message });
    logger.warn('Continuing without event indexing. Event queries will use direct blockchain queries.');
  }

  try {
    // Initialize Web3 service
    logger.info('Initializing Web3 service...');
    await web3Service.initialize();
    
    // Set up periodic RPC health checks (reliability improvement)
    const healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await web3Service.isConnected();
        if (!isHealthy) {
          console.warn('⚠️  RPC health check failed, attempting to reconnect...');
          try {
            await web3Service.initialize();
            console.log('✅ RPC connection restored');
          } catch (reconnectError) {
            console.error('❌ Failed to reconnect to RPC:', reconnectError.message);
          }
        }
      } catch (error) {
        console.error('❌ RPC health check error:', error.message);
      }
    }, 60000); // Check every minute
    
    // Clean up interval on process exit
    process.on('SIGTERM', () => {
      clearInterval(healthCheckInterval);
    });
    process.on('SIGINT', () => {
      clearInterval(healthCheckInterval);
    });
    logger.info('Web3 service initialized successfully');
  } catch (error) {
    logger.warn('Warning: Web3 service initialization failed', { error: error.message });
    logger.warn('Some endpoints may not be available. Ensure contract is deployed.');
  }

  // Start server
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`API endpoints available at http://localhost:${PORT}/api`);
    logger.debug('Available endpoints: /health, /api/patients, /api/providers, /api/consent/*, /api/requests/*, /api/events/*');
  });
}

// Start server with Web3 initialization
startServer().catch(error => {
  logger.error('Failed to start server', { error: error.message, stack: error.stack });
  process.exit(1);
});

