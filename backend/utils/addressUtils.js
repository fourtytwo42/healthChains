const { ethers } = require('ethers');
const { InvalidAddressError } = require('./errors');

/**
 * Utility functions for Ethereum address validation and normalization
 * 
 * Provides secure address validation and checksum normalization
 * following EIP-55 standard.
 */

/**
 * Validates an Ethereum address format
 * 
 * @param {string} address - Address string to validate
 * @param {string} fieldName - Field name for error messages (optional)
 * @returns {boolean} True if address is valid format
 * @throws {InvalidAddressError} If address format is invalid
 */
function validateAddress(address, fieldName = 'address') {
  if (!address || typeof address !== 'string') {
    throw new InvalidAddressError(address, fieldName);
  }

  // Basic format check: must start with 0x and be 42 characters
  if (!address.startsWith('0x') || address.length !== 42) {
    throw new InvalidAddressError(address, fieldName);
  }

  // Check if it's a valid hex string
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new InvalidAddressError(address, fieldName);
  }

  // Check for zero address
  if (address === '0x0000000000000000000000000000000000000000') {
    throw new InvalidAddressError('Zero address is not allowed', fieldName);
  }

  return true;
}

/**
 * Normalizes an address to checksum format (EIP-55)
 * 
 * @param {string} address - Address to normalize
 * @param {string} fieldName - Field name for error messages (optional)
 * @returns {string} Checksummed address
 * @throws {InvalidAddressError} If address format is invalid
 */
function normalizeAddress(address, fieldName = 'address') {
  // Validate first
  validateAddress(address, fieldName);

  try {
    // ethers.getAddress() validates and returns checksummed address
    return ethers.getAddress(address);
  } catch (error) {
    throw new InvalidAddressError(address, fieldName);
  }
}

/**
 * Validates multiple addresses
 * 
 * @param {string[]} addresses - Array of addresses to validate
 * @param {string} fieldName - Field name for error messages (optional)
 * @returns {boolean} True if all addresses are valid
 * @throws {InvalidAddressError} If any address is invalid
 */
function validateAddresses(addresses, fieldName = 'addresses') {
  if (!Array.isArray(addresses)) {
    throw new InvalidAddressError('Addresses must be an array', fieldName);
  }

  addresses.forEach((address, index) => {
    validateAddress(address, `${fieldName}[${index}]`);
  });

  return true;
}

/**
 * Normalizes multiple addresses to checksum format
 * 
 * @param {string[]} addresses - Array of addresses to normalize
 * @param {string} fieldName - Field name for error messages (optional)
 * @returns {string[]} Array of checksummed addresses
 * @throws {InvalidAddressError} If any address is invalid
 */
function normalizeAddresses(addresses, fieldName = 'addresses') {
  validateAddresses(addresses, fieldName);
  return addresses.map(addr => normalizeAddress(addr, fieldName));
}

module.exports = {
  validateAddress,
  normalizeAddress,
  validateAddresses,
  normalizeAddresses
};

