/**
 * Groq Service - Handles Groq API interactions for AI chat
 * 
 * Provides streaming chat completion functionality using Groq's OpenAI-compatible API
 */

const logger = require('../utils/logger');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

// Model context limits
const MAX_INPUT_TOKENS = 131072;  // Maximum context window
const MAX_OUTPUT_TOKENS = 65536;   // Maximum output tokens

/**
 * Stream chat completion from Groq API
 * 
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Additional options (temperature, max_tokens, tools, tool_choice, etc.)
 * @returns {ReadableStream} Stream of response chunks
 */
async function streamChatCompletion(messages, options = {}) {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const {
    temperature = 0.7,
    max_tokens = MAX_OUTPUT_TOKENS,
    stream = true,
    tools = null,
    tool_choice = 'auto',
  } = options;

  const requestBody = {
    model: GROQ_MODEL,
    messages: messages,
    temperature: temperature,
    max_tokens: Math.min(max_tokens, MAX_OUTPUT_TOKENS),
    stream: stream,
  };

  // Add tools if provided
  if (tools && Array.isArray(tools) && tools.length > 0) {
    // Validate that all tools have names (non-empty strings)
    const validTools = tools.filter(tool => {
      const hasName = tool && 
                     tool.function && 
                     tool.function.name && 
                     typeof tool.function.name === 'string' && 
                     tool.function.name.trim() !== '';
      if (!hasName) {
        logger.warn('Filtering out tool without valid name:', JSON.stringify(tool));
      }
      return hasName;
    });
    
    if (validTools.length > 0) {
      // Final validation: ensure all tools are properly formatted
      const finalValidTools = validTools.filter(t => {
        const isValid = t && 
                       t.type === 'function' && 
                       t.function && 
                       t.function.name && 
                       typeof t.function.name === 'string' && 
                       t.function.name.trim() !== '' &&
                       t.function.description &&
                       t.function.parameters;
        if (!isValid) {
          logger.error('Filtering out malformed tool:', JSON.stringify(t));
        }
        return isValid;
      });
      
      if (finalValidTools.length > 0) {
        requestBody.tools = finalValidTools;
        requestBody.tool_choice = tool_choice;
        logger.debug('Including tools in request', {
          toolCount: finalValidTools.length,
          toolNames: finalValidTools.map(t => t.function.name),
        });
      } else {
        logger.warn('No valid tools after final validation');
      }
    } else {
      logger.warn('No valid tools to include in request');
    }
  }

  // Validate and log tools
  if (requestBody.tools) {
    const invalidTools = requestBody.tools.filter(t => !t.function || !t.function.name || t.function.name.trim() === '');
    if (invalidTools.length > 0) {
      logger.error('Invalid tools found in request:', JSON.stringify(invalidTools));
      logger.error('All tools in request:', JSON.stringify(requestBody.tools, null, 2));
      throw new Error(`Found ${invalidTools.length} tool(s) without valid names`);
    }
    logger.info('Tools being sent to Groq:', {
      toolCount: requestBody.tools.length,
      toolNames: requestBody.tools.map(t => t.function.name),
    });
  }
  
  // Log tool_calls in messages
  const messagesWithToolCalls = messages.filter(m => m.tool_calls);
  if (messagesWithToolCalls.length > 0) {
    logger.info('Messages with tool_calls:', {
      count: messagesWithToolCalls.length,
      toolCalls: messagesWithToolCalls.map(m => ({
        role: m.role,
        toolCallCount: m.tool_calls.length,
        toolCallNames: m.tool_calls.map(tc => tc.function?.name).filter(Boolean),
      })),
    });
  }

  logger.info('Sending chat completion request to Groq', {
    model: GROQ_MODEL,
    messageCount: messages.length,
    maxTokens: requestBody.max_tokens,
    apiKeySet: !!GROQ_API_KEY,
    apiKeyPrefix: GROQ_API_KEY ? GROQ_API_KEY.substring(0, 10) + '...' : 'NOT SET',
    hasTools: !!requestBody.tools,
    toolCount: requestBody.tools?.length || 0,
  });

  // Final check: Validate all tool_calls in messages before sending
  const allToolCalls = messages
    .filter(m => m.tool_calls && Array.isArray(m.tool_calls))
    .flatMap(m => m.tool_calls);
  
  for (const tc of allToolCalls) {
    if (!tc.function || !tc.function.name || tc.function.name.trim() === '') {
      logger.error('CRITICAL: Found tool_call without name before sending to Groq:', JSON.stringify(tc, null, 2));
      logger.error('Full request body:', JSON.stringify(requestBody, null, 2));
      throw new Error('Invalid tool_call found: missing function name');
    }
  }

  // Log the serialized request body to see what we're actually sending
  const serializedBody = JSON.stringify(requestBody);
  
  // Validate the serialized body doesn't have any empty tool names
  try {
    const parsedBody = JSON.parse(serializedBody);
    
    // Log tools being sent
    if (parsedBody.tools) {
      logger.info('Tools being sent to Groq (validated):', {
        count: parsedBody.tools.length,
        toolNames: parsedBody.tools.map(t => t.function?.name || 'MISSING'),
        tools: parsedBody.tools.map(t => ({
          type: t.type,
          hasFunction: !!t.function,
          name: t.function?.name || 'MISSING',
          hasDescription: !!t.function?.description,
          hasParameters: !!t.function?.parameters,
        })),
      });
      
      for (const tool of parsedBody.tools) {
        if (!tool.function || !tool.function.name || tool.function.name.trim() === '') {
          logger.error('CRITICAL: Found tool without name in serialized body:', JSON.stringify(tool, null, 2));
          logger.error('Full tools array:', JSON.stringify(parsedBody.tools, null, 2));
          throw new Error('Invalid tool found in serialized body: missing function name');
        }
      }
    } else {
      logger.warn('No tools array in request body');
    }
    
    // Log messages with tool_calls
    if (parsedBody.messages) {
      const messagesWithToolCalls = parsedBody.messages.filter(m => m.tool_calls && Array.isArray(m.tool_calls) && m.tool_calls.length > 0);
      if (messagesWithToolCalls.length > 0) {
        logger.info('Messages with tool_calls being sent:', {
          count: messagesWithToolCalls.length,
          toolCalls: messagesWithToolCalls.map(m => ({
            role: m.role,
            toolCallCount: m.tool_calls.length,
            toolCallNames: m.tool_calls.map(tc => tc.function?.name || 'MISSING'),
            toolCalls: m.tool_calls.map(tc => ({
              id: tc.id || 'MISSING',
              type: tc.type || 'MISSING',
              functionName: tc.function?.name || 'MISSING',
              hasArguments: !!tc.function?.arguments,
            })),
          })),
        });
      }
      
      for (const msg of parsedBody.messages) {
        if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
          for (const tc of msg.tool_calls) {
            if (!tc.function || !tc.function.name || tc.function.name.trim() === '') {
              logger.error('CRITICAL: Found tool_call without name in serialized body:', JSON.stringify(tc, null, 2));
              logger.error('Message containing invalid tool_call:', JSON.stringify(msg, null, 2));
              logger.error('Full messages array:', JSON.stringify(parsedBody.messages.map(m => ({
                role: m.role,
                hasToolCalls: !!(m.tool_calls && m.tool_calls.length > 0),
                toolCallsCount: m.tool_calls?.length || 0,
              })), null, 2));
              throw new Error('Invalid tool_call found in serialized body: missing function name');
            }
          }
        }
      }
    }
  } catch (parseError) {
    logger.error('Error parsing serialized body for validation:', parseError);
    throw parseError;
  }

  try {
    logger.debug('Making fetch request to Groq API', { url: GROQ_API_URL });
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: serializedBody,
    });

    logger.debug('Groq API response received', {
      status: response.status,
      statusText: response.statusText,
      hasBody: !!response.body,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Groq API error', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      
      // Log the full request that caused the error for debugging
      try {
        const requestBodyCopy = JSON.parse(JSON.stringify(requestBody));
        // Truncate long content for readability
        if (requestBodyCopy.messages) {
          requestBodyCopy.messages = requestBodyCopy.messages.map(m => {
            const msgCopy = { ...m };
            if (msgCopy.content && msgCopy.content.length > 200) {
              msgCopy.content = msgCopy.content.substring(0, 200) + '...';
            }
            return msgCopy;
          });
        }
        logger.error('Full request body that caused error:', JSON.stringify(requestBodyCopy, null, 2));
        
        // Specifically check tools
        if (requestBodyCopy.tools) {
          logger.error('Tools in request:', JSON.stringify(requestBodyCopy.tools.map(t => ({
            type: t.type,
            hasFunction: !!t.function,
            name: t.function?.name || 'MISSING',
            hasDescription: !!t.function?.description,
            hasParameters: !!t.function?.parameters,
          })), null, 2));
        }
      } catch (logError) {
        logger.error('Error logging request body:', logError);
      }
      
      throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    if (!response.body) {
      logger.error('Groq API response has no body');
      throw new Error('Response body is null');
    }

    logger.info('Groq API response received successfully');
    return response.body;
  } catch (error) {
    logger.error('Error calling Groq API', {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    throw error;
  }
}

/**
 * Parse SSE (Server-Sent Events) stream from Groq
 * 
 * @param {ReadableStream} stream - The response stream
 * @param {Function} onChunk - Callback function called for each content chunk
 * @param {Function} onToolCall - Optional callback function called for each tool call
 * @returns {Promise<void>}
 */
async function parseStream(stream, onChunk, onToolCall = null) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentToolCalls = []; // Accumulate tool calls across chunks

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Send any remaining tool calls before finishing
        if (currentToolCalls.length > 0 && onToolCall) {
          onToolCall(currentToolCalls);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim() === '') continue;
        
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // Remove 'data: ' prefix
          
          if (data === '[DONE]') {
            // Send any remaining tool calls before finishing
            if (currentToolCalls.length > 0 && onToolCall) {
              onToolCall(currentToolCalls);
            }
            return;
          }

          try {
            const json = JSON.parse(data);
            if (json.choices && json.choices[0] && json.choices[0].delta) {
              const delta = json.choices[0].delta;
              
              // Handle content chunks
              if (delta.content) {
                onChunk(delta.content);
              }
              
              // Handle tool calls
              if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
                delta.tool_calls.forEach((toolCallDelta) => {
                  const index = toolCallDelta.index;
                  
                  // Initialize tool call if it doesn't exist
                  if (!currentToolCalls[index]) {
                    currentToolCalls[index] = {
                      id: toolCallDelta.id || '',
                      type: 'function',
                      function: {
                        name: '',
                        arguments: '',
                      },
                    };
                  }
                  
                  // Accumulate tool call data
                  if (toolCallDelta.id) {
                    currentToolCalls[index].id = toolCallDelta.id;
                  }
                  if (toolCallDelta.function) {
                    if (toolCallDelta.function.name) {
                      currentToolCalls[index].function.name = toolCallDelta.function.name;
                    }
                    if (toolCallDelta.function.arguments) {
                      currentToolCalls[index].function.arguments += toolCallDelta.function.arguments;
                    }
                  }
                });
              }
              
              // Check if this is the final chunk for tool calls (finish_reason might indicate completion)
              if (json.choices[0].finish_reason === 'tool_calls' || json.choices[0].finish_reason === 'stop') {
                if (currentToolCalls.length > 0 && onToolCall) {
                  // Filter out incomplete tool calls (those without names or with empty names)
                  const completeToolCalls = currentToolCalls.filter(tc => {
                    const hasValidName = tc && tc.function && tc.function.name && tc.function.name.trim() !== '';
                    if (!hasValidName) {
                      logger.warn('Filtering out incomplete tool_call from stream:', JSON.stringify(tc));
                    }
                    return hasValidName;
                  });
                  if (completeToolCalls.length > 0) {
                    logger.info('Sending complete tool calls to frontend:', {
                      count: completeToolCalls.length,
                      names: completeToolCalls.map(tc => tc.function.name),
                    });
                    onToolCall(completeToolCalls);
                    currentToolCalls = []; // Reset after sending
                  } else {
                    logger.warn('No complete tool calls to send, all were filtered out');
                  }
                }
              }
            } else {
              // Log unexpected format for debugging
              logger.debug('Unexpected Groq response format', {
                hasChoices: !!json.choices,
                choicesLength: json.choices?.length,
                hasDelta: !!(json.choices?.[0]?.delta),
                jsonKeys: Object.keys(json),
              });
            }
          } catch (parseError) {
            logger.warn('Failed to parse SSE data', {
              data: data.substring(0, 200), // Log first 200 chars to avoid huge logs
              error: parseError.message,
            });
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error parsing stream', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    reader.releaseLock();
  }
}

module.exports = {
  streamChatCompletion,
  parseStream,
  MAX_INPUT_TOKENS,
  MAX_OUTPUT_TOKENS,
  GROQ_MODEL,
};

