const web3Service = require('./web3Service');
const { normalizeAddress, validateAddress } = require('../utils/addressUtils');
const { 
  ValidationError, 
  InvalidIdError, 
  ContractError, 
  NotFoundError,
  Web3ConnectionError 
} = require('../utils/errors');
const { ethers } = require('ethers');

/**
 * Consent Service - High-level service for contract interactions
 * 
 * Provides business logic layer for interacting with PatientConsentManager contract.
 * Handles data transformation, validation, and error mapping.
 * 
 * @class ConsentService
 */
class ConsentService {
  constructor() {
    this.contract = null;
  }

  /**
   * Initialize service with contract instance
   * 
   * @private
   */
  async _ensureContract() {
    // Always get a fresh contract instance to avoid caching issues
    // This ensures we're using the latest contract address and ABI
    if (!web3Service.isInitialized) {
      await web3Service.initialize();
    }
    const contract = await web3Service.getContract();
    if (!contract) {
      throw new ConfigurationError('Failed to get contract instance from web3Service');
    }
    // Don't cache - always get fresh instance to handle contract redeployments in tests
    return contract;
  }

  /**
   * Transform BigInt values to strings for JSON serialization
   * 
   * @private
   * @param {any} value - Value to transform
   * @returns {any} Transformed value
   */
  _transformBigInt(value) {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (Array.isArray(value)) {
      return value.map(item => this._transformBigInt(item));
    }
    if (value && typeof value === 'object') {
      const transformed = {};
      for (const [key, val] of Object.entries(value)) {
        transformed[key] = this._transformBigInt(val);
      }
      return transformed;
    }
    return value;
  }

  /**
   * Transform consent record from contract format to API format
   * 
   * @private
   * @param {Object} record - Contract consent record
   * @param {number} consentId - Consent ID
   * @returns {Object} Transformed consent record
   */
  _transformConsentRecord(record, consentId) {
    return {
      consentId: Number(consentId),
      patientAddress: ethers.getAddress(record.patientAddress),
      providerAddress: ethers.getAddress(record.providerAddress),
      timestamp: new Date(Number(record.timestamp) * 1000).toISOString(),
      expirationTime: record.expirationTime === 0n 
        ? null 
        : new Date(Number(record.expirationTime) * 1000).toISOString(),
      isActive: record.isActive,
      dataType: record.dataType,
      purpose: record.purpose,
      isExpired: record.expirationTime !== 0n && 
                 Number(record.expirationTime) < Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Transform access request from contract format to API format
   * 
   * @private
   * @param {Object} request - Contract access request
   * @param {number} requestId - Request ID
   * @param {string[]} dataTypes - Array of data types (from mapping)
   * @param {string[]} purposes - Array of purposes (from mapping)
   * @returns {Object} Transformed access request
   */
  _transformAccessRequest(request, requestId, dataTypes, purposes) {
    return {
      requestId: Number(requestId),
      requester: ethers.getAddress(request.requester),
      patientAddress: ethers.getAddress(request.patientAddress),
      timestamp: new Date(Number(request.timestamp) * 1000).toISOString(),
      expirationTime: request.expirationTime === 0n 
        ? null 
        : new Date(Number(request.expirationTime) * 1000).toISOString(),
      isProcessed: request.isProcessed,
      status: this._mapRequestStatus(request.status),
      dataTypes: dataTypes && dataTypes.length > 0 ? dataTypes : [],
      purposes: purposes && purposes.length > 0 ? purposes : [],
      isExpired: request.expirationTime !== 0n && 
                 Number(request.expirationTime) < Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Map contract RequestStatus enum to string
   * 
   * @private
   * @param {number} status - Contract status enum value
   * @returns {string} Status string
   */
  _mapRequestStatus(status) {
    const statusMap = {
      0: 'pending',
      1: 'approved',
      2: 'denied'
    };
    return statusMap[Number(status)] || 'unknown';
  }

  /**
   * Check if active consent exists between patient and provider for data type
   * 
   * @param {string} patientAddress - Ethereum address of patient
   * @param {string} providerAddress - Ethereum address of provider
   * @param {string} dataType - Type of data (e.g., 'medical_records')
   * @returns {Promise<Object>} Object with hasConsent, consentId, isExpired
   * @throws {ValidationError} If addresses or dataType are invalid
   * @throws {ContractError} If contract call fails
   */
  async getConsentStatus(patientAddress, providerAddress, dataType) {
    // Validate inputs
    validateAddress(patientAddress, 'patientAddress');
    validateAddress(providerAddress, 'providerAddress');
    
    if (!dataType || typeof dataType !== 'string' || dataType.trim().length === 0) {
      throw new ValidationError('dataType is required and must be a non-empty string', 'dataType', dataType);
    }

    // Normalize addresses
    const normalizedPatient = normalizeAddress(patientAddress);
    const normalizedProvider = normalizeAddress(providerAddress);

    try {
      const contract = await this._ensureContract();
      
      if (!contract) {
        throw new ConfigurationError('Contract instance is not available');
      }
      
      // Check if method exists
      if (typeof contract.hasActiveConsent !== 'function') {
        throw new ConfigurationError('hasActiveConsent method not found on contract');
      }
      
      // Call contract method with timeout wrapper
      let result;
      try {
        // Direct call without Promise.race to avoid undefined results
        result = await contract.hasActiveConsent(normalizedPatient, normalizedProvider, dataType);
        
        // Verify result is not undefined
        if (result === undefined) {
          throw new Error('Contract call returned undefined - this should not happen');
        }
      } catch (callError) {
        // If it's a CALL_EXCEPTION, it might mean the method doesn't exist or the call failed
        if (callError.code === 'CALL_EXCEPTION') {
          throw new ContractError(
            'Failed to check consent status',
            'hasActiveConsent',
            callError
          );
        }
        if (callError.message === 'Request timeout') {
          throw new Web3ConnectionError('Request timed out while checking consent status');
        }
        throw callError;
      }

      // In ethers v6, named tuple returns are objects with property names
      // Handle both object (named tuple) and array returns
      if (result === undefined || result === null) {
        throw new Error(`Invalid result from hasActiveConsent: result is ${result}`);
      }
      
      let hasConsent, consentId;
      if (typeof result === 'object') {
        // Check if it's a named tuple (ethers v6 style)
        if (result.hasOwnProperty('hasConsent') && result.hasOwnProperty('consentId')) {
          hasConsent = result.hasConsent;
          consentId = result.consentId;
        } else if (result.hasOwnProperty('0') && result.hasOwnProperty('1')) {
          // Indexed properties (alternative ethers v6 format)
          hasConsent = result[0];
          consentId = result[1];
        } else if (Array.isArray(result)) {
          // Array return
          [hasConsent, consentId] = result;
        } else if (result.length !== undefined && result.length >= 2) {
          // Array-like object
          hasConsent = result[0];
          consentId = result[1];
        } else {
          throw new Error(`Unexpected result format from hasActiveConsent: ${JSON.stringify(result)}`);
        }
      } else {
        throw new Error(`Invalid result from hasActiveConsent: ${typeof result}`);
      }
      
      // If consent exists, check if expired
      let isExpired = false;
      let expirationTime = null;
      
      if (hasConsent && consentId !== 0n) {
        const record = await this.getConsentRecord(Number(consentId));
        isExpired = record.isExpired;
        expirationTime = record.expirationTime;
      }

      return {
        hasConsent: hasConsent,
        consentId: hasConsent ? Number(consentId) : null,
        isExpired: isExpired,
        expirationTime: expirationTime
      };
    } catch (error) {
      if (error.code === 'CALL_EXCEPTION') {
        throw new ContractError(
          'Failed to check consent status',
          'hasActiveConsent',
          error
        );
      }
      if (error.message === 'Request timeout') {
        throw new Web3ConnectionError('Request timed out while checking consent status');
      }
      throw error;
    }
  }

  /**
   * Get full consent record by ID
   * 
   * @param {number} consentId - Consent ID
   * @returns {Promise<Object>} Transformed consent record
   * @throws {InvalidIdError} If consentId is invalid
   * @throws {NotFoundError} If consent not found
   * @throws {ContractError} If contract call fails
   */
  async getConsentRecord(consentId) {
    // Validate ID
    if (!Number.isInteger(consentId) || consentId < 0) {
      throw new InvalidIdError(consentId, 'consentId');
    }

    try {
      const contract = await this._ensureContract();
      
      // Check if it's a batch consent
      const isBatch = await contract.isBatchConsent(consentId);
      
      let result;
      if (isBatch) {
        // Fetch batch consent record
        result = await Promise.race([
          contract.getBatchConsentRecord(consentId),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 30000)
          )
        ]);
        
        // Transform batch consent
        const batchRecord = result;
        
        // Look up strings from hashes for all data types and purposes
        const dataTypes = await Promise.all(
          batchRecord.dataTypeHashes.map(async (hash) => {
            try {
              return await contract.dataTypeHashToString(hash);
            } catch (error) {
              console.warn('Failed to look up dataType from hash:', error.message);
              return hash; // Fallback to hash as string
            }
          })
        );
        
        const purposes = await Promise.all(
          batchRecord.purposeHashes.map(async (hash) => {
            try {
              return await contract.purposeHashToString(hash);
            } catch (error) {
              console.warn('Failed to look up purpose from hash:', error.message);
              return hash; // Fallback to hash as string
            }
          })
        );
        
        return {
          consentId: Number(consentId),
          patientAddress: ethers.getAddress(batchRecord.patientAddress),
          providerAddress: ethers.getAddress(batchRecord.providerAddress),
          timestamp: new Date(Number(batchRecord.timestamp) * 1000).toISOString(),
          expirationTime: batchRecord.expirationTime === 0n 
            ? null 
            : new Date(Number(batchRecord.expirationTime) * 1000).toISOString(),
          isActive: batchRecord.isActive,
          dataTypes: dataTypes,
          purposes: purposes,
          isBatch: true,
          isExpired: batchRecord.expirationTime !== 0n && 
                     Number(batchRecord.expirationTime) < Math.floor(Date.now() / 1000)
        };
      } else {
        // Fetch regular consent record
        result = await Promise.race([
          contract.getConsentRecord(consentId),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 30000)
          )
        ]);

        // Handle ethers v6 return format (may be object with named properties or array)
        let record;
        if (result && typeof result === 'object') {
          if (result.patientAddress !== undefined) {
            // Named struct return
            record = result;
          } else if (Array.isArray(result)) {
            // Array return - convert to object (new format with hashes)
            record = {
              patientAddress: result[0],
              providerAddress: result[1],
              timestamp: result[2],
              expirationTime: result[3],
              isActive: result[4],
              dataTypeHash: result[5],  // bytes32 hash
              purposeHash: result[6]   // bytes32 hash
            };
          } else {
            // Try indexed access
            record = {
              patientAddress: result[0] || result.patientAddress,
              providerAddress: result[1] || result.providerAddress,
              timestamp: result[2] || result.timestamp,
              expirationTime: result[3] || result.expirationTime,
              isActive: result[4] !== undefined ? result[4] : result.isActive,
              dataTypeHash: result[5] || result.dataTypeHash,
              purposeHash: result[6] || result.purposeHash,
              // Backward compatibility
              dataType: result.dataType,
              purpose: result.purpose
            };
          }
        } else {
          throw new Error('Unexpected result format from getConsentRecord');
        }

        // Look up strings from hashes if needed
        if (record.dataTypeHash && !record.dataType) {
          try {
            record.dataType = await contract.dataTypeHashToString(record.dataTypeHash);
          } catch (error) {
            console.warn('Failed to look up dataType from hash:', error.message);
            record.dataType = record.dataTypeHash; // Fallback to hash as string
          }
        }
        if (record.purposeHash && !record.purpose) {
          try {
            record.purpose = await contract.purposeHashToString(record.purposeHash);
          } catch (error) {
            console.warn('Failed to look up purpose from hash:', error.message);
            record.purpose = record.purposeHash; // Fallback to hash as string
          }
        }

        return this._transformConsentRecord(record, consentId);
      }
    } catch (error) {
      if (error.code === 'CALL_EXCEPTION' || error.reason === 'ConsentNotFound()') {
        throw new NotFoundError('Consent', consentId);
      }
      if (error.message === 'Request timeout') {
        throw new Web3ConnectionError('Request timed out while fetching consent record');
      }
      throw new ContractError(
        'Failed to fetch consent record',
        'getConsentRecord',
        error
      );
    }
  }

  /**
   * Get all consent IDs for a patient
   * 
   * @param {string} patientAddress - Ethereum address of patient
   * @param {boolean} includeExpired - Whether to include expired consents (default: false)
   * @returns {Promise<Array>} Array of consent records
   * @throws {ValidationError} If address is invalid
   * @throws {ContractError} If contract call fails
   */
  async getPatientConsents(patientAddress, includeExpired = false) {
    validateAddress(patientAddress, 'patientAddress');
    const normalizedAddress = normalizeAddress(patientAddress);

    try {
      const contract = await this._ensureContract();
      
      const consentIds = await Promise.race([
        contract.getPatientConsents(normalizedAddress),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
      ]);

      // Fetch full records for each consent ID
      const records = await Promise.all(
        Array.from(consentIds).map(async (id) => {
          try {
            return await this.getConsentRecord(Number(id));
          } catch (error) {
            // Skip if consent not found (shouldn't happen, but handle gracefully)
            if (error instanceof NotFoundError) {
              return null;
            }
            throw error;
          }
        })
      );

      // Filter out nulls and optionally expired consents
      let filtered = records.filter(r => r !== null);
      if (!includeExpired) {
        filtered = filtered.filter(r => !r.isExpired && r.isActive);
      }

      return filtered;
    } catch (error) {
      if (error.message === 'Request timeout') {
        throw new Web3ConnectionError('Request timed out while fetching patient consents');
      }
      throw new ContractError(
        'Failed to fetch patient consents',
        'getPatientConsents',
        error
      );
    }
  }

  /**
   * Get all consent IDs for a provider
   * 
   * @param {string} providerAddress - Ethereum address of provider
   * @param {boolean} includeExpired - Whether to include expired consents (default: false)
   * @returns {Promise<Array>} Array of consent records
   * @throws {ValidationError} If address is invalid
   * @throws {ContractError} If contract call fails
   */
  async getProviderConsents(providerAddress, includeExpired = false) {
    validateAddress(providerAddress, 'providerAddress');
    const normalizedAddress = normalizeAddress(providerAddress);

    try {
      const contract = await this._ensureContract();
      
      // Query ConsentGranted events filtered by provider address
      // ConsentGranted event: (uint256 indexed consentId, address indexed patient, address indexed provider, ...)
      const filter = contract.filters.ConsentGranted(null, null, normalizedAddress);
      
      // Query from deployment block to latest
      const fromBlock = 0; // Start from contract deployment
      const toBlock = 'latest';
      
      const events = await contract.queryFilter(filter, fromBlock, toBlock);
      
      // Transform events to consent records
      const consents = await Promise.all(
        events.map(async (event) => {
          const consentId = Number(event.args.consentId);
          try {
            return await this.getConsentRecord(consentId);
          } catch (error) {
            // Consent might have been revoked or doesn't exist
            return null;
          }
        })
      );

      // Filter out nulls and by expiration if needed
      let filtered = consents.filter(c => c !== null);
      
      if (!includeExpired) {
        filtered = filtered.filter(c => c.isActive && !c.isExpired);
      }

      return filtered;
    } catch (error) {
      throw new ContractError(
        'Failed to fetch provider consents',
        'getProviderConsents',
        error
      );
    }
  }

  /**
   * Check if a consent is expired
   * 
   * @param {number} consentId - Consent ID
   * @returns {Promise<boolean>} True if expired
   * @throws {InvalidIdError} If consentId is invalid
   * @throws {ContractError} If contract call fails
   */
  async isConsentExpired(consentId) {
    if (!Number.isInteger(consentId) || consentId < 0) {
      throw new InvalidIdError(consentId, 'consentId');
    }

    try {
      const contract = await this._ensureContract();
      
      const expired = await Promise.race([
        contract.isConsentExpired(consentId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
      ]);

      return expired;
    } catch (error) {
      if (error.message === 'Request timeout') {
        throw new Web3ConnectionError('Request timed out while checking consent expiration');
      }
      throw new ContractError(
        'Failed to check consent expiration',
        'isConsentExpired',
        error
      );
    }
  }

  /**
   * Check and expire consents for a patient (view function that marks expired)
   * 
   * @param {string} patientAddress - Ethereum address of patient
   * @returns {Promise<number>} Number of consents expired
   * @throws {ValidationError} If address is invalid
   * @throws {ContractError} If contract call fails
   */
  async checkAndExpireConsents(patientAddress) {
    validateAddress(patientAddress, 'patientAddress');
    const normalizedAddress = normalizeAddress(patientAddress);

    try {
      const contract = await this._ensureContract();
      
      // Note: This is a state-changing function, but we're using a read-only provider
      // In a real scenario, this would require a signer. For now, we'll just return 0
      // and document that this requires write access
      console.warn('checkAndExpireConsents requires write access - not implemented in read-only mode');
      return 0;
    } catch (error) {
      throw new ContractError(
        'Failed to check and expire consents',
        'checkAndExpireConsents',
        error
      );
    }
  }

  /**
   * Get access request by ID
   * 
   * @param {number} requestId - Request ID
   * @returns {Promise<Object>} Transformed access request
   * @throws {InvalidIdError} If requestId is invalid
   * @throws {NotFoundError} If request not found
   * @throws {ContractError} If contract call fails
   */
  async getAccessRequest(requestId) {
    if (!Number.isInteger(requestId) || requestId < 0) {
      throw new InvalidIdError(requestId, 'requestId');
    }

    try {
      const contract = await this._ensureContract();
      
      // Try direct contract call first
      try {
        const request = await Promise.race([
          contract.getAccessRequest(requestId),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 30000)
          )
        ]);

        // Read arrays from mappings
        const dataTypes = await contract.requestDataTypes(requestId);
        const purposes = await contract.requestPurposes(requestId);

        return this._transformAccessRequest(request, requestId, dataTypes, purposes);
      } catch (contractError) {
        console.warn('Contract getAccessRequest failed, using event-based fallback:', contractError.message);
        
        // Fallback to event-based query
        try {
          const events = await this.getAccessRequestEvents(null); // Get all events
          
          // Find the AccessRequested event for this requestId
          const requestedEvent = events.find(
            e => e.type === 'AccessRequested' && e.requestId === requestId
          );
          
          if (!requestedEvent) {
            throw new NotFoundError('Access request', requestId);
          }
          
          // Check if request was approved or denied
          const approvedEvent = events.find(
            e => e.type === 'AccessApproved' && e.requestId === requestId
          );
          const deniedEvent = events.find(
            e => e.type === 'AccessDenied' && e.requestId === requestId
          );
          
          // Determine status
          let status = 'pending';
          let isProcessed = false;
          if (approvedEvent) {
            status = 'approved';
            isProcessed = true;
          } else if (deniedEvent) {
            status = 'denied';
            isProcessed = true;
          }
          
          // Build request object from event
          return {
            requestId: requestId,
            requester: requestedEvent.requester,
            patientAddress: requestedEvent.patient,
            timestamp: requestedEvent.timestamp,
            expirationTime: requestedEvent.expirationTime,
            dataTypes: requestedEvent.dataTypes || [],
            purposes: requestedEvent.purposes || [],
            isProcessed: isProcessed,
            status: status,
            isExpired: requestedEvent.expirationTime && new Date(requestedEvent.expirationTime) < new Date()
          };
        } catch (eventError) {
          if (eventError instanceof NotFoundError) {
            throw eventError;
          }
          throw new ContractError(
            'Failed to fetch access request using both contract call and event-based fallback',
            'getAccessRequest',
            { contractError, eventError }
          );
        }
      }
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ContractError) {
        throw error;
      }
      if (error.code === 'CALL_EXCEPTION' || error.reason === 'RequestNotFound()') {
        throw new NotFoundError('Access request', requestId);
      }
      if (error.message === 'Request timeout') {
        throw new Web3ConnectionError('Request timed out while fetching access request');
      }
      throw new ContractError(
        'Failed to fetch access request',
        'getAccessRequest',
        error
      );
    }
  }

  /**
   * Get all request IDs for a patient
   * 
   * @param {string} patientAddress - Ethereum address of patient
   * @param {string} status - Filter by status ('pending', 'approved', 'denied', 'all')
   * @returns {Promise<Array>} Array of access requests
   * @throws {ValidationError} If address is invalid
   * @throws {ContractError} If contract call fails
   */
  async getPatientRequests(patientAddress, status = 'all') {
    validateAddress(patientAddress, 'patientAddress');
    const normalizedAddress = normalizeAddress(patientAddress);

    const validStatuses = ['pending', 'approved', 'denied', 'all'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(
        `Status must be one of: ${validStatuses.join(', ')}`,
        'status',
        status
      );
    }

    try {
      const contract = await this._ensureContract();
      
      // Try direct contract call first
      let requests = [];
      try {
        const requestIds = await Promise.race([
          contract.getPatientRequests(normalizedAddress),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 30000)
          )
        ]);

        // Fetch full records for each request ID
        requests = await Promise.all(
          Array.from(requestIds).map(async (id) => {
            try {
              return await this.getAccessRequest(Number(id));
            } catch (error) {
              if (error instanceof NotFoundError) {
                return null;
              }
              throw error;
            }
          })
        );
      } catch (contractError) {
        console.warn('Contract getPatientRequests failed, using event-based fallback:', contractError.message);
        
        // Fallback to event-based query - build requests directly from events
        try {
          const events = await this.getAccessRequestEvents(normalizedAddress);
          
          // Group events by requestId to determine status
          const requestMap = new Map();
          
          events.forEach(event => {
            const requestId = event.requestId;
            if (requestId === undefined) return;
            
            if (event.type === 'AccessRequested') {
              // Create request object from AccessRequested event
              if (!requestMap.has(requestId)) {
                requestMap.set(requestId, {
                  requestId: requestId,
                  requester: event.requester,
                  patientAddress: event.patient,
                  timestamp: event.timestamp,
                  expirationTime: event.expirationTime,
                  dataTypes: event.dataTypes || [],
                  purposes: event.purposes || [],
                  isProcessed: false,
                  status: 'pending',
                  isExpired: event.expirationTime && new Date(event.expirationTime) < new Date()
                });
              }
            } else if (event.type === 'AccessApproved') {
              // Mark as approved
              if (requestMap.has(requestId)) {
                requestMap.get(requestId).isProcessed = true;
                requestMap.get(requestId).status = 'approved';
              }
            } else if (event.type === 'AccessDenied') {
              // Mark as denied
              if (requestMap.has(requestId)) {
                requestMap.get(requestId).isProcessed = true;
                requestMap.get(requestId).status = 'denied';
              }
            }
          });
          
          requests = Array.from(requestMap.values());
        } catch (eventError) {
          throw new ContractError(
            'Failed to fetch patient requests using both contract call and event-based fallback',
            'getPatientRequests',
            { contractError, eventError }
          );
        }
      }

      // Filter out nulls and by status
      let filtered = requests.filter(r => r !== null);
      if (status !== 'all') {
        filtered = filtered.filter(r => r.status === status);
      }

      return filtered;
    } catch (error) {
      if (error.message === 'Request timeout') {
        throw new Web3ConnectionError('Request timed out while fetching patient requests');
      }
      throw new ContractError(
        'Failed to fetch patient requests',
        'getPatientRequests',
        error
      );
    }
  }

  /**
   * Get pending requests for a patient
   * 
   * @param {string} patientAddress - Ethereum address of patient
   * @returns {Promise<Array>} Array of pending access requests
   * @throws {ValidationError} If address is invalid
   * @throws {ContractError} If contract call fails
   */
  async getPendingRequests(patientAddress) {
    return this.getPatientRequests(patientAddress, 'pending');
  }

  /**
   * Get pending requests made by a provider
   * 
   * @param {string} providerAddress - Ethereum address of provider
   * @returns {Promise<Array>} Array of pending access requests made by this provider
   * @throws {ValidationError} If address is invalid
   * @throws {ContractError} If contract call fails
   */
  async getProviderPendingRequests(providerAddress) {
    validateAddress(providerAddress, 'providerAddress');
    const normalizedAddress = normalizeAddress(providerAddress);

    try {
      // Query all AccessRequested events where requester is this provider
      const events = await this.getAccessRequestEvents(null); // Get all events
      
      // Filter for requests made by this provider that are still pending
      const requestedEvents = events.filter(
        e => e.type === 'AccessRequested' && 
        normalizeAddress(e.requester) === normalizedAddress
      );
      
      // Get approved and denied request IDs
      const approvedRequestIds = new Set(
        events.filter(e => e.type === 'AccessApproved').map(e => e.requestId)
      );
      const deniedRequestIds = new Set(
        events.filter(e => e.type === 'AccessDenied').map(e => e.requestId)
      );
      
      // Get pending request IDs (requested but not approved or denied)
      const pendingRequestIds = requestedEvents
        .filter(e => !approvedRequestIds.has(e.requestId) && !deniedRequestIds.has(e.requestId))
        .map(e => e.requestId);
      
      // Fetch full request details for pending requests
      const requests = await Promise.all(
        pendingRequestIds.map(async (requestId) => {
          try {
            return await this.getAccessRequest(requestId);
          } catch (error) {
            // If request doesn't exist, return null (will be filtered out)
            return null;
          }
        })
      );
      
      // Filter out nulls and return only pending requests
      return requests.filter(r => r !== null && r.status === 'pending');
    } catch (error) {
      throw new ContractError(
        'Failed to fetch provider pending requests',
        'getProviderPendingRequests',
        error
      );
    }
  }

  /**
   * Query consent events (ConsentGranted, ConsentRevoked)
   * 
   * @param {string} patientAddress - Optional patient address filter
   * @param {number} fromBlock - Starting block number (optional)
   * @param {number} toBlock - Ending block number (optional, default: latest)
   * @returns {Promise<Array>} Array of consent events
   * @throws {ValidationError} If address or block range is invalid
   * @throws {ContractError} If event query fails
   */
  async getConsentEvents(patientAddress = null, fromBlock = null, toBlock = null) {
    // Validate address if provided
    if (patientAddress) {
      validateAddress(patientAddress, 'patientAddress');
    }

    // Validate block range
    if (fromBlock !== null && toBlock !== null) {
      if (!Number.isInteger(fromBlock) || fromBlock < 0) {
        throw new ValidationError('fromBlock must be a non-negative integer', 'fromBlock', fromBlock);
      }
      if (!Number.isInteger(toBlock) || toBlock < 0) {
        throw new ValidationError('toBlock must be a non-negative integer', 'toBlock', toBlock);
      }
      if (fromBlock > toBlock) {
        throw new ValidationError('fromBlock must be <= toBlock', 'fromBlock', fromBlock);
      }
      // Limit block range to prevent DoS
      if (toBlock - fromBlock > 10000) {
        throw new ValidationError('Block range cannot exceed 10000 blocks', 'toBlock', toBlock);
      }
    }

    try {
      const contract = await this._ensureContract();
      
      // Build filter
      const filter = {};
      if (patientAddress) {
        filter.patient = normalizeAddress(patientAddress);
      }
      if (fromBlock !== null) {
        filter.fromBlock = fromBlock;
      }
      if (toBlock !== null) {
        filter.toBlock = toBlock;
      }

      // Query ConsentGranted events
      // Handle null/undefined for fromBlock and toBlock
      const fromBlockArg = filter.fromBlock !== null && filter.fromBlock !== undefined ? filter.fromBlock : undefined;
      const toBlockArg = filter.toBlock !== null && filter.toBlock !== undefined ? filter.toBlock : undefined;
      
      // ConsentGranted event: (uint256 indexed consentId, address indexed patient, address indexed provider, ...)
      // If patient filter is provided, filter by patient (second indexed parameter), otherwise get all events
      // In ethers v6, pass null for unfiltered indexed parameters
      const grantedFilter = filter.patient 
        ? contract.filters.ConsentGranted(null, filter.patient, null)
        : contract.filters.ConsentGranted(null, null, null);
      
      let grantedEvents;
      try {
        grantedEvents = await contract.queryFilter(
          grantedFilter,
          fromBlockArg,
          toBlockArg
        );
        // Ensure it's an array
        if (!Array.isArray(grantedEvents)) {
          grantedEvents = [];
        }
      } catch (filterError) {
        console.error('Error querying ConsentGranted events:', filterError.message);
        grantedEvents = [];
      }

      // ConsentRevoked event: (uint256 indexed consentId, address indexed patient, ...)
      // If patient filter is provided, filter by patient (second indexed parameter), otherwise get all events
      const revokedFilter = filter.patient
        ? contract.filters.ConsentRevoked(null, filter.patient)
        : contract.filters.ConsentRevoked(null, null);
      
      let revokedEvents;
      try {
        revokedEvents = await contract.queryFilter(
          revokedFilter,
          fromBlockArg,
          toBlockArg
        );
        // Ensure it's an array
        if (!Array.isArray(revokedEvents)) {
          revokedEvents = [];
        }
      } catch (filterError) {
        console.error('Error querying ConsentRevoked events:', filterError.message);
        revokedEvents = [];
      }

      // Transform and combine events
      const events = [
        ...(await Promise.all(grantedEvents.map(async (event) => {
          // Event now emits bytes32 hashes, need to look up strings
          let dataType = event.args.dataTypeHash || event.args.dataType;
          let purpose = event.args.purposeHash || event.args.purpose;
          
          // If we have hashes, look up the strings
          if (event.args.dataTypeHash && typeof event.args.dataTypeHash === 'string' && event.args.dataTypeHash.startsWith('0x')) {
            try {
              const lookup = await contract.dataTypeHashToString(event.args.dataTypeHash);
              if (lookup && lookup.length > 0) {
                dataType = lookup;
              }
            } catch (error) {
              console.warn('Failed to look up dataType from hash in event:', error.message);
            }
          }
          
          if (event.args.purposeHash && typeof event.args.purposeHash === 'string' && event.args.purposeHash.startsWith('0x')) {
            try {
              const lookup = await contract.purposeHashToString(event.args.purposeHash);
              if (lookup && lookup.length > 0) {
                purpose = lookup;
              }
            } catch (error) {
              console.warn('Failed to look up purpose from hash in event:', error.message);
            }
          }
          
          return {
            type: 'ConsentGranted',
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            consentId: Number(event.args.consentId),
            patient: ethers.getAddress(event.args.patient),
            provider: ethers.getAddress(event.args.provider),
            dataType: dataType,
            expirationTime: event.args.expirationTime === 0n 
              ? null 
              : new Date(Number(event.args.expirationTime) * 1000).toISOString(),
            purpose: purpose,
            timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
          };
        }))),
        ...revokedEvents.map(event => ({
          type: 'ConsentRevoked',
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          consentId: Number(event.args.consentId),
          patient: ethers.getAddress(event.args.patient),
          timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
        }))
      ];

      // Sort by block number
      events.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

      return events;
    } catch (error) {
      // Log the actual error for debugging
      console.error('Error querying consent events:', error.message, error.code, error.reason);
      throw new ContractError(
        'Failed to query consent events',
        'getConsentEvents',
        error
      );
    }
  }

  /**
   * Query access request events (AccessRequested, AccessApproved, AccessDenied)
   * 
   * @param {string} patientAddress - Optional patient address filter
   * @param {number} fromBlock - Starting block number (optional)
   * @param {number} toBlock - Ending block number (optional, default: latest)
   * @returns {Promise<Array>} Array of access request events
   * @throws {ValidationError} If address or block range is invalid
   * @throws {ContractError} If event query fails
   */
  async getAccessRequestEvents(patientAddress = null, fromBlock = null, toBlock = null) {
    // Validate address if provided
    if (patientAddress) {
      validateAddress(patientAddress, 'patientAddress');
    }

    // Validate block range (same as getConsentEvents)
    if (fromBlock !== null && toBlock !== null) {
      if (!Number.isInteger(fromBlock) || fromBlock < 0) {
        throw new ValidationError('fromBlock must be a non-negative integer', 'fromBlock', fromBlock);
      }
      if (!Number.isInteger(toBlock) || toBlock < 0) {
        throw new ValidationError('toBlock must be a non-negative integer', 'toBlock', toBlock);
      }
      if (fromBlock > toBlock) {
        throw new ValidationError('fromBlock must be <= toBlock', 'fromBlock', fromBlock);
      }
      if (toBlock - fromBlock > 10000) {
        throw new ValidationError('Block range cannot exceed 10000 blocks', 'toBlock', toBlock);
      }
    }

    try {
      const contract = await this._ensureContract();
      
      // Build filter
      const filter = {};
      if (patientAddress) {
        filter.patient = normalizeAddress(patientAddress);
      }
      if (fromBlock !== null) {
        filter.fromBlock = fromBlock;
      }
      if (toBlock !== null) {
        filter.toBlock = toBlock;
      }

      // Query all access request event types
      // Handle null/undefined for fromBlock and toBlock
      const fromBlockArg = filter.fromBlock !== null && filter.fromBlock !== undefined ? filter.fromBlock : undefined;
      const toBlockArg = filter.toBlock !== null && filter.toBlock !== undefined ? filter.toBlock : undefined;
      
      // AccessRequested event: (uint256 indexed requestId, address indexed requester, address indexed patient, ...)
      // If patient filter is provided, filter by patient (third indexed parameter), otherwise get all events
      const requestedFilter = filter.patient
        ? contract.filters.AccessRequested(null, null, filter.patient)
        : contract.filters.AccessRequested(null, null, null);
      
      let requestedEvents;
      try {
        requestedEvents = await contract.queryFilter(
          requestedFilter,
          fromBlockArg,
          toBlockArg
        );
        if (!Array.isArray(requestedEvents)) {
          requestedEvents = [];
        }
      } catch (filterError) {
        console.error('Error querying AccessRequested events:', filterError.message);
        requestedEvents = [];
      }

      // AccessApproved event: (uint256 indexed requestId, address indexed patient, ...)
      // If patient filter is provided, filter by patient (second indexed parameter), otherwise get all events
      const approvedFilter = filter.patient
        ? contract.filters.AccessApproved(null, filter.patient)
        : contract.filters.AccessApproved(null, null);
      
      let approvedEvents;
      try {
        approvedEvents = await contract.queryFilter(
          approvedFilter,
          fromBlockArg,
          toBlockArg
        );
        if (!Array.isArray(approvedEvents)) {
          approvedEvents = [];
        }
      } catch (filterError) {
        console.error('Error querying AccessApproved events:', filterError.message);
        approvedEvents = [];
      }

      // AccessDenied event: (uint256 indexed requestId, address indexed patient, ...)
      // If patient filter is provided, filter by patient (second indexed parameter), otherwise get all events
      const deniedFilter = filter.patient
        ? contract.filters.AccessDenied(null, filter.patient)
        : contract.filters.AccessDenied(null, null);
      
      let deniedEvents;
      try {
        deniedEvents = await contract.queryFilter(
          deniedFilter,
          fromBlockArg,
          toBlockArg
        );
        if (!Array.isArray(deniedEvents)) {
          deniedEvents = [];
        }
      } catch (filterError) {
        console.error('Error querying AccessDenied events:', filterError.message);
        deniedEvents = [];
      }

      // Create a map of requestId -> AccessRequested event to look up requester for approved/denied events
      const requestMap = new Map();
      requestedEvents.forEach(event => {
        const requestId = Number(event.args.requestId);
        requestMap.set(requestId, {
          requester: ethers.getAddress(event.args.requester),
          dataTypes: Array.isArray(event.args.dataTypes) ? event.args.dataTypes : [],
          purposes: Array.isArray(event.args.purposes) ? event.args.purposes : [],
          expirationTime: event.args.expirationTime === 0n 
            ? null 
            : new Date(Number(event.args.expirationTime) * 1000).toISOString(),
        });
      });

      // Transform and combine events
      const events = [
        ...requestedEvents.map(event => ({
          type: 'AccessRequested',
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          requestId: Number(event.args.requestId),
          requester: ethers.getAddress(event.args.requester),
          patient: ethers.getAddress(event.args.patient),
          dataTypes: Array.isArray(event.args.dataTypes) ? event.args.dataTypes : [],
          purposes: Array.isArray(event.args.purposes) ? event.args.purposes : [],
          expirationTime: event.args.expirationTime === 0n 
            ? null 
            : new Date(Number(event.args.expirationTime) * 1000).toISOString(),
          timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
        })),
        ...approvedEvents.map(event => {
          const requestId = Number(event.args.requestId);
          const requestInfo = requestMap.get(requestId);
          return {
            type: 'AccessApproved',
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            requestId: requestId,
            requester: requestInfo?.requester || null,
            patient: ethers.getAddress(event.args.patient),
            dataTypes: requestInfo?.dataTypes || [],
            purposes: requestInfo?.purposes || [],
            expirationTime: requestInfo?.expirationTime || null,
            timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
          };
        }),
        ...deniedEvents.map(event => {
          const requestId = Number(event.args.requestId);
          const requestInfo = requestMap.get(requestId);
          return {
            type: 'AccessDenied',
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            requestId: requestId,
            requester: requestInfo?.requester || null,
            patient: ethers.getAddress(event.args.patient),
            dataTypes: requestInfo?.dataTypes || [],
            purposes: requestInfo?.purposes || [],
            expirationTime: requestInfo?.expirationTime || null,
            timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
          };
        })
      ];

      // Sort by block number
      events.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

      return events;
    } catch (error) {
      throw new ContractError(
        'Failed to query access request events',
        'getAccessRequestEvents',
        error
      );
    }
  }

  /**
   * Query batch consent events (ConsentBatchGranted)
   * 
   * @param {string} patientAddress - Optional patient address filter
   * @param {number} fromBlock - Starting block number (optional)
   * @param {number} toBlock - Ending block number (optional, default: latest)
   * @returns {Promise<Array>} Array of batch consent events
   * @throws {ValidationError} If address or block range is invalid
   * @throws {ContractError} If event query fails
   */
  async getBatchConsentEvents(patientAddress = null, fromBlock = null, toBlock = null) {
    // Validate address if provided
    if (patientAddress) {
      validateAddress(patientAddress, 'patientAddress');
    }

    // Validate block range
    if (fromBlock !== null && toBlock !== null) {
      if (!Number.isInteger(fromBlock) || fromBlock < 0) {
        throw new ValidationError('fromBlock must be a non-negative integer', 'fromBlock', fromBlock);
      }
      if (!Number.isInteger(toBlock) || toBlock < 0) {
        throw new ValidationError('toBlock must be a non-negative integer', 'toBlock', toBlock);
      }
      if (fromBlock > toBlock) {
        throw new ValidationError('fromBlock must be <= toBlock', 'fromBlock', fromBlock);
      }
      if (toBlock - fromBlock > 10000) {
        throw new ValidationError('Block range cannot exceed 10000 blocks', 'toBlock', toBlock);
      }
    }

    try {
      const contract = await this._ensureContract();
      
      // Build filter
      const filter = {};
      if (patientAddress) {
        filter.patient = normalizeAddress(patientAddress);
      }
      if (fromBlock !== null) {
        filter.fromBlock = fromBlock;
      }
      if (toBlock !== null) {
        filter.toBlock = toBlock;
      }

      // Query ConsentBatchGranted events
      const batchEvents = await contract.queryFilter(
        contract.filters.ConsentBatchGranted(filter.patient),
        filter.fromBlock,
        filter.toBlock
      );

      // Transform events
      const events = batchEvents.map(event => ({
        type: 'ConsentBatchGranted',
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        patient: ethers.getAddress(event.args.patient),
        consentIds: Array.from(event.args.consentIds).map(id => Number(id)),
        timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
      }));

      return events;
    } catch (error) {
      throw new ContractError(
        'Failed to query batch consent events',
        'getBatchConsentEvents',
        error
      );
    }
  }

  /**
   * Grant consent to a provider (write operation)
   * 
   * @param {string} patientAddress - Ethereum address of patient (must match signer)
   * @param {string} providerAddress - Ethereum address of provider
   * @param {string} dataType - Type of data
   * @param {number} expirationTime - Unix timestamp (0 for no expiration)
   * @param {string} purpose - Purpose for data use
   * @returns {Promise<Object>} Transaction result with consentId and transaction hash
   * @throws {ValidationError} If inputs are invalid
   * @throws {ContractError} If contract call fails
   * @throws {ConfigurationError} If signer not available
   */
  async grantConsent(patientAddress, providerAddress, dataType, expirationTime, purpose) {
    // Validate inputs
    validateAddress(patientAddress, 'patientAddress');
    validateAddress(providerAddress, 'providerAddress');
    
    if (!dataType || typeof dataType !== 'string' || dataType.trim().length === 0) {
      throw new ValidationError('dataType is required and must be a non-empty string', 'dataType', dataType);
    }
    
    if (!purpose || typeof purpose !== 'string' || purpose.trim().length === 0) {
      throw new ValidationError('purpose is required and must be a non-empty string', 'purpose', purpose);
    }

    if (!Number.isInteger(expirationTime) || expirationTime < 0) {
      throw new ValidationError('expirationTime must be a non-negative integer', 'expirationTime', expirationTime);
    }

    // Normalize addresses
    const normalizedPatient = normalizeAddress(patientAddress);
    const normalizedProvider = normalizeAddress(providerAddress);

    try {
      const signedContract = await web3Service.getSignedContract();
      
      // Verify signer matches patient (for security)
      const signerAddress = await web3Service.getSignerAddress();
      if (signerAddress && normalizeAddress(signerAddress) !== normalizedPatient) {
        throw new ValidationError(
          'Signer address does not match patient address. Patient must sign their own transactions.',
          'patientAddress',
          patientAddress
        );
      }

      // Call contract with timeout
      const tx = await Promise.race([
        signedContract.grantConsent(
          normalizedProvider,
          dataType,
          expirationTime,
          purpose
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), 60000)
        )
      ]);

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      // Extract consent ID from event
      let consentId = null;
      try {
        for (const log of receipt.logs) {
          try {
            const parsed = signedContract.interface.parseLog(log);
            if (parsed && parsed.name === 'ConsentGranted') {
              consentId = Number(parsed.args.consentId);
              break;
            }
          } catch {
            continue;
          }
        }
      } catch (parseError) {
        console.warn('Could not parse ConsentGranted event:', parseError);
      }

      return {
        success: true,
        consentId: consentId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      if (error.message === 'Transaction timeout') {
        throw new Web3ConnectionError('Transaction timed out');
      }
      if (error.code === 'ACTION_REJECTED' || error.reason?.includes('user rejected')) {
        throw new ContractError('Transaction was rejected by user', 'grantConsent', error);
      }
      throw new ContractError(
        'Failed to grant consent',
        'grantConsent',
        error
      );
    }
  }

  /**
   * Revoke consent (write operation)
   * 
   * @param {string} patientAddress - Ethereum address of patient (must match signer)
   * @param {number} consentId - Consent ID to revoke
   * @returns {Promise<Object>} Transaction result with transaction hash
   * @throws {ValidationError} If inputs are invalid
   * @throws {ContractError} If contract call fails
   * @throws {NotFoundError} If consent not found
   */
  async revokeConsent(patientAddress, consentId) {
    // Validate inputs
    validateAddress(patientAddress, 'patientAddress');
    
    if (!Number.isInteger(consentId) || consentId < 0) {
      throw new InvalidIdError(consentId, 'consentId');
    }

    // Verify consent exists and belongs to patient
    const consent = await this.getConsentRecord(consentId);
    const normalizedPatient = normalizeAddress(patientAddress);
    
    if (normalizeAddress(consent.patientAddress) !== normalizedPatient) {
      throw new ValidationError(
        'Consent does not belong to this patient',
        'patientAddress',
        patientAddress
      );
    }

    try {
      const signedContract = await web3Service.getSignedContract();
      
      // Verify signer matches patient
      const signerAddress = await web3Service.getSignerAddress();
      if (signerAddress && normalizeAddress(signerAddress) !== normalizedPatient) {
        throw new ValidationError(
          'Signer address does not match patient address',
          'patientAddress',
          patientAddress
        );
      }

      // Call contract
      const tx = await Promise.race([
        signedContract.revokeConsent(consentId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), 60000)
        )
      ]);

      const receipt = await tx.wait();

      return {
        success: true,
        consentId: consentId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      if (error.message === 'Transaction timeout') {
        throw new Web3ConnectionError('Transaction timed out');
      }
      if (error.code === 'ACTION_REJECTED' || error.reason?.includes('user rejected')) {
        throw new ContractError('Transaction was rejected', 'revokeConsent', error);
      }
      throw new ContractError(
        'Failed to revoke consent',
        'revokeConsent',
        error
      );
    }
  }

  /**
   * Request access to patient data (write operation)
   * 
   * @param {string} requesterAddress - Ethereum address of requester (must match signer)
   * @param {string} patientAddress - Ethereum address of patient
   * @param {string[]} dataTypes - Array of data types requested
   * @param {string[]} purposes - Array of purposes for data use
   * @param {number} expirationTime - Unix timestamp (0 for no expiration)
   * @returns {Promise<Object>} Transaction result with requestId and transaction hash
   * @throws {ValidationError} If inputs are invalid
   * @throws {ContractError} If contract call fails
   */
  async requestAccess(requesterAddress, patientAddress, dataTypes, purposes, expirationTime) {
    // Validate inputs
    validateAddress(requesterAddress, 'requesterAddress');
    validateAddress(patientAddress, 'patientAddress');

    // Validate arrays
    if (!Array.isArray(dataTypes) || dataTypes.length === 0) {
      throw new ValidationError('dataTypes is required and must be a non-empty array', 'dataTypes', dataTypes);
    }
    
    if (!Array.isArray(purposes) || purposes.length === 0) {
      throw new ValidationError('purposes is required and must be a non-empty array', 'purposes', purposes);
    }

    // Validate all strings in arrays
    for (const dt of dataTypes) {
      if (!dt || typeof dt !== 'string' || dt.trim().length === 0) {
        throw new ValidationError('All dataTypes must be non-empty strings', 'dataTypes', dataTypes);
      }
    }
    
    for (const p of purposes) {
      if (!p || typeof p !== 'string' || p.trim().length === 0) {
        throw new ValidationError('All purposes must be non-empty strings', 'purposes', purposes);
      }
    }

    if (!Number.isInteger(expirationTime) || expirationTime < 0) {
      throw new ValidationError('expirationTime must be a non-negative integer', 'expirationTime', expirationTime);
    }

    // Normalize addresses
    const normalizedRequester = normalizeAddress(requesterAddress);
    const normalizedPatient = normalizeAddress(patientAddress);

    if (normalizedRequester === normalizedPatient) {
      throw new ValidationError('Requester cannot request access from themselves', 'patientAddress', patientAddress);
    }

    try {
      const signedContract = await web3Service.getSignedContract();
      
      // Verify signer matches requester
      const signerAddress = await web3Service.getSignerAddress();
      if (signerAddress && normalizeAddress(signerAddress) !== normalizedRequester) {
        throw new ValidationError(
          'Signer address does not match requester address',
          'requesterAddress',
          requesterAddress
        );
      }

      // Call batch function
      const tx = await Promise.race([
        signedContract.requestAccess(
          normalizedPatient,
          dataTypes,
          purposes,
          expirationTime
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), 60000)
        )
      ]);

      const receipt = await tx.wait();

      // Extract request ID from event
      let requestId = null;
      try {
        for (const log of receipt.logs) {
          try {
            const parsed = signedContract.interface.parseLog(log);
            if (parsed && parsed.name === 'AccessRequested') {
              requestId = Number(parsed.args.requestId);
              break;
            }
          } catch {
            continue;
          }
        }
      } catch (parseError) {
        console.warn('Could not parse AccessRequested event:', parseError);
      }

      return {
        success: true,
        requestId: requestId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      if (error.message === 'Transaction timeout') {
        throw new Web3ConnectionError('Transaction timed out');
      }
      if (error.code === 'ACTION_REJECTED' || error.reason?.includes('user rejected')) {
        throw new ContractError('Transaction was rejected', 'requestAccess', error);
      }
      throw new ContractError(
        'Failed to request access',
        'requestAccess',
        error
      );
    }
  }

  /**
   * Respond to access request - approve or deny (write operation)
   * 
   * @param {string} patientAddress - Ethereum address of patient (must match signer)
   * @param {number} requestId - Request ID to respond to
   * @param {boolean} approved - True to approve, false to deny
   * @returns {Promise<Object>} Transaction result with transaction hash
   * @throws {ValidationError} If inputs are invalid
   * @throws {ContractError} If contract call fails
   * @throws {NotFoundError} If request not found
   */
  async respondToAccessRequest(patientAddress, requestId, approved) {
    // Validate inputs
    validateAddress(patientAddress, 'patientAddress');
    
    if (!Number.isInteger(requestId) || requestId < 0) {
      throw new InvalidIdError(requestId, 'requestId');
    }

    if (typeof approved !== 'boolean') {
      throw new ValidationError('approved must be a boolean', 'approved', approved);
    }

    // Verify request exists and belongs to patient
    const request = await this.getAccessRequest(requestId);
    const normalizedPatient = normalizeAddress(patientAddress);
    
    if (normalizeAddress(request.patientAddress) !== normalizedPatient) {
      throw new ValidationError(
        'Request does not belong to this patient',
        'patientAddress',
        patientAddress
      );
    }

    try {
      const signedContract = await web3Service.getSignedContract();
      
      // Verify signer matches patient
      const signerAddress = await web3Service.getSignerAddress();
      if (signerAddress && normalizeAddress(signerAddress) !== normalizedPatient) {
        throw new ValidationError(
          'Signer address does not match patient address',
          'patientAddress',
          patientAddress
        );
      }

      // Call contract
      const tx = await Promise.race([
        signedContract.respondToAccessRequest(requestId, approved),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), 60000)
        )
      ]);

      const receipt = await tx.wait();

      return {
        success: true,
        requestId: requestId,
        approved: approved,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      if (error.message === 'Transaction timeout') {
        throw new Web3ConnectionError('Transaction timed out');
      }
      if (error.code === 'ACTION_REJECTED' || error.reason?.includes('user rejected')) {
        throw new ContractError('Transaction was rejected', 'respondToAccessRequest', error);
      }
      throw new ContractError(
        'Failed to respond to access request',
        'respondToAccessRequest',
        error
      );
    }
  }
}

// Export singleton instance
const consentService = new ConsentService();
module.exports = consentService;

