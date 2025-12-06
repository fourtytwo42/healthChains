const web3Service = require('./web3Service');
const cacheService = require('./cacheService');
const eventIndexer = require('./eventIndexer');
const logger = require('../utils/logger');
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
  /**
   * Get consent status using event-based lookup (replaces hasActiveConsent contract call)
   * 
   * @param {string} patientAddress - Ethereum address of patient
   * @param {string} providerAddress - Ethereum address of provider
   * @param {string} dataType - Type of data to check
   * @returns {Promise<Object>} Object with hasConsent, consentId, isExpired, expirationTime
   * @throws {ValidationError} If inputs are invalid
   * @throws {ContractError} If event query fails
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

    // Check cache first
    const cacheKey = `consent:status:${normalizedPatient}:${normalizedProvider}:${dataType}`;
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      // Use event-based lookup instead of contract call
      // Get all consent events for this patient
      const events = await this.getConsentEvents(normalizedPatient);
      
      // Current timestamp for expiration checking
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      // Find the most recent active consent matching provider and dataType
      // Process events in reverse chronological order (most recent first)
      const sortedEvents = events.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });
      
      // Track revoked/expired consent IDs
      const revokedConsentIds = new Set();
      const expiredConsentIds = new Set();
      
      // First pass: collect revoked and expired consent IDs
      for (const event of sortedEvents) {
        if (event.type === 'ConsentRevoked' || event.type === 'ConsentExpired') {
          revokedConsentIds.add(event.consentId);
        }
      }
      
      // Second pass: find the most recent active consent
      let activeConsent = null;
      
      for (const event of sortedEvents) {
        if (event.type !== 'ConsentGranted') continue;
        
        const consentId = event.consentId;
        
        // Skip if this consent was revoked
        if (revokedConsentIds.has(consentId)) continue;
        
        // Check if provider matches
        if (event.provider?.toLowerCase() !== normalizedProvider.toLowerCase()) continue;
        
        // Check if dataType matches (handle both single and batch consents)
        const eventDataTypes = event.dataTypes || (event.dataType ? [event.dataType] : []);
        if (!eventDataTypes.includes(dataType)) continue;
        
        // Check expiration
        let isExpired = false;
        if (event.expirationTime) {
          const expirationTimestamp = Math.floor(new Date(event.expirationTime).getTime() / 1000);
          isExpired = expirationTimestamp > 0 && expirationTimestamp < currentTimestamp;
        }
        
        // If expired, skip it
        if (isExpired) {
          expiredConsentIds.add(consentId);
          continue;
        }
        
        // Found an active consent!
        activeConsent = {
          consentId: consentId,
          expirationTime: event.expirationTime,
          isExpired: false
        };
        break; // Use most recent active consent
      }
      
      // Return result
      let result;
      if (activeConsent) {
        result = {
          hasConsent: true,
          consentId: activeConsent.consentId,
          isExpired: false,
          expirationTime: activeConsent.expirationTime
        };
      } else {
        result = {
          hasConsent: false,
          consentId: null,
          isExpired: false,
          expirationTime: null
        };
      }

      // Cache result (5-10 minutes TTL)
      const ttl = 7 * 60; // 7 minutes (middle of 5-10 range)
      await cacheService.set(cacheKey, result, ttl);

      return result;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ContractError) {
        throw error;
      }
      throw new ContractError(
        'Failed to check consent status using events',
        'getConsentStatus',
        error
      );
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

    // Check cache first
    const cacheKey = `consent:record:${consentId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const contract = await this._ensureContract();
      
      // Fetch consent record (always returns BatchConsentRecord, with backward compatibility for old ConsentRecords)
      const contractResult = await Promise.race([
        contract.getConsentRecord(consentId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
      ]);
      
      // getConsentRecord always returns BatchConsentRecord (new format)
      const batchRecord = contractResult;
      
      // Look up strings from hashes for all data types and purposes
      const dataTypes = await Promise.all(
        batchRecord.dataTypeHashes.map(async (hash) => {
          try {
            return await contract.dataTypeHashToString(hash);
          } catch (error) {
            logger.warn('Failed to look up dataType from hash', { hash, error: error.message });
            return hash; // Fallback to hash as string
          }
        })
      );
      
      const purposes = await Promise.all(
        batchRecord.purposeHashes.map(async (hash) => {
          try {
            return await contract.purposeHashToString(hash);
          } catch (error) {
            logger.warn('Failed to look up purpose from hash', { hash, error: error.message });
            return hash; // Fallback to hash as string
          }
        })
      );
      
      const result = {
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

      // Cache result (1-2 minutes TTL)
      const ttl = 90; // 90 seconds (middle of 1-2 min range)
      await cacheService.set(cacheKey, result, ttl);

      return result;
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

    // Check cache first
    const cacheKey = `consent:patient:${normalizedAddress}:${includeExpired}`;
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

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

      // Use shorter TTL for patient consents (they can change when requests are approved)
      const ttl = 15; // 15 seconds - consents can be added quickly when requests are approved
      await cacheService.set(cacheKey, filtered, ttl);

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

    // Check cache first
    const cacheKey = `consent:provider:${normalizedAddress}:${includeExpired}`;
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const contract = await this._ensureContract();
      
      // Query both ConsentGranted and AccessApproved events
      // AccessApproved events are emitted when requests are approved and contain consentIds
      const consentFilter = contract.filters.ConsentGranted(null);
      const accessApprovedFilter = contract.filters.AccessApproved(null, null);
      
      // Query from deployment block to latest
      const fromBlock = 0; // Start from contract deployment
      const toBlock = 'latest';
      
      // Query both event types
      const [consentEvents, accessApprovedEvents] = await Promise.all([
        contract.queryFilter(consentFilter, fromBlock, toBlock),
        contract.queryFilter(accessApprovedFilter, fromBlock, toBlock)
      ]);
      
      // Optimization: Collect all unique consentIds first to avoid redundant fetches
      const consentIdSet = new Set();
      
      // Collect consentIds from ConsentGranted events
      for (const event of consentEvents) {
        const consentIds = event.args.consentIds || [];
        for (const consentIdBigInt of consentIds) {
          consentIdSet.add(Number(consentIdBigInt));
        }
      }
      
      // Collect consentIds from AccessApproved events
      for (const event of accessApprovedEvents) {
        const consentIds = event.args.consentIds || [];
        for (const consentIdBigInt of consentIds) {
          consentIdSet.add(Number(consentIdBigInt));
        }
      }
      
      // Batch fetch all consent records at once (getConsentRecord uses cache, so this is efficient)
      const consentRecords = await Promise.all(
        Array.from(consentIdSet).map(async (consentId) => {
          try {
            return await this.getConsentRecord(consentId);
          } catch (error) {
            // Consent might have been revoked or doesn't exist
            return null;
          }
        })
      );
      
      // Filter by provider address and remove nulls
      const providerConsents = consentRecords
        .filter(record => record !== null)
        .filter(record => normalizeAddress(record.providerAddress) === normalizedAddress);
      
      // Remove duplicates (shouldn't happen with Set, but safety check)
      const uniqueConsents = [];
      const seenIds = new Set();
      for (const consent of providerConsents) {
        if (!seenIds.has(consent.consentId)) {
          seenIds.add(consent.consentId);
          uniqueConsents.push(consent);
        }
      }
      
      // Filter by expiration status
      let filtered;
      if (!includeExpired) {
        filtered = uniqueConsents.filter(c => c.isActive && !c.isExpired);
      } else {
        filtered = uniqueConsents;
      }

      // Use shorter TTL for provider consents (they can change when requests are approved)
      const ttl = 15; // 15 seconds - consents can be added quickly when requests are approved
      await cacheService.set(cacheKey, filtered, ttl);

      return filtered;
    } catch (error) {
      // Log the underlying error for debugging
      logger.error('Error in getProviderConsents', { error: error.message, stack: error.stack });
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
   * Check and expire consents for a patient (DEPRECATED - using event-based approach instead)
   * 
   * @deprecated This function is no longer needed. Expiration is checked client-side when reading events.
   * @param {string} patientAddress - Ethereum address of patient
   * @returns {Promise<number>} Always returns 0 (functionality moved to event-based checks)
   * @throws {ValidationError} If address is invalid
   */
  async checkAndExpireConsents(patientAddress) {
    validateAddress(patientAddress, 'patientAddress');
    // This function is deprecated - expiration is now checked client-side when reading events
    // No need to call the contract function which had unbounded loops
    logger.warn('checkAndExpireConsents is deprecated - expiration is checked client-side from events');
    return 0;
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

    // Check cache first
    const cacheKey = `request:${requestId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      return cached;
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
        // Use helper functions to get string arrays from hashes
        const dataTypes = await contract.getRequestDataTypes(requestId);
        const purposes = await contract.getRequestPurposes(requestId);

        const result = this._transformAccessRequest(request, requestId, dataTypes, purposes);
        
        // Use shorter TTL for pending requests, longer for processed ones
        let ttl;
        if (result.status === 'pending') {
          ttl = 10; // 10 seconds for pending - they can be approved/denied quickly
        } else {
          ttl = 300; // 5 minutes for approved/denied - they don't change
        }
        await cacheService.set(cacheKey, result, ttl);

        return result;
      } catch (contractError) {
        logger.warn('Contract getAccessRequest failed, using event-based fallback', { error: contractError.message });
        
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
          const result = {
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

          // Use shorter TTL for pending requests, longer for processed ones
          let ttl;
          if (status === 'pending') {
            ttl = 10; // 10 seconds for pending - they can be approved/denied quickly
          } else {
            ttl = 300; // 5 minutes for approved/denied - they don't change
          }
          await cacheService.set(cacheKey, result, ttl);

          return result;
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

    // Check cache first
    const cacheKey = `requests:patient:${normalizedAddress}:${status}`;
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      return cached;
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
        logger.warn('Contract getPatientRequests failed, using event-based fallback', { error: contractError.message });
        
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

      // Use shorter TTL for pending requests (they change frequently)
      // Longer TTL for approved/denied (they don't change once set)
      let ttl;
      if (status === 'pending') {
        ttl = 10; // 10 seconds for pending - they can be approved/denied quickly
      } else if (status === 'approved' || status === 'denied') {
        ttl = 300; // 5 minutes for approved/denied - they don't change
      } else {
        ttl = 30; // 30 seconds for 'all' - balance between freshness and performance
      }
      await cacheService.set(cacheKey, filtered, ttl);

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

    // Check cache first
    const normalizedPatient = patientAddress ? normalizeAddress(patientAddress) : 'all';
    const fromBlockStr = fromBlock !== null ? fromBlock.toString() : 'null';
    const toBlockStr = toBlock !== null ? toBlock.toString() : 'null';
    const cacheKey = `events:consent:${normalizedPatient}:${fromBlockStr}:${toBlockStr}`;
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const contract = await this._ensureContract();
      
      // Check if PostgreSQL event indexing is enabled
      const usePostgres = eventIndexer.isEventIndexingEnabled();
      let fromBlockArg = fromBlock !== null && fromBlock !== undefined ? fromBlock : undefined;
      let toBlockArg = toBlock !== null && toBlock !== undefined ? toBlock : undefined;
      
      // If PostgreSQL is enabled, query from database first, then only fetch new events from blockchain
      let historicalEvents = [];
      let lastProcessedBlock = 0;
      
      if (usePostgres) {
        // Get last processed block to know where to start querying new events
        lastProcessedBlock = await eventIndexer.getLastProcessedBlock('ConsentGranted');
        
        // Query historical events from PostgreSQL
        const dbFilters = {};
        if (patientAddress) {
          dbFilters.patientAddress = normalizeAddress(patientAddress);
        }
        if (fromBlockArg !== undefined) {
          dbFilters.fromBlock = fromBlockArg;
        }
        if (toBlockArg !== undefined && toBlockArg !== 'latest') {
          dbFilters.toBlock = toBlockArg;
        } else if (lastProcessedBlock > 0) {
          // Only get events up to last processed block from DB
          dbFilters.toBlock = lastProcessedBlock;
        }
        
        const dbEvents = await eventIndexer.queryConsentEvents(dbFilters);
        
        // Transform database events in batches to reduce memory usage (improvement #12)
        const DB_BATCH_SIZE = 100;
        for (let i = 0; i < dbEvents.length; i += DB_BATCH_SIZE) {
          const batch = dbEvents.slice(i, i + DB_BATCH_SIZE);
          const batchResults = batch.map(row => ({
            type: row.event_type,
            blockNumber: parseInt(row.block_number, 10),
            transactionHash: row.transaction_hash,
            consentId: row.consent_id,
            patient: row.patient_address,
            provider: row.provider_address,
            dataType: row.data_type,
            dataTypes: row.data_types || (row.data_type ? [row.data_type] : []),
            purpose: row.purpose,
            purposes: row.purposes || (row.purpose ? [row.purpose] : []),
            expirationTime: row.expiration_time 
              ? new Date(parseInt(row.expiration_time, 10) * 1000).toISOString()
              : null,
            timestamp: row.timestamp 
              ? new Date(parseInt(row.timestamp, 10) * 1000).toISOString()
              : null
          }));
          historicalEvents.push(...batchResults);
        }
        
        logger.debug('PostgreSQL event index active', { 
          lastProcessedBlock, 
          historicalEventsCount: historicalEvents.length,
          fromBlock: fromBlockArg, 
          toBlock: toBlockArg 
        });
      }
      
      // Determine block range for new events from blockchain
      // If PostgreSQL is enabled and we have historical events, only fetch new events
      if (fromBlockArg === undefined) {
        fromBlockArg = usePostgres && lastProcessedBlock > 0 ? lastProcessedBlock + 1 : 0;
      } else if (usePostgres && lastProcessedBlock > 0 && fromBlockArg <= lastProcessedBlock) {
        // If requested range is entirely in the past, we already have it from DB
        // Only fetch if the range extends beyond lastProcessedBlock
        fromBlockArg = lastProcessedBlock + 1;
      }
      
      if (toBlockArg === undefined) {
        toBlockArg = 'latest';
      }
      
      // If PostgreSQL is enabled and we have historical events, check if we need to query blockchain
      // Only return early if we have events in DB AND we don't need to query blockchain for new events
      if (usePostgres && historicalEvents.length > 0) {
        // Check if fromBlockArg is 'latest' (invalid) or beyond toBlockArg
        // If so, we already have all events from DB
        const shouldReturnEarly = 
          (fromBlockArg === 'latest') || 
          (typeof fromBlockArg === 'number' && typeof toBlockArg === 'number' && fromBlockArg > toBlockArg) ||
          (typeof fromBlockArg === 'number' && toBlockArg === 'latest' && fromBlockArg > lastProcessedBlock);
        
        if (shouldReturnEarly) {
          // Return historical events from DB only
          const events = historicalEvents;
          events.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));
          
          // Cache result
          const ttl = 15; // 15 seconds for event queries
          await cacheService.set(cacheKey, events, ttl);
          
          return events;
        }
      }
      
      // If PostgreSQL is enabled but has no events yet (historicalEvents.length === 0),
      // or we need to fetch new events (fromBlockArg <= lastProcessedBlock is false),
      // query from blockchain starting from the appropriate block
      logger.debug('Querying blockchain for events', {
        usePostgres,
        historicalEventsCount: historicalEvents.length,
        lastProcessedBlock,
        fromBlockArg,
        toBlockArg
      });
      // Build filter
      const filter = {};
      if (patientAddress) {
        filter.patient = normalizeAddress(patientAddress);
      }
      
      // ConsentGranted event: (address indexed patient, uint256[] consentIds, uint128 timestamp)
      // Only patient is indexed, so filter by patient if provided
      const grantedFilter = filter.patient 
        ? contract.filters.ConsentGranted(filter.patient)
        : contract.filters.ConsentGranted();
      
      let grantedEvents = [];
      let revokedEvents = [];
      
      // Query blockchain for events (always query all events for history, PostgreSQL is just for tracking)
      if (fromBlockArg !== undefined && fromBlockArg >= 0) {
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
          
          // Note: We'll store transformed events after transformation
        } catch (filterError) {
          logger.error('Error querying ConsentGranted events', { error: filterError.message, stack: filterError.stack });
          grantedEvents = [];
        }

        // ConsentRevoked event: (uint256 indexed consentId, address indexed patient, ...)
        // If patient filter is provided, filter by patient (second indexed parameter), otherwise get all events
        const revokedFilter = filter.patient
          ? contract.filters.ConsentRevoked(null, filter.patient)
          : contract.filters.ConsentRevoked();
        
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
          
          // Note: We'll store transformed events after transformation
        } catch (filterError) {
          logger.error('Error querying ConsentRevoked events', { error: filterError.message, stack: filterError.stack });
          revokedEvents = [];
        }
      }

      // Transform ConsentGranted events only
      // Note: AccessApproved events are handled by getAccessRequestEvents() to avoid duplicates
      // getConsentEvents() should only return actual ConsentGranted events (direct grants)
      const grantedEventList = [];
      
      // Process ConsentGranted events in batches to reduce memory usage (improvement #12)
      const GRANTED_BATCH_SIZE = 50;
      for (let i = 0; i < grantedEvents.length; i += GRANTED_BATCH_SIZE) {
        const batch = grantedEvents.slice(i, i + GRANTED_BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async (event) => {
          const consentIds = event.args.consentIds || [];
          const patient = ethers.getAddress(event.args.patient);
          const timestamp = new Date(Number(event.args.timestamp) * 1000).toISOString();
          const eventResults = [];
          
          // For each consentId in the array, fetch the consent record and create an event
          for (const consentIdBigInt of consentIds) {
            const consentId = Number(consentIdBigInt);
            try {
              const consentRecord = await this.getConsentRecord(consentId);
              
              // Create an event for each dataType/purpose combination
              // Since we now use BatchConsentRecord, we have arrays of dataTypes and purposes
              const dataTypes = consentRecord.dataTypes || [];
              const purposes = consentRecord.purposes || [];
              
              // Create one event per dataType (use first purpose or all purposes)
              for (const dataType of dataTypes) {
                for (const purpose of purposes) {
                  eventResults.push({
                    type: 'ConsentGranted',
                    blockNumber: event.blockNumber,
                    transactionHash: event.transactionHash,
                    logIndex: event.logIndex || 0,
                    consentId: consentId,
                    patient: patient,
                    provider: consentRecord.providerAddress,
                    dataType: dataType,
                    dataTypes: dataTypes,
                    expirationTime: consentRecord.expirationTime,
                    purpose: purpose,
                    purposes: purposes,
                    timestamp: timestamp
                  });
                }
              }
            } catch (error) {
              // If consent record doesn't exist (e.g., was revoked), skip it
              logger.warn(`Failed to fetch consent record ${consentId} for ConsentGranted event`, { consentId, error: error.message });
            }
          }
          
          return eventResults;
        }));
        
        // Flatten batch results into grantedEventList
        for (const eventResult of batchResults) {
          grantedEventList.push(...eventResult);
        }
      }
      
      // Process revoked events in batches to reduce memory usage (improvement #12)
      const revokedEventsList = [];
      const REVOKED_BATCH_SIZE = 50;
      for (let i = 0; i < revokedEvents.length; i += REVOKED_BATCH_SIZE) {
        const batch = revokedEvents.slice(i, i + REVOKED_BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async (event) => {
          const consentId = Number(event.args.consentId);
          let provider = null;
          let dataType = null;
          let dataTypes = [];
          let purpose = null;
          let purposes = [];
          let expirationTime = null;
          
          // Look up consent record to get full details
          try {
            const consentRecord = await this.getConsentRecord(consentId);
            provider = consentRecord.providerAddress;
            
            // Handle both single and batch consents
            if (consentRecord.dataTypes && Array.isArray(consentRecord.dataTypes)) {
              dataTypes = consentRecord.dataTypes;
              dataType = dataTypes[0] || null;
            } else if (consentRecord.dataType) {
              dataType = consentRecord.dataType;
              dataTypes = [consentRecord.dataType];
            }
            
            if (consentRecord.purposes && Array.isArray(consentRecord.purposes)) {
              purposes = consentRecord.purposes;
              purpose = purposes[0] || null;
            } else if (consentRecord.purpose) {
              purpose = consentRecord.purpose;
              purposes = [consentRecord.purpose];
            }
            
            expirationTime = consentRecord.expirationTime === 0 || !consentRecord.expirationTime
              ? null
              : new Date(Number(consentRecord.expirationTime) * 1000).toISOString();
          } catch (error) {
            // If consent record lookup fails (e.g., consent already deleted), 
            // we'll still return the event with minimal info
            logger.warn(`Failed to look up consent record ${consentId} for revoked event`, { consentId, error: error.message });
          }
          
          return {
            type: 'ConsentRevoked',
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            logIndex: event.logIndex || 0,
            consentId: consentId,
            patient: ethers.getAddress(event.args.patient),
            provider: provider,
            dataType: dataType,
            dataTypes: dataTypes,
            purpose: purpose,
            purposes: purposes,
            expirationTime: expirationTime,
            timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
          };
        }));
        revokedEventsList.push(...batchResults);
      }
      
      const newEvents = [
        ...grantedEventList,
        ...revokedEventsList
      ];
      
      // Store new events in PostgreSQL if enabled
      if (usePostgres && newEvents.length > 0) {
        await eventIndexer.storeConsentEvents(newEvents);
      }
      
      // Combine historical events from DB with new events from blockchain
      const events = [
        ...historicalEvents,
        ...newEvents
      ];

      // Sort by block number
      events.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));
      
      // Remove duplicates based on transaction hash and consentId (in case of overlap)
      const seen = new Set();
      const uniqueEvents = events.filter(event => {
        const key = `${event.transactionHash}-${event.consentId || event.type}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      
      // Cache result
      const ttl = 15; // 15 seconds for event queries
      await cacheService.set(cacheKey, uniqueEvents, ttl);

      return uniqueEvents;
    } catch (error) {
      // Log the actual error for debugging
      logger.error('Error querying consent events', { 
        error: error.message, 
        code: error.code, 
        reason: error.reason,
        stack: error.stack 
      });
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

    // Check cache first
    const normalizedPatient = patientAddress ? normalizeAddress(patientAddress) : 'all';
    const fromBlockStr = fromBlock !== null ? fromBlock.toString() : 'null';
    const toBlockStr = toBlock !== null ? toBlock.toString() : 'null';
    const cacheKey = `events:requests:${normalizedPatient}:${fromBlockStr}:${toBlockStr}`;
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      return cached;
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

      // Check if PostgreSQL event indexing is enabled
      const usePostgres = eventIndexer.isEventIndexingEnabled();
      let fromBlockArg = filter.fromBlock !== null && filter.fromBlock !== undefined ? filter.fromBlock : undefined;
      let toBlockArg = filter.toBlock !== null && filter.toBlock !== undefined ? filter.toBlock : undefined;
      
      // If PostgreSQL is enabled, query from database first, then only fetch new events from blockchain
      let historicalEvents = [];
      let lastProcessedBlock = 0;
      
      if (usePostgres) {
        // Get last processed block to know where to start querying new events
        lastProcessedBlock = await eventIndexer.getLastProcessedBlock('AccessRequested');
        
        // Query historical events from PostgreSQL
        const dbFilters = {};
        if (patientAddress) {
          dbFilters.patientAddress = normalizeAddress(patientAddress);
        }
        if (fromBlockArg !== undefined) {
          dbFilters.fromBlock = fromBlockArg;
        }
        if (toBlockArg !== undefined && toBlockArg !== 'latest') {
          dbFilters.toBlock = toBlockArg;
        } else if (lastProcessedBlock > 0) {
          // Only get events up to last processed block from DB
          dbFilters.toBlock = lastProcessedBlock;
        }
        
        const dbEvents = await eventIndexer.queryAccessRequestEvents(dbFilters);
        
        // Transform database events in batches to reduce memory usage (improvement #12)
        const DB_BATCH_SIZE = 100;
        for (let i = 0; i < dbEvents.length; i += DB_BATCH_SIZE) {
          const batch = dbEvents.slice(i, i + DB_BATCH_SIZE);
          const batchResults = batch.map(row => ({
            type: row.event_type,
            blockNumber: parseInt(row.block_number, 10),
            transactionHash: row.transaction_hash,
            requestId: row.request_id,
            patient: row.patient_address,
            provider: row.provider_address,
            requester: row.provider_address, // Use provider_address as requester
            dataTypes: row.data_types || [],
            purposes: row.purposes || [],
            expirationTime: row.expiration_time 
              ? new Date(parseInt(row.expiration_time, 10) * 1000).toISOString()
              : null,
            timestamp: row.timestamp 
              ? new Date(parseInt(row.timestamp, 10) * 1000).toISOString()
              : null
          }));
          historicalEvents.push(...batchResults);
        }
        
        logger.debug('PostgreSQL event index active for access requests', { 
          lastProcessedBlock, 
          historicalEventsCount: historicalEvents.length,
          fromBlock: fromBlockArg, 
          toBlock: toBlockArg 
        });
      }
      
      // Determine block range for new events from blockchain
      // If PostgreSQL is enabled and we have historical events, only fetch new events
      if (fromBlockArg === undefined) {
        fromBlockArg = usePostgres && lastProcessedBlock > 0 ? lastProcessedBlock + 1 : 0;
      } else if (usePostgres && lastProcessedBlock > 0 && fromBlockArg <= lastProcessedBlock) {
        // If requested range is entirely in the past, we already have it from DB
        // Only fetch if the range extends beyond lastProcessedBlock
        fromBlockArg = lastProcessedBlock + 1;
      }
      
      if (toBlockArg === undefined) {
        toBlockArg = 'latest';
      }
      
      // If PostgreSQL is enabled and we have historical events, check if we need to query blockchain
      // Only return early if we have events in DB AND we don't need to query blockchain for new events
      if (usePostgres && historicalEvents.length > 0) {
        // Check if fromBlockArg is 'latest' (invalid) or beyond toBlockArg
        // If so, we already have all events from DB
        const shouldReturnEarly = 
          (fromBlockArg === 'latest') || 
          (typeof fromBlockArg === 'number' && typeof toBlockArg === 'number' && fromBlockArg > toBlockArg) ||
          (typeof fromBlockArg === 'number' && toBlockArg === 'latest' && fromBlockArg > lastProcessedBlock);
        
        if (shouldReturnEarly) {
          // Return historical events from DB only
          const events = historicalEvents;
          events.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));
          
          // Cache result
          const ttl = 15; // 15 seconds for event queries
          await cacheService.set(cacheKey, events, ttl);
          
          return events;
        }
      }
      
      // If PostgreSQL is enabled but has no events yet, or we need to fetch new events,
      // query from blockchain starting from the appropriate block
      logger.debug('Querying blockchain for access request events', {
        usePostgres,
        historicalEventsCount: historicalEvents.length,
        lastProcessedBlock,
        fromBlockArg,
        toBlockArg
      });
      
      // AccessRequested event: (uint256 indexed requestId, address indexed requester, address indexed patient, ...)
      // If patient filter is provided, filter by patient (third indexed parameter), otherwise get all events
      const requestedFilter = filter.patient
        ? contract.filters.AccessRequested(null, null, filter.patient)
        : contract.filters.AccessRequested(null, null, null);
      
      let requestedEvents = [];
      let approvedEvents = [];
      let deniedEvents = [];
      
      // Query blockchain for events (always query all events for history, PostgreSQL is just for tracking)
      if (fromBlockArg !== undefined && fromBlockArg >= 0) {
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
          logger.error('Error querying AccessRequested events', { error: filterError.message, stack: filterError.stack });
          requestedEvents = [];
        }

        // AccessApproved event: (uint256 indexed requestId, address indexed patient, ...)
        // If patient filter is provided, filter by patient (second indexed parameter), otherwise get all events
        const approvedFilter = filter.patient
          ? contract.filters.AccessApproved(null, filter.patient)
          : contract.filters.AccessApproved(null, null);
        
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
          logger.error('Error querying AccessApproved events', { error: filterError.message, stack: filterError.stack });
          approvedEvents = [];
        }

        // AccessDenied event: (uint256 indexed requestId, address indexed patient, ...)
        // If patient filter is provided, filter by patient (second indexed parameter), otherwise get all events
        const deniedFilter = filter.patient
          ? contract.filters.AccessDenied(null, filter.patient)
          : contract.filters.AccessDenied(null, null);
        
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
          logger.error('Error querying AccessDenied events', { error: filterError.message, stack: filterError.stack });
          deniedEvents = [];
        }
        
        // Note: We'll store transformed events after transformation
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
      // Note: approvedEvents.map returns promises, need to await them first
      const approvedEventsTransformed = await Promise.all(
        approvedEvents.map(async (event) => {
          const requestId = Number(event.args.requestId);
          const requestInfo = requestMap.get(requestId);
          
          // New event structure includes consentIds
          const consentIds = event.args.consentIds || [];
          const consentId = consentIds.length > 0 ? Number(consentIds[0]) : null;
          
          // Fetch consent record to get provider and full details
          let provider = requestInfo?.requester || null;
          let expirationTime = requestInfo?.expirationTime || null;
          
          // If we have a consentId, fetch the consent record for accurate data
          if (consentId !== null) {
            try {
              const consentRecord = await this.getConsentRecord(consentId);
              provider = consentRecord.providerAddress;
              expirationTime = consentRecord.expirationTime === 0 || !consentRecord.expirationTime
                ? null
                : new Date(Number(consentRecord.expirationTime) * 1000).toISOString();
            } catch (error) {
              // If consent record lookup fails, use request info
              logger.warn(`Failed to fetch consent record ${consentId} for AccessApproved event`, { consentId, error: error.message });
            }
          }
          
          return {
            type: 'AccessApproved',
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            logIndex: event.logIndex || 0,
            requestId: requestId,
            consentId: consentId,
            consentIds: consentIds.map(id => Number(id)),
            requester: provider, // Use provider from consent record if available
            provider: provider,
            patient: ethers.getAddress(event.args.patient),
            dataTypes: requestInfo?.dataTypes || [],
            purposes: requestInfo?.purposes || [],
            expirationTime: expirationTime,
            timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
          };
        })
      );
      
      const newEvents = [
        ...requestedEvents.map(event => ({
          type: 'AccessRequested',
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          logIndex: event.logIndex || 0,
          requestId: Number(event.args.requestId),
          requester: ethers.getAddress(event.args.requester),
          provider: ethers.getAddress(event.args.requester), // Also set provider for storage
          patient: ethers.getAddress(event.args.patient),
          dataTypes: Array.isArray(event.args.dataTypes) ? event.args.dataTypes : [],
          purposes: Array.isArray(event.args.purposes) ? event.args.purposes : [],
          expirationTime: event.args.expirationTime === 0n 
            ? null 
            : new Date(Number(event.args.expirationTime) * 1000).toISOString(),
          timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
        })),
        ...approvedEventsTransformed,
        ...deniedEvents.map(event => {
          const requestId = Number(event.args.requestId);
          const requestInfo = requestMap.get(requestId);
          return {
            type: 'AccessDenied',
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            logIndex: event.logIndex || 0,
            requestId: requestId,
            requester: requestInfo?.requester || null,
            provider: requestInfo?.requester || null, // Also set provider for storage
            patient: ethers.getAddress(event.args.patient),
            dataTypes: requestInfo?.dataTypes || [],
            purposes: requestInfo?.purposes || [],
            expirationTime: requestInfo?.expirationTime || null,
            timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
          };
        })
      ];
      
      // Store new events in PostgreSQL if enabled
      if (usePostgres && newEvents.length > 0) {
        await eventIndexer.storeAccessRequestEvents(newEvents);
      }
      
      // Combine historical events from DB with new events from blockchain
      const events = [
        ...historicalEvents,
        ...newEvents
      ];
      
      // Remove duplicates based on transaction hash and requestId (in case of overlap)
      const seen = new Set();
      const uniqueEvents = events.filter(event => {
        const key = `${event.transactionHash}-${event.requestId || event.type}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

      // Sort by block number
      uniqueEvents.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

      // Use shorter TTL for request events (they change when requests are approved/denied)
      const ttl = 15; // 15 seconds - requests can be approved/denied quickly
      await cacheService.set(cacheKey, uniqueEvents, ttl);

      return uniqueEvents;
    } catch (error) {
      throw new ContractError(
        'Failed to query access request events',
        'getAccessRequestEvents',
        error
      );
    }
  }

  /**
   * Query consent events (ConsentGranted)
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

      // Query ConsentGranted events
      const batchEvents = await contract.queryFilter(
        contract.filters.ConsentGranted(filter.patient),
        filter.fromBlock,
        filter.toBlock
      );

      // Transform events
      const events = batchEvents.map(event => ({
        type: 'ConsentGranted',
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
        logger.warn('Could not parse ConsentGranted event', { error: parseError.message, stack: parseError.stack });
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
        logger.warn('Could not parse AccessRequested event', { error: parseError.message, stack: parseError.stack });
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

