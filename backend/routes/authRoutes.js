const express = require('express');
const authRouter = express.Router();
const authService = require('../services/authService');
const { validateAddress } = require('../utils/addressUtils');
const { ValidationError } = require('../utils/errors');

/**
 * Authentication Routes
 * 
 * Handles user authentication via MetaMask signature verification
 */

/**
 * GET /api/auth/message
 * Get a message to sign for authentication
 * 
 * Query:
 * - address (required): Ethereum address
 * 
 * Returns:
 * - message: Message to sign with MetaMask
 * - timestamp: Timestamp when message was created
 */
authRouter.get('/message', async (req, res, next) => {
  try {
    const { address } = req.query;

    // Validate required fields
    if (!address) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'address is required',
          details: { field: 'address' }
        }
      });
    }

    // Validate address format
    try {
      validateAddress(address, 'address');
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Invalid Ethereum address format',
          details: { address }
        }
      });
    }

    // Generate message to sign
    const signMessage = authService.generateSignMessage(address);

    res.json({
      success: true,
      data: {
        message: signMessage.message,
        timestamp: signMessage.timestamp
      }
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MESSAGE_GENERATION_FAILED',
          message: error.message,
          details: error.details || {}
        }
      });
    }

    next(error);
  }
});

/**
 * POST /api/auth/login
 * Authenticate user with MetaMask signature and receive JWT token
 * 
 * Body:
 * - address (required): Ethereum address
 * - signature (required): MetaMask signature of the message
 * - message (required): Message that was signed
 * - timestamp (optional): Timestamp when message was created (for replay protection)
 * 
 * Returns:
 * - token: JWT token
 * - address: Normalized user address
 * - expiresIn: Token expiration time
 */
authRouter.post('/login', async (req, res, next) => {
  try {
    const { address, signature, message, timestamp } = req.body;

    // Validate required fields
    if (!address) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'address is required',
          details: { field: 'address' }
        }
      });
    }

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'signature is required',
          details: { field: 'signature' }
        }
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETER',
          message: 'message is required',
          details: { field: 'message' }
        }
      });
    }

    // Validate address format
    try {
      validateAddress(address, 'address');
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Invalid Ethereum address format',
          details: { address }
        }
      });
    }

    // Authenticate and get token
    const result = await authService.login(address, signature, message, timestamp);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: error.message,
          details: error.details || {}
        }
      });
    }

    next(error);
  }
});

/**
 * POST /api/auth/verify
 * Verify JWT token validity
 * 
 * Headers:
 * - Authorization: Bearer <token>
 * 
 * Returns:
 * - valid: boolean
 * - address: User address from token
 * - expiresAt: Token expiration timestamp
 */
authRouter.post('/verify', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_TOKEN',
          message: 'Token is required in Authorization header',
          details: {
            format: 'Authorization: Bearer <token>'
          }
        }
      });
    }

    const decoded = authService.verifyToken(token);

    res.json({
      success: true,
      data: {
        valid: true,
        address: decoded.address,
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      }
    });
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

    next(error);
  }
});

module.exports = authRouter;

