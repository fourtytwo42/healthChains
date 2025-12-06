const authService = require('../services/authService');
const { normalizeAddress } = require('../utils/addressUtils');
const { ValidationError } = require('../utils/errors');

/**
 * Authentication middleware
 * 
 * Verifies JWT token and extracts user address.
 * Adds req.user with address property.
 */

/**
 * Middleware to verify JWT token
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
function authenticate(req, res, next) {
  // Check if authentication is disabled (for development)
  if (process.env.AUTH_REQUIRED === 'false') {
    // In development mode, allow requests without auth
    // Extract address from query/params if available for testing
    const address = (req.query && req.query.address) || req.params.patientAddress || req.params.providerAddress;
    req.user = address 
      ? { address: normalizeAddress(address) }
      : null;
    return next();
  }

  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required. Please provide a valid JWT token in Authorization header.',
          details: {
            format: 'Authorization: Bearer <token>'
          }
        }
      });
    }

    // Verify token
    const decoded = authService.verifyToken(token);
    
    // Add user info to request
    req.user = {
      address: decoded.address
    };

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: error.message,
          details: error.details || {}
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
        details: { error: error.message }
      }
    });
  }
}

/**
 * Middleware to verify user owns the requested resource
 * 
 * @param {string} addressParam - Name of parameter containing address (e.g., 'patientAddress', 'providerAddress')
 * @returns {Function} Express middleware
 */
function verifyOwnership(addressParam) {
  return (req, res, next) => {
    // If auth is disabled, skip ownership check
    if (process.env.AUTH_REQUIRED === 'false') {
      return next();
    }

    if (!req.user || !req.user.address) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    const requestedAddress = req.params[addressParam] || req.query[addressParam];
    
    if (!requestedAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: `${addressParam} is required`
        }
      });
    }

    const normalizedRequested = normalizeAddress(requestedAddress);
    const normalizedUser = normalizeAddress(req.user.address);

    if (normalizedRequested !== normalizedUser) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You can only access your own data',
          details: {
            requested: normalizedRequested,
            authenticated: normalizedUser
          }
        }
      });
    }

    next();
  };
}

/**
 * Middleware to verify user is either patient or provider in the request
 * Used for endpoints that check consent between two parties
 * 
 * @returns {Function} Express middleware
 */
function verifyParticipant() {
  return (req, res, next) => {
    // If auth is disabled, skip participant check
    if (process.env.AUTH_REQUIRED === 'false') {
      return next();
    }

    if (!req.user || !req.user.address) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    const patientAddress = req.query.patientAddress || req.params.patientAddress;
    const providerAddress = req.query.providerAddress || req.params.providerAddress;
    
    // If no addresses in query/params, allow access (some endpoints don't require participant check)
    if (!patientAddress && !providerAddress) {
      return next();
    }
    
    const normalizedUser = normalizeAddress(req.user.address);

    // User must be either the patient or the provider
    const isPatient = patientAddress && normalizeAddress(patientAddress) === normalizedUser;
    const isProvider = providerAddress && normalizeAddress(providerAddress) === normalizedUser;

    if (!isPatient && !isProvider) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'You must be either the patient or provider to access this resource',
          details: {
            authenticated: normalizedUser,
            patientAddress: patientAddress ? normalizeAddress(patientAddress) : null,
            providerAddress: providerAddress ? normalizeAddress(providerAddress) : null
          }
        }
      });
    }

    next();
  };
}

/**
 * Optional authentication middleware
 * Adds user info if token is present, but doesn't require it
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authService.extractTokenFromHeader(authHeader);

  if (token) {
    try {
      const decoded = authService.verifyToken(token);
      req.user = {
        address: decoded.address
      };
    } catch (error) {
      // Ignore token errors for optional auth
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
}

module.exports = {
  authenticate,
  verifyOwnership,
  verifyParticipant,
  optionalAuth
};

