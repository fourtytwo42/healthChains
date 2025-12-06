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
 * @param {Object} options - Additional options (temperature, max_tokens, etc.)
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
  } = options;

  const requestBody = {
    model: GROQ_MODEL,
    messages: messages,
    temperature: temperature,
    max_tokens: Math.min(max_tokens, MAX_OUTPUT_TOKENS),
    stream: stream,
  };

  logger.info('Sending chat completion request to Groq', {
    model: GROQ_MODEL,
    messageCount: messages.length,
    maxTokens: requestBody.max_tokens,
    apiKeySet: !!GROQ_API_KEY,
    apiKeyPrefix: GROQ_API_KEY ? GROQ_API_KEY.substring(0, 10) + '...' : 'NOT SET',
  });

  try {
    logger.debug('Making fetch request to Groq API', { url: GROQ_API_URL });
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
 * @param {Function} onChunk - Callback function called for each chunk
 * @returns {Promise<void>}
 */
async function parseStream(stream, onChunk) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
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
            return;
          }

          try {
            const json = JSON.parse(data);
            if (json.choices && json.choices[0] && json.choices[0].delta) {
              const content = json.choices[0].delta.content;
              if (content) {
                onChunk(content);
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

