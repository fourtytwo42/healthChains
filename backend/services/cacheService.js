const { createClient } = require('redis');
const { ConfigurationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Cache Service - Redis caching layer
 * 
 * Provides caching functionality with graceful fallback if Redis is unavailable.
 * Handles connection management, TTL, and cache invalidation.
 * 
 * @class CacheService
 */
class CacheService {
  constructor() {
    this.client = null;
    this.isEnabled = process.env.REDIS_ENABLED !== 'false';
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 3;
  }

  /**
   * Initialize Redis client and connect
   * 
   * @throws {ConfigurationError} If Redis configuration is invalid
   */
  async initialize() {
    if (!this.isEnabled) {
      logger.info('⚠️  Redis caching is disabled (REDIS_ENABLED=false)');
      return;
    }

    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;

    try {
      // Create Redis client
      const redisUrl = password 
        ? `redis://:${password}@${host}:${port}`
        : `redis://${host}:${port}`;

      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              logger.error('Redis: Max reconnection retries reached');
              return new Error('Max retries reached');
            }
            return Math.min(retries * 100, 3000); // Exponential backoff, max 3s
          }
        }
      });

      // Error handlers
      this.client.on('error', (err) => {
        logger.error('Redis Client Error', { error: err.message });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis: Connecting...');
      });

      this.client.on('ready', () => {
        logger.info('Redis: Connected and ready');
        this.isConnected = true;
        this.connectionRetries = 0;
      });

      this.client.on('reconnecting', () => {
        logger.info('Redis: Reconnecting...');
        this.connectionRetries++;
      });

      // Connect to Redis
      await this.client.connect();

      // Test connection
      await this.client.ping();
      logger.info(`Redis cache service initialized`, { host, port });
    } catch (error) {
      logger.warn('Redis connection failed, continuing without cache', { error: error.message });
      this.isConnected = false;
      this.client = null;
      // Don't throw - graceful degradation
    }
  }

  /**
   * Check if cache is available
   * 
   * @returns {boolean} True if cache is enabled and connected
   */
  isAvailable() {
    return this.isEnabled && this.isConnected && this.client !== null;
  }

  /**
   * Get value from cache
   * 
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null if not found/unavailable
   */
  async get(key) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value);
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error.message);
      return null; // Graceful fallback
    }
  }

  /**
   * Set value in cache with TTL
   * 
   * @param {string} key - Cache key
   * @param {any} value - Value to cache (will be JSON stringified)
   * @param {number} ttlSeconds - Time to live in seconds
   * @returns {Promise<boolean>} True if set successfully, false otherwise
   */
  async set(key, value, ttlSeconds = 300) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      logger.error(`Redis set error for key ${key}`, { key, error: error.message });
      return false; // Graceful fallback
    }
  }

  /**
   * Delete value from cache
   * 
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} True if deleted successfully, false otherwise
   */
  async delete(key) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis delete error for key ${key}:`, error.message);
      return false; // Graceful fallback
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * 
   * @param {string} pattern - Redis key pattern (e.g., 'consent:status:*')
   * @returns {Promise<number>} Number of keys deleted
   */
  async deletePattern(pattern) {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      await this.client.del(keys);
      return keys.length;
    } catch (error) {
      logger.error(`Redis deletePattern error for pattern ${pattern}:`, error.message);
      return 0; // Graceful fallback
    }
  }

  /**
   * Invalidate cache for a specific consent
   * 
   * @param {number} consentId - Consent ID
   * @returns {Promise<number>} Number of keys invalidated
   */
  async invalidateConsent(consentId) {
    const patterns = [
      `consent:record:${consentId}`,
      `consent:status:*:*:*`, // Invalidate all status caches (they may reference this consent)
      `consent:patient:*`, // Invalidate patient consents (may include this consent)
      `consent:provider:*` // Invalidate provider consents (may include this consent)
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.deletePattern(pattern);
    }

    return totalDeleted;
  }

  /**
   * Invalidate cache for a specific request
   * 
   * @param {number} requestId - Request ID
   * @param {string} patientAddress - Optional patient address for request list invalidation
   * @returns {Promise<number>} Number of keys invalidated
   */
  async invalidateRequest(requestId, patientAddress = null) {
    const patterns = [
      `request:${requestId}`, // Individual request cache
      `requests:patient:*:pending`, // All pending request lists (they may include this request)
      `requests:patient:*:all`, // All request lists
    ];

    // If patient address provided, also invalidate their specific caches
    if (patientAddress) {
      const normalizedAddress = patientAddress.toLowerCase();
      patterns.push(
        `requests:patient:${normalizedAddress}:pending`,
        `requests:patient:${normalizedAddress}:approved`,
        `requests:patient:${normalizedAddress}:all`
      );
    }

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.deletePattern(pattern);
    }

    return totalDeleted;
  }

  /**
   * Invalidate cache for a specific patient
   * 
   * @param {string} patientAddress - Patient address
   * @returns {Promise<number>} Number of keys invalidated
   */
  async invalidatePatient(patientAddress) {
    const normalizedAddress = patientAddress.toLowerCase();
    const patterns = [
      `consent:patient:${normalizedAddress}*`,
      `consent:status:${normalizedAddress}*`,
      `requests:patient:${normalizedAddress}*`,
      `events:consent:${normalizedAddress}*`,
      `events:requests:${normalizedAddress}*`
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.deletePattern(pattern);
    }

    return totalDeleted;
  }

  /**
   * Invalidate cache for a specific provider
   * 
   * @param {string} providerAddress - Provider address
   * @returns {Promise<number>} Number of keys invalidated
   */
  async invalidateProvider(providerAddress) {
    const normalizedAddress = providerAddress.toLowerCase();
    const patterns = [
      `consent:provider:${normalizedAddress}*`,
      `consent:status:*:${normalizedAddress}*`,
      `events:consent:*` // Provider consents may be in general event cache
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.deletePattern(pattern);
    }

    return totalDeleted;
  }

  /**
   * Invalidate all event caches
   * 
   * @returns {Promise<number>} Number of keys invalidated
   */
  async invalidateEvents() {
    const patterns = [
      `events:consent:*`,
      `events:requests:*`
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.deletePattern(pattern);
    }

    return totalDeleted;
  }

  /**
   * Health check - test Redis connection
   * 
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    if (!this.isEnabled) {
      return {
        enabled: false,
        connected: false,
        status: 'disabled'
      };
    }

    if (!this.isAvailable()) {
      return {
        enabled: true,
        connected: false,
        status: 'disconnected'
      };
    }

    try {
      await this.client.ping();
      return {
        enabled: true,
        connected: true,
        status: 'healthy'
      };
    } catch (error) {
      return {
        enabled: true,
        connected: false,
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        this.isConnected = false;
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error('Error closing Redis connection:', error.message);
      }
    }
  }
}

// Export singleton instance
const cacheService = new CacheService();
module.exports = cacheService;

