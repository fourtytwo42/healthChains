/**
 * Custom error classes for backend error handling
 * 
 * Provides structured error types with consistent codes and status codes
 * for proper error mapping and client responses.
 */

/**
 * Base error class for all custom errors
 * @class BaseError
 */
class BaseError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON format for API responses
   * @returns {Object} Error object with code, message, and optional details
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details })
    };
  }
}

/**
 * Validation error for invalid input parameters
 * @class ValidationError
 */
class ValidationError extends BaseError {
  constructor(message, field = null, value = null) {
    super(message, 'INVALID_INPUT', 400);
    this.field = field;
    this.value = value;
    this.details = field ? { field, value } : undefined;
  }
}

/**
 * Error for invalid Ethereum addresses
 * @class InvalidAddressError
 */
class InvalidAddressError extends ValidationError {
  constructor(address, field = 'address') {
    super(
      `Invalid Ethereum address format: ${address}`,
      field,
      address
    );
    this.code = 'INVALID_ADDRESS';
  }
}

/**
 * Error for invalid numeric IDs (consent IDs, request IDs)
 * @class InvalidIdError
 */
class InvalidIdError extends ValidationError {
  constructor(id, field = 'id') {
    super(
      `Invalid ID: must be a non-negative integer`,
      field,
      id
    );
    this.code = 'INVALID_ID';
  }
}

/**
 * Error for Web3/RPC connection failures
 * @class Web3ConnectionError
 */
class Web3ConnectionError extends BaseError {
  constructor(message, originalError = null) {
    super(message, 'RPC_CONNECTION_FAILED', 503);
    this.originalError = originalError;
  }
}

/**
 * Error for contract interaction failures
 * @class ContractError
 */
class ContractError extends BaseError {
  constructor(message, method = null, originalError = null) {
    super(message, 'CONTRACT_ERROR', 500);
    this.method = method;
    this.originalError = originalError;
  }
}

/**
 * Error for resource not found (consent, request, etc.)
 * @class NotFoundError
 */
class NotFoundError extends BaseError {
  constructor(resourceType, identifier) {
    super(
      `${resourceType} with ID ${identifier} not found`,
      'NOT_FOUND',
      404
    );
    this.resourceType = resourceType;
    this.identifier = identifier;
  }
}

/**
 * Error for configuration issues
 * @class ConfigurationError
 */
class ConfigurationError extends BaseError {
  constructor(message) {
    super(message, 'CONFIGURATION_ERROR', 500);
  }
}

module.exports = {
  BaseError,
  ValidationError,
  InvalidAddressError,
  InvalidIdError,
  Web3ConnectionError,
  ContractError,
  NotFoundError,
  ConfigurationError
};

