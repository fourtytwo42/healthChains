const { validateAddress, normalizeAddress } = require('../utils/addressUtils');
const { ValidationError, InvalidIdError } = require('../utils/errors');

/**
 * Validation middleware for Express routes
 * 
 * Provides reusable validation functions for common input types:
 * - Ethereum addresses
 * - Numeric IDs (consent IDs, request IDs)
 * - Data types and purposes
 * - Block ranges
 */

/**
 * Validate Ethereum address from request parameter
 * 
 * @param {string} paramName - Name of parameter to validate (e.g., 'patientAddress')
 * @param {string} source - Source of parameter ('params', 'query', 'body')
 * @returns {Function} Express middleware function
 */
function validateAddressParam(paramName, source = 'params') {
  return (req, res, next) => {
    try {
      const address = req[source][paramName];
      if (!address) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: `${paramName} is required`,
            details: { field: paramName, source }
          }
        });
      }

      validateAddress(address, paramName);
      // Normalize address in request for downstream use
      req[source][paramName] = normalizeAddress(address);
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.toJSON()
        });
      }
      next(error);
    }
  };
}

/**
 * Validate consent ID from request parameter
 * 
 * @returns {Function} Express middleware function
 */
function validateConsentId() {
  return (req, res, next) => {
    try {
      const consentId = req.params.consentId;
      if (consentId === undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: 'consentId is required',
            details: { field: 'consentId' }
          }
        });
      }

      const id = parseInt(consentId, 10);
      if (isNaN(id) || id < 0 || !Number.isInteger(parseFloat(consentId))) {
        throw new InvalidIdError(consentId, 'consentId');
      }

      // Store parsed ID for downstream use
      req.params.consentId = id;
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.toJSON()
        });
      }
      next(error);
    }
  };
}

/**
 * Validate request ID from request parameter
 * 
 * @returns {Function} Express middleware function
 */
function validateRequestId() {
  return (req, res, next) => {
    try {
      const requestId = req.params.requestId;
      if (requestId === undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: 'requestId is required',
            details: { field: 'requestId' }
          }
        });
      }

      const id = parseInt(requestId, 10);
      if (isNaN(id) || id < 0 || !Number.isInteger(parseFloat(requestId))) {
        throw new InvalidIdError(requestId, 'requestId');
      }

      // Store parsed ID for downstream use
      req.params.requestId = id;
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.toJSON()
        });
      }
      next(error);
    }
  };
}

/**
 * Validate dataType query parameter
 * 
 * @param {Array} allowedTypes - Optional array of allowed data types
 * @returns {Function} Express middleware function
 */
function validateDataType(allowedTypes = null) {
  return (req, res, next) => {
    try {
      const dataType = req.query.dataType;
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

      if (typeof dataType !== 'string' || dataType.trim().length === 0) {
        throw new ValidationError(
          'dataType must be a non-empty string',
          'dataType',
          dataType
        );
      }

      if (allowedTypes && !allowedTypes.includes(dataType)) {
        throw new ValidationError(
          `dataType must be one of: ${allowedTypes.join(', ')}`,
          'dataType',
          dataType
        );
      }

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.toJSON()
        });
      }
      next(error);
    }
  };
}

/**
 * Validate purpose query parameter
 * 
 * @param {Array} allowedPurposes - Optional array of allowed purposes
 * @returns {Function} Express middleware function
 */
function validatePurpose(allowedPurposes = null) {
  return (req, res, next) => {
    try {
      const purpose = req.query.purpose;
      if (purpose && (typeof purpose !== 'string' || purpose.trim().length === 0)) {
        throw new ValidationError(
          'purpose must be a non-empty string if provided',
          'purpose',
          purpose
        );
      }

      if (purpose && allowedPurposes && !allowedPurposes.includes(purpose)) {
        throw new ValidationError(
          `purpose must be one of: ${allowedPurposes.join(', ')}`,
          'purpose',
          purpose
        );
      }

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.toJSON()
        });
      }
      next(error);
    }
  };
}

/**
 * Validate block range query parameters
 * 
 * @returns {Function} Express middleware function
 */
function validateBlockRange() {
  return (req, res, next) => {
    try {
      const fromBlock = req.query.fromBlock;
      const toBlock = req.query.toBlock;

      if (fromBlock !== undefined) {
        const from = parseInt(fromBlock, 10);
        if (isNaN(from) || from < 0 || !Number.isInteger(parseFloat(fromBlock))) {
          throw new ValidationError(
            'fromBlock must be a non-negative integer',
            'fromBlock',
            fromBlock
          );
        }
        req.query.fromBlock = from;
      }

      if (toBlock !== undefined) {
        const to = parseInt(toBlock, 10);
        if (isNaN(to) || to < 0 || !Number.isInteger(parseFloat(toBlock))) {
          throw new ValidationError(
            'toBlock must be a non-negative integer',
            'toBlock',
            toBlock
          );
        }
        req.query.toBlock = to;
      }

      // Validate range if both provided
      if (fromBlock !== undefined && toBlock !== undefined) {
        const from = req.query.fromBlock;
        const to = req.query.toBlock;
        
        if (from > to) {
          throw new ValidationError(
            'fromBlock must be <= toBlock',
            'fromBlock',
            fromBlock
          );
        }

        // Limit block range to prevent DoS (max 10000 blocks)
        if (to - from > 10000) {
          throw new ValidationError(
            'Block range cannot exceed 10000 blocks',
            'toBlock',
            toBlock
          );
        }
      }

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.toJSON()
        });
      }
      next(error);
    }
  };
}

/**
 * Validate status filter parameter
 * 
 * @param {Array} allowedStatuses - Array of allowed status values
 * @returns {Function} Express middleware function
 */
function validateStatus(allowedStatuses = ['pending', 'approved', 'denied', 'all']) {
  return (req, res, next) => {
    try {
      const status = req.query.status || 'all';
      
      if (!allowedStatuses.includes(status)) {
        throw new ValidationError(
          `status must be one of: ${allowedStatuses.join(', ')}`,
          'status',
          status
        );
      }

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.toJSON()
        });
      }
      next(error);
    }
  };
}

/**
 * Validate includeExpired boolean query parameter
 * 
 * @returns {Function} Express middleware function
 */
function validateIncludeExpired() {
  return (req, res, next) => {
    const includeExpired = req.query.includeExpired;
    if (includeExpired !== undefined) {
      // Convert string to boolean
      req.query.includeExpired = includeExpired === 'true' || includeExpired === true;
    } else {
      req.query.includeExpired = false;
    }
    next();
  };
}

module.exports = {
  validateAddressParam,
  validateConsentId,
  validateRequestId,
  validateDataType,
  validatePurpose,
  validateBlockRange,
  validateStatus,
  validateIncludeExpired
};

