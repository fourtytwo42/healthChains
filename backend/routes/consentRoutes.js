const express = require('express');
const router = express.Router();
const consentService = require('../services/consentService');
const web3Service = require('../services/web3Service');
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
router.get('/status', async (req, res, next) => {
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
 * GET /api/consent/:consentId
 * Get full consent record by ID
 * 
 * Path parameters:
 * - consentId (required): Consent ID
 * 
 * Returns: Full consent record with all fields
 */
router.get('/:consentId', validateConsentId(), async (req, res, next) => {
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
router.get(
  '/patient/:patientAddress',
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
router.get(
  '/provider/:providerAddress',
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
 * GET /api/requests/:requestId
 * Get access request by ID
 * 
 * Path parameters:
 * - requestId (required): Request ID
 * 
 * Returns: Full access request record
 */
router.get('/requests/:requestId', validateRequestId(), async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const request = await consentService.getAccessRequest(requestId);

    const blockNumber = await web3Service.getBlockNumber();
    const networkInfo = await web3Service.getNetworkInfo();

    res.json({
      success: true,
      data: request,
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
router.get(
  '/requests/patient/:patientAddress',
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
router.get(
  '/events/consent',
  validateBlockRange(),
  async (req, res, next) => {
    try {
      const { patientAddress, fromBlock, toBlock } = req.query;

      // Validate patient address if provided
      if (patientAddress) {
        validateAddress(patientAddress, 'patientAddress');
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
  }
);

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
router.get(
  '/events/requests',
  validateBlockRange(),
  async (req, res, next) => {
    try {
      const { patientAddress, fromBlock, toBlock } = req.query;

      // Validate patient address if provided
      if (patientAddress) {
        validateAddress(patientAddress, 'patientAddress');
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
  }
);

module.exports = router;

