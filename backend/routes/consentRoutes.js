const express = require('express');
const consentRouter = express.Router();
const requestRouter = express.Router();
const eventRouter = express.Router();
const consentService = require('../services/consentService');
const web3Service = require('../services/web3Service');
const { authenticate, verifyParticipant, verifyOwnership } = require('../middleware/auth');
const {
  validateAddressParam,
  validateConsentId,
  validateRequestId,
  validateDataType,
  validateBlockRange,
  validateStatus,
  validateIncludeExpired
} = require('../middleware/validation');
const { validateAddress } = require('../utils/addressUtils');
const { ValidationError } = require('../utils/errors');

/**
 * Consent Routes - API endpoints for consent management
 * 
 * All endpoints return structured JSON responses with success/error format.
 * Includes comprehensive validation, error handling, and metadata.
 */

/**
 * GET /api/consent/status
 * Check if active consent exists between patient and provider for data type
 * 
 * Query parameters:
 * - patientAddress (required): Ethereum address of patient
 * - providerAddress (required): Ethereum address of provider
 * - dataType (required): Type of data (e.g., 'medical_records')
 * 
 * Returns:
 * - hasConsent: boolean
 * - consentId: number | null
 * - isExpired: boolean
 * - expirationTime: string (ISO) | null
 */
consentRouter.get('/status', authenticate, verifyParticipant(), async (req, res, next) => {
  try {
    const { patientAddress, providerAddress, dataType } = req.query;

    // Validate required parameters
    if (!patientAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'patientAddress is required',
          details: { field: 'patientAddress' }
        }
      });
    }

    if (!providerAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'providerAddress is required',
          details: { field: 'providerAddress' }
        }
      });
    }

    if (!dataType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'dataType is required',
          details: { field: 'dataType' }
        }
      });
    }

    // Validate addresses
    validateAddress(patientAddress, 'patientAddress');
    validateAddress(providerAddress, 'providerAddress');

    // Get consent status
    const status = await consentService.getConsentStatus(
      patientAddress,
      providerAddress,
      dataType
    );

    // Get current block number for metadata
    const blockNumber = await web3Service.getBlockNumber();
    const networkInfo = await web3Service.getNetworkInfo();

    res.json({
      success: true,
      data: status,
      metadata: {
        timestamp: new Date().toISOString(),
        blockNumber: blockNumber,
        network: networkInfo.name,
        chainId: networkInfo.chainId
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/events/consent
 * Query consent events (ConsentGranted, ConsentRevoked)
 * 
 * Query parameters:
 * - patientAddress (optional): Filter by patient address
 * - fromBlock (optional): Starting block number
 * - toBlock (optional): Ending block number (default: latest)
 * 
 * Returns: Array of consent events
 */
eventRouter.get('/consent', validateBlockRange(), async (req, res, next) => {
  try {
    const { patientAddress, fromBlock, toBlock } = req.query;

    // Validate patient address if provided
    if (patientAddress) {
      try {
        validateAddress(patientAddress, 'patientAddress');
      } catch (error) {
        if (error.name === 'InvalidAddressError' || error.name === 'ValidationError') {
          return res.status(400).json({
            success: false,
            error: error.toJSON ? error.toJSON() : {
              code: 'INVALID_ADDRESS',
              message: error.message,
              details: { field: 'patientAddress', value: patientAddress }
            }
          });
        }
        throw error;
      }
    }

    const events = await consentService.getConsentEvents(
      patientAddress || null,
      fromBlock ? parseInt(fromBlock, 10) : null,
      toBlock ? parseInt(toBlock, 10) : null
    );

    const blockNumber = await web3Service.getBlockNumber();
    const networkInfo = await web3Service.getNetworkInfo();

    res.json({
      success: true,
      data: events,
      metadata: {
        timestamp: new Date().toISOString(),
        blockNumber: blockNumber,
        network: networkInfo.name,
        chainId: networkInfo.chainId,
        count: events.length,
        filters: {
          patientAddress: patientAddress || null,
          fromBlock: fromBlock || null,
          toBlock: toBlock || null
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/events/requests
 * Query access request events (AccessRequested, AccessApproved, AccessDenied)
 * 
 * Query parameters:
 * - patientAddress (optional): Filter by patient address
 * - fromBlock (optional): Starting block number
 * - toBlock (optional): Ending block number (default: latest)
 * 
 * Returns: Array of access request events
 */
eventRouter.get('/requests', validateBlockRange(), async (req, res, next) => {
  try {
    const { patientAddress, fromBlock, toBlock } = req.query;

    // Validate patient address if provided
    if (patientAddress) {
      try {
        validateAddress(patientAddress, 'patientAddress');
      } catch (error) {
        if (error.name === 'InvalidAddressError' || error.name === 'ValidationError') {
          return res.status(400).json({
            success: false,
            error: error.toJSON ? error.toJSON() : {
              code: 'INVALID_ADDRESS',
              message: error.message,
              details: { field: 'patientAddress', value: patientAddress }
            }
          });
        }
        throw error;
      }
    }

    const events = await consentService.getAccessRequestEvents(
      patientAddress || null,
      fromBlock ? parseInt(fromBlock, 10) : null,
      toBlock ? parseInt(toBlock, 10) : null
    );

    const blockNumber = await web3Service.getBlockNumber();
    const networkInfo = await web3Service.getNetworkInfo();

    res.json({
      success: true,
      data: events,
      metadata: {
        timestamp: new Date().toISOString(),
        blockNumber: blockNumber,
        network: networkInfo.name,
        chainId: networkInfo.chainId,
        count: events.length,
        filters: {
          patientAddress: patientAddress || null,
          fromBlock: fromBlock || null,
          toBlock: toBlock || null
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/consent/:consentId
 * Get full consent record by ID
 * 
 * Path parameters:
 * - consentId (required): Consent ID
 * 
 * Returns: Full consent record with all fields
 */
consentRouter.get('/:consentId', validateConsentId(), async (req, res, next) => {
  try {
    const { consentId } = req.params;
    const record = await consentService.getConsentRecord(consentId);

    const blockNumber = await web3Service.getBlockNumber();
    const networkInfo = await web3Service.getNetworkInfo();

    res.json({
      success: true,
      data: record,
      metadata: {
        timestamp: new Date().toISOString(),
        blockNumber: blockNumber,
        network: networkInfo.name,
        chainId: networkInfo.chainId
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/consent/patient/:patientAddress
 * Get all consents for a patient
 * 
 * Path parameters:
 * - patientAddress (required): Ethereum address of patient
 * 
 * Query parameters:
 * - includeExpired (optional): Include expired consents (default: false)
 * 
 * Returns: Array of consent records
 */
consentRouter.get(
  '/patient/:patientAddress',
  authenticate,
  verifyOwnership('patientAddress'),
  validateAddressParam('patientAddress'),
  validateIncludeExpired(),
  async (req, res, next) => {
    try {
      const { patientAddress } = req.params;
      const { includeExpired } = req.query;

      const consents = await consentService.getPatientConsents(
        patientAddress,
        includeExpired
      );

      const blockNumber = await web3Service.getBlockNumber();
      const networkInfo = await web3Service.getNetworkInfo();

      res.json({
        success: true,
        data: consents,
        metadata: {
          timestamp: new Date().toISOString(),
          blockNumber: blockNumber,
          network: networkInfo.name,
          chainId: networkInfo.chainId,
          count: consents.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/consent/provider/:providerAddress
 * Get all consents for a provider
 * 
 * Path parameters:
 * - providerAddress (required): Ethereum address of provider
 * 
 * Query parameters:
 * - includeExpired (optional): Include expired consents (default: false)
 * 
 * Returns: Array of consent records
 * 
 * Note: Currently returns empty array as contract doesn't expose provider consents directly.
 * Would need event-based querying for full implementation.
 */
consentRouter.get(
  '/provider/:providerAddress',
  authenticate,
  verifyOwnership('providerAddress'),
  validateAddressParam('providerAddress'),
  validateIncludeExpired(),
  async (req, res, next) => {
    try {
      const { providerAddress } = req.params;
      const { includeExpired } = req.query;

      // Note: Contract doesn't have getProviderConsents function
      // This would require querying events or maintaining a separate index
      const consents = await consentService.getProviderConsents(
        providerAddress,
        includeExpired
      );

      const blockNumber = await web3Service.getBlockNumber();
      const networkInfo = await web3Service.getNetworkInfo();

      res.json({
        success: true,
        data: consents,
        metadata: {
          timestamp: new Date().toISOString(),
          blockNumber: blockNumber,
          network: networkInfo.name,
          chainId: networkInfo.chainId,
          count: consents.length,
          note: 'Provider consents require event-based querying - currently limited'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/requests/:requestId (when mounted at /api/requests)
 * GET /api/consent/requests/:requestId (when mounted at /api/consent)
 * Get access request by ID
 * 
 * Path parameters:
 * - requestId (required): Request ID
 * 
 * Returns: Full access request record
 */
requestRouter.get('/:requestId', validateRequestId(), async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const request = await consentService.getAccessRequest(requestId);

    // Enrich with provider info from mockup data
    const mockProviders = require('../data/mockup-providers');
    const provider = mockProviders.mockProviders.providers.find(
      p => p.blockchainIntegration?.walletAddress?.toLowerCase() === request.requester.toLowerCase()
    );
    
    const enrichedRequest = {
      ...request,
      provider: provider ? {
        providerId: provider.providerId,
        organizationName: provider.organizationName,
        providerType: provider.providerType,
        address: provider.address,
        contact: provider.contact,
        specialties: provider.specialties
      } : null
    };

    const blockNumber = await web3Service.getBlockNumber();
    const networkInfo = await web3Service.getNetworkInfo();

    res.json({
      success: true,
      data: enrichedRequest,
      metadata: {
        timestamp: new Date().toISOString(),
        blockNumber: blockNumber,
        network: networkInfo.name,
        chainId: networkInfo.chainId
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/requests/patient/:patientAddress
 * Get all access requests for a patient
 * 
 * Path parameters:
 * - patientAddress (required): Ethereum address of patient
 * 
 * Query parameters:
 * - status (optional): Filter by status ('pending', 'approved', 'denied', 'all') (default: 'all')
 * 
 * Returns: Array of access requests
 */
requestRouter.get(
  '/patient/:patientAddress',
  authenticate,
  verifyOwnership('patientAddress'),
  validateAddressParam('patientAddress'),
  validateStatus(),
  async (req, res, next) => {
    try {
      const { patientAddress } = req.params;
      const { status } = req.query;

      const requests = await consentService.getPatientRequests(
        patientAddress,
        status || 'all'
      );

      const blockNumber = await web3Service.getBlockNumber();
      const networkInfo = await web3Service.getNetworkInfo();

      res.json({
        success: true,
        data: requests,
        metadata: {
          timestamp: new Date().toISOString(),
          blockNumber: blockNumber,
          network: networkInfo.name,
          chainId: networkInfo.chainId,
          count: requests.length,
          statusFilter: status || 'all'
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/consent/grant
 * Grant consent to a provider
 * 
 * @deprecated This endpoint is deprecated. Frontend now signs transactions directly via MetaMask.
 *            This endpoint is kept for backward compatibility but should not be used in production.
 *            Use direct contract calls from the frontend instead.
 * 
 * Body:
 * - patientAddress (required): Ethereum address of patient
 * - providerAddress (required): Ethereum address of provider
 * - dataType (required): Type of data
 * - purpose (required): Purpose for data use
 * - expirationTime (optional): Unix timestamp (0 for no expiration)
 * 
 * Returns: Transaction result with consentId and transaction hash
 */
consentRouter.post('/grant', async (req, res, next) => {
  try {
    const { patientAddress, providerAddress, dataType, purpose, expirationTime } = req.body;

    // Validate required fields
    if (!patientAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'patientAddress is required',
          details: { field: 'patientAddress' }
        }
      });
    }

    if (!providerAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'providerAddress is required',
          details: { field: 'providerAddress' }
        }
      });
    }

    if (!dataType) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'dataType is required',
          details: { field: 'dataType' }
        }
      });
    }

    if (!purpose) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'purpose is required',
          details: { field: 'purpose' }
        }
      });
    }

    // Validate addresses
    validateAddress(patientAddress, 'patientAddress');
    validateAddress(providerAddress, 'providerAddress');

    // Default expirationTime to 0 (no expiration) if not provided
    const expTime = expirationTime !== undefined ? parseInt(expirationTime, 10) : 0;

    // Grant consent
    const result = await consentService.grantConsent(
      patientAddress,
      providerAddress,
      dataType,
      expTime,
      purpose
    );

    const blockNumber = await web3Service.getBlockNumber();
    const networkInfo = await web3Service.getNetworkInfo();

    res.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        blockNumber: blockNumber,
        network: networkInfo.name,
        chainId: networkInfo.chainId
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/consent/:consentId/revoke
 * Revoke a consent
 * 
 * @deprecated This endpoint is deprecated. Frontend now signs transactions directly via MetaMask.
 * 
 * Path parameters:
 * - consentId (required): Consent ID to revoke
 * 
 * Body:
 * - patientAddress (required): Ethereum address of patient
 * 
 * Returns: Transaction result with transaction hash
 */
consentRouter.put('/:consentId/revoke', validateConsentId(), async (req, res, next) => {
  try {
    const { consentId } = req.params;
    const { patientAddress } = req.body;

    if (!patientAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'patientAddress is required',
          details: { field: 'patientAddress' }
        }
      });
    }

    validateAddress(patientAddress, 'patientAddress');

    const result = await consentService.revokeConsent(patientAddress, consentId);

    const blockNumber = await web3Service.getBlockNumber();
    const networkInfo = await web3Service.getNetworkInfo();

    res.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        blockNumber: blockNumber,
        network: networkInfo.name,
        chainId: networkInfo.chainId
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/requests (when mounted at /api/requests)
 * POST /api/consent/requests (when mounted at /api/consent)
 * Create an access request
 * 
 * @deprecated This endpoint is deprecated. Frontend now signs transactions directly via MetaMask.
 * 
 * Body:
 * - requesterAddress (required): Ethereum address of requester
 * - patientAddress (required): Ethereum address of patient
 * - dataTypes (required): Array of data types requested
 * - purposes (required): Array of purposes for data use
 * - expirationTime (optional): Unix timestamp (0 for no expiration)
 * 
 * Note: All combinations (cartesian product) will be granted on approval.
 * 
 * Returns: Transaction result with requestId and transaction hash
 */
requestRouter.post('/', async (req, res, next) => {
  try {
    const { requesterAddress, patientAddress, dataTypes, purposes, expirationTime } = req.body;
    
    // Validate required fields
    if (!requesterAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'requesterAddress is required',
          details: { field: 'requesterAddress' }
        }
      });
    }

    if (!patientAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'patientAddress is required',
          details: { field: 'patientAddress' }
        }
      });
    }

    if (!Array.isArray(dataTypes) || dataTypes.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'dataTypes is required and must be a non-empty array',
          details: { field: 'dataTypes' }
        }
      });
    }

    if (!Array.isArray(purposes) || purposes.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'purposes is required and must be a non-empty array',
          details: { field: 'purposes' }
        }
      });
    }

    // Validate addresses
    validateAddress(requesterAddress, 'requesterAddress');
    validateAddress(patientAddress, 'patientAddress');

    // Default expirationTime to 0 if not provided
    const expTime = expirationTime !== undefined ? parseInt(expirationTime, 10) : 0;

    const result = await consentService.requestAccess(
      requesterAddress,
      patientAddress,
      dataTypes,
      purposes,
      expTime
    );

    const blockNumber = await web3Service.getBlockNumber();
    const networkInfo = await web3Service.getNetworkInfo();

    res.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        blockNumber: blockNumber,
        network: networkInfo.name,
        chainId: networkInfo.chainId
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/requests/:requestId/approve (when mounted at /api/requests)
 * PUT /api/consent/requests/:requestId/approve (when mounted at /api/consent)
 * Approve an access request
 * 
 * @deprecated This endpoint is deprecated. Frontend now signs transactions directly via MetaMask.
 * 
 * Path parameters:
 * - requestId (required): Request ID to approve
 * 
 * Body:
 * - patientAddress (required): Ethereum address of patient
 * 
 * Returns: Transaction result with transaction hash
 */
requestRouter.put('/:requestId/approve', validateRequestId(), async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { patientAddress } = req.body;

    if (!patientAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'patientAddress is required',
          details: { field: 'patientAddress' }
        }
      });
    }

    validateAddress(patientAddress, 'patientAddress');

    const result = await consentService.respondToAccessRequest(patientAddress, requestId, true);

    const blockNumber = await web3Service.getBlockNumber();
    const networkInfo = await web3Service.getNetworkInfo();

    res.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        blockNumber: blockNumber,
        network: networkInfo.name,
        chainId: networkInfo.chainId
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/requests/:requestId/deny (when mounted at /api/requests)
 * PUT /api/consent/requests/:requestId/deny (when mounted at /api/consent)
 * Deny an access request
 * 
 * @deprecated This endpoint is deprecated. Frontend now signs transactions directly via MetaMask.
 * 
 * Path parameters:
 * - requestId (required): Request ID to deny
 * 
 * Body:
 * - patientAddress (required): Ethereum address of patient
 * 
 * Returns: Transaction result with transaction hash
 */
requestRouter.put('/:requestId/deny', validateRequestId(), async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { patientAddress } = req.body;

    if (!patientAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'patientAddress is required',
          details: { field: 'patientAddress' }
        }
      });
    }

    validateAddress(patientAddress, 'patientAddress');

    const result = await consentService.respondToAccessRequest(patientAddress, requestId, false);

    const blockNumber = await web3Service.getBlockNumber();
    const networkInfo = await web3Service.getNetworkInfo();

    res.json({
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        blockNumber: blockNumber,
        network: networkInfo.name,
        chainId: networkInfo.chainId
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = {
  consentRouter,
  requestRouter,
  eventRouter
};

