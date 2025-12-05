const {
  ValidationError,
  InvalidAddressError,
  InvalidIdError,
  Web3ConnectionError,
  ContractError,
  NotFoundError,
  ConfigurationError,
  BaseError
} = require('../utils/errors');

/**
 * Centralized error handling middleware for Express
 * 
 * Maps custom errors to appropriate HTTP status codes and response formats.
 * Sanitizes error messages for client responses while logging full details server-side.
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  // Log full error details server-side
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    code: err.code,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle known custom errors
  if (err instanceof ValidationError || 
      err instanceof InvalidAddressError || 
      err instanceof InvalidIdError) {
    return res.status(400).json({
      success: false,
      error: err.toJSON()
    });
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      error: err.toJSON()
    });
  }

  if (err instanceof Web3ConnectionError) {
    return res.status(503).json({
      success: false,
      error: {
        code: err.code,
        message: 'Blockchain connection failed. Please try again later.',
        details: {
          retryAfter: 30 // Suggest retry after 30 seconds
        }
      }
    });
  }

  if (err instanceof ContractError) {
    // Don't expose internal contract errors
    return res.status(500).json({
      success: false,
      error: {
        code: err.code,
        message: 'Contract interaction failed',
        details: {
          method: err.method || 'unknown'
        }
      }
    });
  }

  if (err instanceof ConfigurationError) {
    return res.status(500).json({
      success: false,
      error: {
        code: err.code,
        message: 'Server configuration error'
      }
    });
  }

  if (err instanceof BaseError) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.toJSON()
    });
  }

  // Handle ethers.js errors
  if (err.code === 'CALL_EXCEPTION') {
    return res.status(404).json({
      success: false,
      error: {
        code: 'CONTRACT_CALL_FAILED',
        message: 'Contract call failed. Resource may not exist.',
        details: {
          reason: err.reason || 'Unknown error'
        }
      }
    });
  }

  if (err.code === 'NETWORK_ERROR' || err.code === 'TIMEOUT') {
    return res.status(503).json({
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Network request failed. Please try again later.',
        details: {
          retryAfter: 30
        }
      }
    });
  }

  // Handle validation errors from express-validator (if used)
  if (err.name === 'ValidationError' && err.array) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.array()
      }
    });
  }

  // Default: Internal server error
  // Never expose stack traces or internal error details to clients
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An internal server error occurred'
    }
  });
}

/**
 * 404 handler for undefined routes
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};

