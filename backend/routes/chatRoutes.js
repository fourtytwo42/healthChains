/**
 * Chat Routes - AI Chat API endpoints
 * 
 * Handles chat messages with Groq AI integration
 */

const express = require('express');
const chatRouter = express.Router();
const { authenticate } = require('../middleware/auth');
const { requirePatientOrProvider, getUserRole } = require('../middleware/authorization');
const groqService = require('../services/groqService');
const logger = require('../utils/logger');
const { normalizeAddress } = require('../utils/addressUtils');

// We'll access lookup maps through req.app.locals or use the middleware approach
// For now, we'll use the getUserRole and direct lookups from mock data
const mockPatients = require('../data/mockup-patients');
const mockProviders = require('../data/mockup-providers');

/**
 * POST /api/chat/message
 * Send a chat message and receive streaming AI response
 * 
 * Body:
 * - message: string (required) - User's message
 * - conversationHistory: array (optional) - Previous messages in conversation
 * 
 * Returns: Streaming response (Server-Sent Events)
 */
chatRouter.post('/message', authenticate, requirePatientOrProvider, async (req, res, next) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const userAddress = req.user?.address;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Message is required and must be a non-empty string',
        },
      });
    }

    if (!userAddress) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'User address not found in authentication',
        },
      });
    }

    // Get user role and name
    const role = await getUserRole(userAddress);
    const normalizedAddress = normalizeAddress(userAddress);

    // Find user in patients or providers
    let userName = 'User';
    let userRole = 'user';

    // Try to get from req.app.locals first (if available)
    const patientByAddress = req.app.locals?.patientByAddress;
    const providerByAddress = req.app.locals?.providerByAddress;

    if (role?.role === 'provider' || role?.role === 'both') {
      let provider = null;
      if (providerByAddress) {
        provider = providerByAddress.get(normalizedAddress);
      } else {
        // Fallback to array search
        provider = mockProviders.mockProviders.providers.find(
          p => p.blockchainIntegration?.walletAddress?.toLowerCase() === normalizedAddress
        );
      }
      if (provider) {
        userName = provider.organizationName || 'Provider';
        userRole = 'provider';
      }
    }

    if (role?.role === 'patient' || (role?.role === 'both' && (!userName || userName === 'User'))) {
      let patient = null;
      if (patientByAddress) {
        patient = patientByAddress.get(normalizedAddress);
      } else {
        // Fallback to array search
        patient = mockPatients.mockPatients.patients.find(
          p => p.blockchainIntegration?.walletAddress?.toLowerCase() === normalizedAddress
        );
      }
      if (patient && patient.demographics) {
        const firstName = patient.demographics.firstName || '';
        const lastName = patient.demographics.lastName || '';
        userName = `${firstName} ${lastName}`.trim() || 'Patient';
        userRole = 'patient';
      }
    }

    // Build system message
    const systemMessage = `You are Fred, an AI assistant for HealthChains. Your purpose is to provide patient information and help with requesting consent. You are currently helping ${userName}, who is a ${userRole}.`;

    // Build messages array: system message + conversation history + new user message
    const messages = [
      { role: 'system', content: systemMessage },
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: 'user', content: message.trim() },
    ];

    logger.info('Processing chat message', {
      userAddress: normalizedAddress,
      userName: userName,
      userRole: userRole,
      messageLength: message.length,
      historyLength: conversationHistory.length,
    });

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Stream chat completion
    try {
      logger.info('Calling Groq API for chat completion');
      const stream = await groqService.streamChatCompletion(messages, {
        max_tokens: groqService.MAX_OUTPUT_TOKENS,
        temperature: 0.7,
      });
      logger.info('Groq API stream received, starting to parse');

      let chunkCount = 0;
      let totalContentLength = 0;
      // Parse and forward stream chunks
      await groqService.parseStream(stream, (chunk) => {
        chunkCount++;
        totalContentLength += chunk.length;
        logger.info(`Received chunk ${chunkCount} from Groq: "${chunk.substring(0, 100)}" (total length: ${totalContentLength})`);
        // Send chunk as SSE - ensure proper formatting
        const sseData = `data: ${JSON.stringify({ content: chunk })}\n\n`;
        logger.info(`Writing SSE chunk ${chunkCount} to response (${sseData.length} bytes)`);
        try {
          if (!res.writableEnded && !res.destroyed) {
            const written = res.write(sseData);
            logger.debug(`Chunk ${chunkCount} written: ${written}, writableEnded: ${res.writableEnded}`);
          } else {
            logger.warn(`Response ended/destroyed, cannot send chunk ${chunkCount}`);
          }
        } catch (writeError) {
          logger.error(`Error writing chunk ${chunkCount}:`, writeError);
        }
      });

      logger.info(`Stream completed. Total chunks: ${chunkCount}, Total content length: ${totalContentLength}`);
      // Send completion marker
      if (!res.writableEnded && !res.destroyed) {
        logger.info('Sending [DONE] marker and ending response');
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        logger.warn('Response already ended/destroyed, cannot send [DONE]');
      }
    } catch (streamError) {
      logger.error('Error streaming chat response', {
        error: streamError.message,
        stack: streamError.stack,
      });
      
      // Send error as SSE
      res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
      res.end();
    }
  } catch (error) {
    logger.error('Error in chat message endpoint', {
      error: error.message,
      stack: error.stack,
    });
    next(error);
  }
});

module.exports = chatRouter;

