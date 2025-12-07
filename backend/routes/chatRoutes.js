/**
 * Chat Routes - AI Chat API endpoints
 * 
 * Handles chat messages with Groq AI integration
 */

const express = require('express');
const chatRouter = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireProvider, getUserRole } = require('../middleware/authorization');
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
chatRouter.post('/message', authenticate, requireProvider, async (req, res, next) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    
    // Log the raw conversation history to see what we're receiving
    logger.info('Received chat message request', {
      messageLength: message?.length || 0,
      historyLength: conversationHistory.length,
      historyWithToolCalls: conversationHistory.filter(m => m.tool_calls && m.tool_calls.length > 0).length,
      rawHistory: JSON.stringify(conversationHistory.map(m => ({
        role: m.role,
        hasContent: !!m.content,
        contentLength: m.content?.length || 0,
        hasToolCalls: !!(m.tool_calls && m.tool_calls.length > 0),
        toolCallsCount: m.tool_calls?.length || 0,
        toolCalls: m.tool_calls ? m.tool_calls.map(tc => ({
          hasId: !!tc.id,
          hasType: !!tc.type,
          hasFunction: !!tc.function,
          hasFunctionName: !!(tc.function && tc.function.name),
          functionName: tc.function?.name || 'MISSING',
        })) : [],
        hasToolCallId: !!m.tool_call_id,
      })), null, 2),
    });
    const userAddress = req.user?.address;

    // Allow empty message if we have tool results in conversation history
    const hasToolResults = conversationHistory.some(
      (msg) => msg.role === 'tool' || (msg.tool_calls && msg.tool_calls.length > 0)
    );

    if (!hasToolResults && (!message || typeof message !== 'string' || message.trim() === '')) {
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

    // Only providers can use chat with tools
    // The requireProvider middleware already checks this, but we verify the role here too
    if (role?.role !== 'provider' && role?.role !== 'both') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Chat is only available for providers',
        },
      });
    }

    // Import tool schemas (defined in frontend, but we need them here for the API)
    // For now, we'll define them inline - in production, these should be shared
    const tools = [
      {
        type: 'function',
        function: {
          name: 'get_patients',
          description: 'Get a paginated list of all patients. Use this to see available patients.',
          parameters: {
            type: 'object',
            properties: {
              page: { type: 'number', description: 'Page number (default: 1)' },
              limit: { type: 'number', description: 'Number of items per page (default: 10, max: 100)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'search_patients',
          description: 'Search for patients by name, patient ID, or wallet address. Returns matching patients with their patientId. Use this first when the user asks about a specific patient by name, then use get_patient_data with the patientId from the results.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query - can be patient name, patient ID (e.g., PAT-000001), or wallet address' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_pending_requests',
          description: 'Get pending consent requests that are waiting for patient approval. Shows requests you have sent.',
          parameters: {
            type: 'object',
            properties: {
              page: { type: 'number', description: 'Page number (default: 1)' },
              limit: { type: 'number', description: 'Number of items per page (default: 10)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_granted_consents',
          description: 'Get list of patients who have granted consent to you. Shows active consents.',
          parameters: {
            type: 'object',
            properties: {
              page: { type: 'number', description: 'Page number (default: 1)' },
              limit: { type: 'number', description: 'Number of items per page (default: 10)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_consent_history',
          description: 'Get complete consent history including all requests, approvals, denials, and revocations. Shows full timeline.',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_patient_data',
          description: 'Get detailed patient data including demographics, vital signs, medical records, medications, labs, imaging, and more. Only returns data the patient has consented to share. Requires patientId (e.g., PAT-000001). If you only have a patient name, first use search_patients to get the patientId, then call this tool.',
          parameters: {
            type: 'object',
            properties: {
              patientId: { type: 'string', description: 'Patient ID (e.g., PAT-000001). Get this from search_patients if you only have a name.' },
            },
            required: ['patientId'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'request_consent',
          description: 'Request consent from a patient to access their data. This will trigger a MetaMask transaction that the patient must approve.',
          parameters: {
            type: 'object',
            properties: {
              patientAddress: { type: 'string', description: 'Patient wallet address (0x...)' },
              dataTypes: { type: 'array', items: { type: 'string' }, description: 'Array of data types to request (e.g., ["medical_records", "vital_signs"])' },
              purposes: { type: 'array', items: { type: 'string' }, description: 'Array of purposes for the request (e.g., ["treatment", "research"])' },
              expirationTime: { type: 'number', description: 'Optional expiration timestamp in seconds (Unix timestamp). Use 0 for no expiration.' },
            },
            required: ['patientAddress', 'dataTypes', 'purposes'],
          },
        },
      },
    ];

    // Build system message with clear guidance on tool usage
    const systemMessage = `You are Fred, an AI assistant helping ${userName}, a healthcare provider.

IMPORTANT - You can make MULTIPLE tool calls in a single response. Chain them together when needed.

Common workflows:
- User asks for a patient's data by name: Call search_patients first, then immediately call get_patient_data with the patientId from the search results.
- User asks for specific data (vitals, labs, etc.): Search for the patient, then get their data, then extract and format the specific information requested.
- Always use the actual data from tool results in your response. Format it clearly with tables when showing multiple records.

When you receive tool results, immediately use that data to answer the user's question. Be specific and helpful.`;

    // Build messages array: system message + conversation history + new user message
    // Format tool_calls properly for Groq API
    // NOTE: We include tool_calls in assistant messages for context, but Groq may have issues with them
    // If errors persist, we may need to strip tool_calls from conversation history
    const messages = [
      { role: 'system', content: systemMessage },
      ...conversationHistory.map((msg, msgIdx) => {
        const formattedMsg = {
          role: msg.role,
          content: msg.content || '',
        };
        
        // Include tool calls if present (for assistant messages)
        // Only include if they're properly formatted
        if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
          // Log what we received for debugging
          logger.debug(`Processing ${msg.tool_calls.length} tool_calls for message ${msgIdx}`, {
            rawToolCalls: JSON.stringify(msg.tool_calls),
          });
          
          // Ensure tool_calls are properly formatted and filter out incomplete ones
          const formattedToolCalls = msg.tool_calls
            .filter((tc) => {
              // Strict validation: must have id, type, function, and function.name
              const hasId = tc && tc.id && typeof tc.id === 'string' && tc.id.trim() !== '';
              const hasType = tc && (tc.type === 'function' || tc.type === undefined); // Allow undefined, we'll default it
              const hasFunction = tc && tc.function && typeof tc.function === 'object';
              const hasName = hasFunction && tc.function.name && typeof tc.function.name === 'string' && tc.function.name.trim() !== '';
              
              const isValid = hasId && hasType && hasFunction && hasName;
              
              if (!isValid) {
                logger.warn('Filtering out invalid tool_call:', {
                  hasId,
                  hasType,
                  hasFunction,
                  hasName,
                  toolCall: JSON.stringify(tc),
                });
              }
              return isValid;
            })
            .map((tc) => {
              // Ensure all required fields are present with defaults
              const formatted = {
                id: (tc.id || '').trim(),
                type: (tc.type || 'function'), // Always default to 'function'
                function: {
                  name: (tc.function?.name || '').trim(),
                  arguments: (tc.function?.arguments || '').toString(),
                },
              };
              
              // Final validation - these should never be empty after formatting
              if (!formatted.id || !formatted.function.name || formatted.function.name === '') {
                logger.error('Formatted tool_call still invalid after processing:', JSON.stringify(formatted));
                return null;
              }
              
              return formatted;
            })
            .filter(tc => tc !== null); // Remove any null entries
          
          // Only add tool_calls if we have valid ones
          // IMPORTANT: Include tool_calls when followed by tool messages (required by Groq API format)
          // Groq expects: assistant message with tool_calls, then tool messages with tool_call_id
          if (formattedToolCalls.length > 0) {
            // Check if there are tool messages following this assistant message
            const hasFollowingToolMessages = msgIdx < conversationHistory.length - 1 && 
              conversationHistory.slice(msgIdx + 1).some(m => m.role === 'tool');
            
            if (hasFollowingToolMessages) {
              // Include tool_calls when followed by tool messages (required by Groq)
              formattedMsg.tool_calls = formattedToolCalls;
              logger.debug(`Including ${formattedToolCalls.length} tool_calls for message ${msgIdx} (followed by tool messages)`, {
                toolCallNames: formattedToolCalls.map(tc => tc.function.name),
              });
            } else {
              // Don't include tool_calls if not followed by tool messages (to avoid Groq errors)
              logger.debug(`Skipping ${formattedToolCalls.length} tool_calls for message ${msgIdx} (not followed by tool messages)`, {
                toolCallNames: formattedToolCalls.map(tc => tc.function.name),
              });
            }
          } else {
            logger.warn('All tool_calls were filtered out for message:', {
              role: msg.role,
              messageIndex: msgIdx,
              originalCount: msg.tool_calls.length,
              originalToolCalls: JSON.stringify(msg.tool_calls),
            });
          }
        }
        
        // Include tool_call_id if present (for tool messages)
        if (msg.tool_call_id) {
          formattedMsg.tool_call_id = msg.tool_call_id;
        }
        
        return formattedMsg;
      }),
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

    // Stream chat completion with tools
    try {
      // Log the messages being sent for debugging
      logger.info('Calling Groq API for chat completion with tools', {
        messageCount: messages.length,
        hasToolCalls: messages.some(m => m.tool_calls),
        toolCallsCount: messages.reduce((sum, m) => sum + (m.tool_calls?.length || 0), 0),
        toolsCount: tools.length,
      });
      
      // Log each message to see what we're sending
      messages.forEach((msg, idx) => {
        if (msg.tool_calls) {
          logger.info(`Message ${idx} has tool_calls:`, {
            role: msg.role,
            toolCallsCount: msg.tool_calls.length,
            toolCallNames: msg.tool_calls.map(tc => tc.function?.name).filter(Boolean),
            allToolCalls: JSON.stringify(msg.tool_calls.map(tc => ({
              id: tc.id,
              type: tc.type,
              functionName: tc.function?.name,
              hasName: !!tc.function?.name,
            }))),
          });
          
          // Validate that all tool_calls reference valid tools
          const invalidToolCalls = msg.tool_calls.filter(tc => {
            const toolName = tc.function?.name;
            if (!toolName || toolName.trim() === '') return true;
            const toolExists = tools.some(t => t.function.name === toolName);
            if (!toolExists) {
              logger.error(`Tool call references non-existent tool: ${toolName}`);
            }
            return !toolExists;
          });
          
          if (invalidToolCalls.length > 0) {
            logger.error(`Message ${idx} has tool_calls referencing invalid tools:`, JSON.stringify(invalidToolCalls));
          }
        }
      });
      
      // Validate tools before sending
      const invalidTools = tools.filter(t => !t.function || !t.function.name || t.function.name.trim() === '');
      if (invalidTools.length > 0) {
        logger.error('Invalid tools found in request:', JSON.stringify(invalidTools));
        throw new Error(`Found ${invalidTools.length} tool(s) without valid names`);
      }
      
      logger.info('All tools validated, sending to Groq:', {
        toolCount: tools.length,
        toolNames: tools.map(t => t.function.name),
      });
      
      // Final validation: Ensure all tool_calls in messages reference valid tools
      // BUT: tool_calls in conversation history don't need to reference tools in the current request
      // They're just historical context. However, they must still have valid structure.
      const messagesWithToolCalls = messages.filter(m => m.tool_calls && m.tool_calls.length > 0);
      for (const msg of messagesWithToolCalls) {
        for (const tc of msg.tool_calls) {
          const toolName = tc.function?.name;
          if (!toolName || toolName.trim() === '') {
            logger.error('Found tool_call without name in final validation:', JSON.stringify(tc));
            logger.error('Message containing invalid tool_call:', JSON.stringify(msg, null, 2));
            // Remove the invalid tool_call instead of throwing
            msg.tool_calls = msg.tool_calls.filter(t => t.function?.name && t.function.name.trim() !== '');
            if (msg.tool_calls.length === 0) {
              delete msg.tool_calls;
            }
            logger.warn('Removed invalid tool_call from message, continuing...');
          }
        }
        // If all tool_calls were removed, delete the tool_calls property
        if (msg.tool_calls && msg.tool_calls.length === 0) {
          delete msg.tool_calls;
        }
      }
      
      // Log the full request structure for debugging (truncate long content)
      const debugMessages = messages.map((msg, idx) => {
        const debugMsg = { ...msg };
        if (debugMsg.content && debugMsg.content.length > 100) {
          debugMsg.content = debugMsg.content.substring(0, 100) + '...';
        }
        if (debugMsg.tool_calls) {
          debugMsg.tool_calls = debugMsg.tool_calls.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              argumentsLength: tc.function.arguments?.length || 0,
            },
          }));
        }
        return debugMsg;
      });
      logger.info('Full request structure being sent to Groq:', JSON.stringify(debugMessages, null, 2));
      
      const stream = await groqService.streamChatCompletion(messages, {
        max_tokens: groqService.MAX_OUTPUT_TOKENS,
        temperature: 0.7,
        tools: tools,
        tool_choice: 'auto',
      });
      logger.info('Groq API stream received, starting to parse');

      let chunkCount = 0;
      let totalContentLength = 0;
      let toolCallsAccumulated = [];
      
      // Parse and forward stream chunks (both content and tool calls)
      await groqService.parseStream(
        stream,
        (chunk) => {
          // Content chunk
          chunkCount++;
          totalContentLength += chunk.length;
          logger.info(`[Content] Chunk ${chunkCount} from Groq: "${chunk.substring(0, 100)}" (total length: ${totalContentLength})`);
          // Send chunk as SSE - ensure proper formatting
          const sseData = `data: ${JSON.stringify({ content: chunk })}\n\n`;
          logger.info(`Writing SSE content chunk ${chunkCount} to response (${sseData.length} bytes)`);
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
        },
        (toolCalls) => {
          // Tool calls chunk
          logger.info(`[Tool Calls] Received ${toolCalls.length} tool call(s):`, JSON.stringify(toolCalls, null, 2));
          toolCallsAccumulated = toolCalls;
          // Send tool calls as SSE
          const sseData = `data: ${JSON.stringify({ tool_calls: toolCalls })}\n\n`;
          logger.info(`Writing SSE tool calls to response (${sseData.length} bytes)`);
          try {
            if (!res.writableEnded && !res.destroyed) {
              res.write(sseData);
            } else {
              logger.warn('Response ended/destroyed, cannot send tool calls');
            }
          } catch (writeError) {
            logger.error('Error writing tool calls:', writeError);
          }
        }
      );

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

