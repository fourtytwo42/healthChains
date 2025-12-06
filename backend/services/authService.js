const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const { ValidationError } = require('../utils/errors');
const { normalizeAddress } = require('../utils/addressUtils');

/**
 * Authentication Service - JWT and MetaMask signature verification
 * 
 * Handles JWT token generation/verification and MetaMask signature verification.
 * 
 * @class AuthService
 */
class AuthService {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    this.expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.issuer = process.env.JWT_ISSUER || 'healthchains';
    
    if (!this.secret) {
      console.warn('⚠️  JWT_SECRET not set. Authentication will not work properly.');
      // Generate a random secret for development (not secure for production)
      this.secret = 'development-secret-change-in-production-' + Math.random().toString(36);
      console.warn('⚠️  Using temporary development secret. Set JWT_SECRET in production!');
    }
  }

  /**
   * Generate a message for the user to sign with MetaMask
   * 
   * @param {string} address - Ethereum address
   * @returns {Object} Message and timestamp
   */
  generateSignMessage(address) {
    if (!address) {
      throw new ValidationError('address is required', 'address');
    }

    const normalizedAddress = normalizeAddress(address);
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Create a simple message for signing
    // Include timestamp to prevent replay attacks
    const message = `Please sign this message to authenticate with HealthChains.\n\nAddress: ${normalizedAddress}\nTimestamp: ${timestamp}`;

    return {
      message,
      timestamp
    };
  }

  /**
   * Verify MetaMask signature
   * 
   * @param {string} address - Ethereum address that signed the message
   * @param {string} signature - Signature from MetaMask
   * @param {string} message - Original message that was signed
   * @returns {Promise<boolean>} True if signature is valid
   * @throws {ValidationError} If signature verification fails
   */
  async verifySignature(address, signature, message) {
    if (!address || !signature || !message) {
      throw new ValidationError('address, signature, and message are required', 'signature');
    }

    try {
      // Normalize address for comparison
      const normalizedAddress = normalizeAddress(address);

      // Verify signature using ethers.js
      const recoveredAddress = ethers.verifyMessage(message, signature);
      const normalizedRecovered = normalizeAddress(recoveredAddress);

      if (normalizedRecovered !== normalizedAddress) {
        throw new ValidationError(
          'Signature does not match address',
          'signature',
          { provided: normalizedAddress, recovered: normalizedRecovered }
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(
        'Invalid signature',
        'signature',
        error.message
      );
    }
  }

  /**
   * Generate JWT token for authenticated user
   * 
   * @param {string} address - Ethereum address of the user
   * @returns {string} JWT token
   * @throws {ValidationError} If address is invalid
   */
  generateToken(address) {
    if (!address) {
      throw new ValidationError('address is required', 'address');
    }

    const normalizedAddress = normalizeAddress(address);

    const payload = {
      address: normalizedAddress,
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: this.issuer
    });
  }

  /**
   * Verify JWT token
   * 
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded token payload
   * @throws {ValidationError} If token is invalid or expired
   */
  verifyToken(token) {
    if (!token) {
      throw new ValidationError('Token is required', 'token');
    }

    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: this.issuer
      });

      return {
        address: decoded.address,
        iat: decoded.iat,
        exp: decoded.exp
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new ValidationError('Token has expired', 'token', { expiredAt: error.expiredAt });
      }
      if (error.name === 'JsonWebTokenError') {
        throw new ValidationError('Invalid token', 'token', error.message);
      }
      throw new ValidationError('Token verification failed', 'token', error.message);
    }
  }

  /**
   * Authenticate user with MetaMask signature and issue JWT
   * 
   * @param {string} address - Ethereum address
   * @param {string} signature - MetaMask signature
   * @param {string} message - Message that was signed
   * @param {number} timestamp - Timestamp when message was created (optional, for replay protection)
   * @returns {Object} Token and user info
   * @throws {ValidationError} If signature is invalid
   */
  async login(address, signature, message, timestamp = null) {
    // Verify signature
    await this.verifySignature(address, signature, message);

    // Optional: Verify message timestamp to prevent replay attacks
    if (timestamp) {
      const messageTime = parseInt(timestamp, 10);
      const now = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(now - messageTime);
      
      // Reject if message is more than 5 minutes old
      if (timeDiff > 300) {
        throw new ValidationError(
          'Message timestamp is too old or too far in the future',
          'timestamp',
          { messageTime, now, diff: timeDiff }
        );
      }
    }

    // Generate JWT token
    const token = this.generateToken(address);
    const normalizedAddress = normalizeAddress(address);

    return {
      token,
      address: normalizedAddress,
      expiresIn: this.expiresIn
    };
  }

  /**
   * Extract token from Authorization header
   * 
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} Token or null if not found
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }
}

// Export singleton instance
const authService = new AuthService();
module.exports = authService;

