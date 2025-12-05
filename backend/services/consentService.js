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
    if (!this.contract) {
      this.contract = await web3Service.getContract();
    }
    return this.contract;
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
   * @returns {Object} Transformed access request
   */
  _transformAccessRequest(request, requestId) {
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
      dataType: request.dataType,
      purpose: request.purpose,
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
      
      // Call contract with timeout
      const result = await Promise.race([
        contract.hasActiveConsent(normalizedPatient, normalizedProvider, dataType),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
      ]);

      const [hasConsent, consentId] = result;
      
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
      
      const record = await Promise.race([
        contract.getConsentRecord(consentId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
      ]);

      return this._transformConsentRecord(record, consentId);
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
      
      // Note: Contract doesn't have getProviderConsents, so we need to query events
      // For now, we'll return empty array and implement event-based querying
      // This is a limitation - we'd need to track this differently or use events
      return [];
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
      
      const request = await Promise.race([
        contract.getAccessRequest(requestId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
      ]);

      return this._transformAccessRequest(request, requestId);
    } catch (error) {
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
      
      const requestIds = await Promise.race([
        contract.getPatientRequests(normalizedAddress),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
      ]);

      // Fetch full records for each request ID
      const requests = await Promise.all(
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
      const grantedEvents = await contract.queryFilter(
        contract.filters.ConsentGranted(filter.patient),
        filter.fromBlock,
        filter.toBlock
      );

      // Query ConsentRevoked events
      const revokedEvents = await contract.queryFilter(
        contract.filters.ConsentRevoked(filter.patient),
        filter.fromBlock,
        filter.toBlock
      );

      // Transform and combine events
      const events = [
        ...grantedEvents.map(event => ({
          type: 'ConsentGranted',
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          consentId: Number(event.args.consentId),
          patient: ethers.getAddress(event.args.patient),
          provider: ethers.getAddress(event.args.provider),
          dataType: event.args.dataType,
          expirationTime: event.args.expirationTime === 0n 
            ? null 
            : new Date(Number(event.args.expirationTime) * 1000).toISOString(),
          purpose: event.args.purpose,
          timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
        })),
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
      const requestedEvents = await contract.queryFilter(
        contract.filters.AccessRequested(filter.patient),
        filter.fromBlock,
        filter.toBlock
      );

      const approvedEvents = await contract.queryFilter(
        contract.filters.AccessApproved(filter.patient),
        filter.fromBlock,
        filter.toBlock
      );

      const deniedEvents = await contract.queryFilter(
        contract.filters.AccessDenied(filter.patient),
        filter.fromBlock,
        filter.toBlock
      );

      // Transform and combine events
      const events = [
        ...requestedEvents.map(event => ({
          type: 'AccessRequested',
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          requestId: Number(event.args.requestId),
          requester: ethers.getAddress(event.args.requester),
          patient: ethers.getAddress(event.args.patient),
          dataType: event.args.dataType,
          purpose: event.args.purpose,
          expirationTime: event.args.expirationTime === 0n 
            ? null 
            : new Date(Number(event.args.expirationTime) * 1000).toISOString(),
          timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
        })),
        ...approvedEvents.map(event => ({
          type: 'AccessApproved',
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          requestId: Number(event.args.requestId),
          patient: ethers.getAddress(event.args.patient),
          timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
        })),
        ...deniedEvents.map(event => ({
          type: 'AccessDenied',
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          requestId: Number(event.args.requestId),
          patient: ethers.getAddress(event.args.patient),
          timestamp: new Date(Number(event.args.timestamp) * 1000).toISOString()
        }))
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
}

// Export singleton instance
const consentService = new ConsentService();
module.exports = consentService;

