const { normalizeAddress } = require('../utils/addressUtils');
const mockPatients = require('../data/mockup-patients');
const mockProviders = require('../data/mockup-providers');

/**
 * Authorization middleware
 * 
 * Role-based access control for patients and providers
 */

/**
 * Get user role from address
 * @param {string} address - Ethereum address
 * @returns {Object} { role: 'patient' | 'provider' | 'both' | 'unknown', patientId?, providerId? }
 */
function getUserRole(address) {
  if (!address) {
    return { role: 'unknown' };
  }

  // Normalize both the input address and compare with lowercase
  // This handles cases where mock data might have different casing
  const normalizedInput = normalizeAddress(address).toLowerCase();
  
  // Check if address is a patient
  const patient = mockPatients.mockPatients.patients.find(
    p => {
      const patientAddr = p.blockchainIntegration?.walletAddress;
      if (!patientAddr) return false;
      try {
        return normalizeAddress(patientAddr).toLowerCase() === normalizedInput;
      } catch {
        // If normalization fails, compare as lowercase
        return patientAddr.toLowerCase() === normalizedInput;
      }
    }
  );
  
  // Check if address is a provider
  const provider = mockProviders.mockProviders.providers.find(
    p => {
      const providerAddr = p.blockchainIntegration?.walletAddress;
      if (!providerAddr) return false;
      try {
        return normalizeAddress(providerAddr).toLowerCase() === normalizedInput;
      } catch {
        // If normalization fails, compare as lowercase
        return providerAddr.toLowerCase() === normalizedInput;
      }
    }
  );

  if (patient && provider) {
    return { role: 'both', patientId: patient.patientId, providerId: provider.providerId };
  } else if (patient) {
    return { role: 'patient', patientId: patient.patientId };
  } else if (provider) {
    return { role: 'provider', providerId: provider.providerId };
  }

  return { role: 'unknown' };
}

/**
 * Middleware to require user to be a provider
 */
function requireProvider(req, res, next) {
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

  const userRole = getUserRole(req.user.address);
  
  // Debug logging
  console.log('[requireProvider] User address:', req.user.address);
  console.log('[requireProvider] User role:', userRole);
  
  if (userRole.role !== 'provider' && userRole.role !== 'both') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'This endpoint requires provider role',
        details: {
          userRole: userRole.role,
          userAddress: req.user.address
        }
      }
    });
  }

  // Add role info to request
  req.userRole = userRole;
  next();
}

/**
 * Middleware to require user to be a patient
 */
function requirePatient(req, res, next) {
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

  const userRole = getUserRole(req.user.address);
  
  if (userRole.role !== 'patient' && userRole.role !== 'both') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'This endpoint requires patient role',
        details: {
          userRole: userRole.role
        }
      }
    });
  }

  // Add role info to request
  req.userRole = userRole;
  next();
}

/**
 * Middleware to allow either patient or provider
 */
function requirePatientOrProvider(req, res, next) {
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

  const userRole = getUserRole(req.user.address);
  
  if (userRole.role === 'unknown') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'ACCESS_DENIED',
        message: 'User must be a patient or provider',
        details: {
          userRole: userRole.role
        }
      }
    });
  }

  // Add role info to request
  req.userRole = userRole;
  next();
}

/**
 * Middleware to verify patient can only access their own data
 * Use this for patient endpoints where they should only see their own data
 */
function verifyPatientOwnership(patientAddressParam = 'patientAddress') {
  return (req, res, next) => {
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

    const userRole = getUserRole(req.user.address);
    
    // If user is not a patient (or both), deny access
    if (userRole.role !== 'patient' && userRole.role !== 'both') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'This endpoint requires patient role'
        }
      });
    }

    const requestedAddress = req.params[patientAddressParam] || req.query[patientAddressParam];
    
    if (!requestedAddress) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: `${patientAddressParam} is required`
        }
      });
    }

    const normalizedRequested = normalizeAddress(requestedAddress);
    const normalizedUser = normalizeAddress(req.user.address);

    // Patient can only access their own data
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

    req.userRole = userRole;
    next();
  };
}

/**
 * Middleware to verify provider can access patient data if they have consent
 * Use this for provider endpoints accessing patient data
 */
function verifyProviderAccessWithConsent(consentService) {
  return async (req, res, next) => {
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

    const userRole = getUserRole(req.user.address);
    
    // If user is not a provider (or both), deny access
    if (userRole.role !== 'provider' && userRole.role !== 'both') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESS_DENIED',
          message: 'This endpoint requires provider role'
        }
      });
    }

    const providerAddress = req.params.providerAddress || req.user.address;
    const patientAddress = req.params.patientAddress || req.query.patientAddress;
    const dataType = req.params.dataType || req.query.dataType;

    // If accessing patient data, check consent
    if (patientAddress && dataType) {
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
        // If consent check fails, deny access (strict mode)
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

    req.userRole = userRole;
    next();
  };
}

module.exports = {
  getUserRole,
  requireProvider,
  requirePatient,
  requirePatientOrProvider,
  verifyPatientOwnership,
  verifyProviderAccessWithConsent
};

