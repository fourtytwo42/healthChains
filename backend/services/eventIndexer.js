const { Pool } = require('pg');
const { normalizeAddress } = require('../utils/addressUtils');
const logger = require('../utils/logger');

/**
 * Event Indexer Service
 * 
 * Manages event indexing to PostgreSQL for efficient querying.
 * Provides graceful degradation if PostgreSQL is unavailable.
 * 
 * Features:
 * - Stores consent and access request events in PostgreSQL
 * - Tracks last processed block number per event type
 * - Only queries new events from blockchain
 * - Falls back to direct blockchain queries if PostgreSQL unavailable
 */
class EventIndexer {
  constructor() {
    this.pool = null;
    this.isEnabled = false;
    this.isInitialized = false;
  }

  /**
   * Initialize PostgreSQL connection
   * 
   * @returns {Promise<boolean>} True if successfully initialized, false otherwise
   */
  async initialize() {
    // Check if PostgreSQL is enabled via environment variable
    if (process.env.POSTGRES_ENABLED !== 'true') {
      logger.info('PostgreSQL event indexing is disabled (POSTGRES_ENABLED != true)');
      return false;
    }

    const config = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DATABASE || 'healthchains_events',
      user: process.env.POSTGRES_USER || 'healthchains',
      password: process.env.POSTGRES_PASSWORD || 'healthchains123',
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    try {
      this.pool = new Pool(config);
      
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      // Initialize schema
      await this._initializeSchema();

      this.isEnabled = true;
      this.isInitialized = true;
      logger.info('PostgreSQL event indexer initialized successfully');
      return true;
    } catch (error) {
      logger.warn('PostgreSQL event indexer initialization failed', { error: error.message, fallback: 'Event indexing will use direct blockchain queries' });
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      this.isEnabled = false;
      this.isInitialized = true;
      return false;
    }
  }

  /**
   * Initialize database schema
   * 
   * @private
   */
  async _initializeSchema() {
    const client = await this.pool.connect();
    try {
      // Create events table
      await client.query(`
        CREATE TABLE IF NOT EXISTS consent_events (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          block_number BIGINT NOT NULL,
          transaction_hash VARCHAR(66) NOT NULL,
          log_index INTEGER NOT NULL,
          patient_address VARCHAR(42),
          provider_address VARCHAR(42),
          consent_id INTEGER,
          consent_ids INTEGER[],
          request_id INTEGER,
          timestamp BIGINT,
          data_type VARCHAR(100),
          data_types VARCHAR(100)[],
          purpose VARCHAR(100),
          purposes VARCHAR(100)[],
          expiration_time BIGINT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(transaction_hash, log_index)
        )
      `);

      // Create access request events table
      await client.query(`
        CREATE TABLE IF NOT EXISTS access_request_events (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          block_number BIGINT NOT NULL,
          transaction_hash VARCHAR(66) NOT NULL,
          log_index INTEGER NOT NULL,
          request_id INTEGER NOT NULL,
          patient_address VARCHAR(42),
          provider_address VARCHAR(42),
          timestamp BIGINT,
          data_types VARCHAR(100)[],
          purposes VARCHAR(100)[],
          expiration_time BIGINT,
          status VARCHAR(20),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(transaction_hash, log_index)
        )
      `);

      // Create block tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS block_tracking (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50) UNIQUE NOT NULL,
          last_processed_block BIGINT NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_consent_events_patient 
        ON consent_events(patient_address)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_consent_events_provider 
        ON consent_events(provider_address)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_consent_events_block 
        ON consent_events(block_number)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_access_request_events_patient 
        ON access_request_events(patient_address)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_access_request_events_provider 
        ON access_request_events(provider_address)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_access_request_events_block 
        ON access_request_events(block_number)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_access_request_events_request_id 
        ON access_request_events(request_id)
      `);

      logger.info('✅ Database schema initialized');
    } finally {
      client.release();
    }
  }

  /**
   * Get last processed block number for an event type
   * 
   * @param {string} eventType - Event type (e.g., 'ConsentGranted', 'AccessRequested')
   * @returns {Promise<number>} Last processed block number (0 if none)
   */
  async getLastProcessedBlock(eventType) {
    if (!this.isEnabled) {
      return 0;
    }

    try {
      const client = await this.pool.connect();
      try {
        const result = await client.query(
          'SELECT last_processed_block FROM block_tracking WHERE event_type = $1',
          [eventType]
        );
        
        if (result.rows.length > 0) {
          return parseInt(result.rows[0].last_processed_block, 10);
        }
        
        // Initialize if not exists
        await client.query(
          'INSERT INTO block_tracking (event_type, last_processed_block) VALUES ($1, $2) ON CONFLICT (event_type) DO NOTHING',
          [eventType, 0]
        );
        
        return 0;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error getting last processed block:', error.message);
      return 0;
    }
  }

  /**
   * Update last processed block number for an event type
   * 
   * @param {string} eventType - Event type
   * @param {number} blockNumber - Block number
   */
  async updateLastProcessedBlock(eventType, blockNumber) {
    if (!this.isEnabled) {
      return;
    }

    try {
      const client = await this.pool.connect();
      try {
        await client.query(
          `INSERT INTO block_tracking (event_type, last_processed_block, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (event_type) 
           DO UPDATE SET last_processed_block = $2, updated_at = CURRENT_TIMESTAMP`,
          [eventType, blockNumber]
        );
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error updating last processed block:', error.message);
    }
  }

  /**
   * Store consent events in database (simplified - just track last processed block)
   * 
   * @param {Array} events - Array of consent events from blockchain
   */
  async storeConsentEvents(events) {
    if (!this.isEnabled || !events || events.length === 0) {
      return;
    }

    try {
      let maxBlock = 0;

      for (const event of events) {
        const blockNumber = typeof event.blockNumber === 'number' 
          ? event.blockNumber 
          : parseInt(event.blockNumber.toString(), 10);
        if (blockNumber > maxBlock) {
          maxBlock = blockNumber;
        }
      }

      // Update last processed block for both event types
      if (maxBlock > 0) {
        await this.updateLastProcessedBlock('ConsentGranted', maxBlock);
        await this.updateLastProcessedBlock('ConsentRevoked', maxBlock);
      }
    } catch (error) {
      logger.error('Error storing consent events:', error.message);
    }
  }

  /**
   * Store access request events in database (simplified - just track last processed block)
   * 
   * @param {Array} events - Array of access request events from blockchain
   */
  async storeAccessRequestEvents(events) {
    if (!this.isEnabled || !events || events.length === 0) {
      return;
    }

    try {
      let maxBlock = 0;

      for (const event of events) {
        const blockNumber = typeof event.blockNumber === 'number' 
          ? event.blockNumber 
          : parseInt(event.blockNumber.toString(), 10);
        if (blockNumber > maxBlock) {
          maxBlock = blockNumber;
        }
      }

      // Update last processed block for all access request event types
      if (maxBlock > 0) {
        await this.updateLastProcessedBlock('AccessRequested', maxBlock);
        await this.updateLastProcessedBlock('AccessApproved', maxBlock);
        await this.updateLastProcessedBlock('AccessDenied', maxBlock);
      }
    } catch (error) {
      logger.error('Error storing access request events:', error.message);
    }
  }

  /**
   * Query consent events from database
   * 
   * @param {Object} filters - Filter options
   * @param {string} filters.patientAddress - Patient address filter
   * @param {string} filters.providerAddress - Provider address filter
   * @param {number} filters.fromBlock - Start block number
   * @param {number} filters.toBlock - End block number
   * @returns {Promise<Array>} Array of events
   */
  async queryConsentEvents(filters = {}) {
    if (!this.isEnabled) {
      return [];
    }

    try {
      const client = await this.pool.connect();
      try {
        let query = 'SELECT * FROM consent_events WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (filters.patientAddress) {
          query += ` AND patient_address = $${paramIndex}`;
          params.push(normalizeAddress(filters.patientAddress));
          paramIndex++;
        }

        if (filters.providerAddress) {
          query += ` AND provider_address = $${paramIndex}`;
          params.push(normalizeAddress(filters.providerAddress));
          paramIndex++;
        }

        if (filters.fromBlock) {
          query += ` AND block_number >= $${paramIndex}`;
          params.push(parseInt(filters.fromBlock, 10));
          paramIndex++;
        }

        if (filters.toBlock) {
          query += ` AND block_number <= $${paramIndex}`;
          params.push(parseInt(filters.toBlock, 10));
          paramIndex++;
        }

        query += ' ORDER BY block_number ASC, log_index ASC';

        const result = await client.query(query, params);
        return result.rows;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error querying consent events:', error.message);
      return [];
    }
  }

  /**
   * Query access request events from database
   * 
   * @param {Object} filters - Filter options
   * @param {string} filters.patientAddress - Patient address filter
   * @param {string} filters.providerAddress - Provider address filter
   * @param {number} filters.requestId - Request ID filter
   * @param {number} filters.fromBlock - Start block number
   * @param {number} filters.toBlock - End block number
   * @returns {Promise<Array>} Array of events
   */
  async queryAccessRequestEvents(filters = {}) {
    if (!this.isEnabled) {
      return [];
    }

    try {
      const client = await this.pool.connect();
      try {
        let query = 'SELECT * FROM access_request_events WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (filters.patientAddress) {
          query += ` AND patient_address = $${paramIndex}`;
          params.push(normalizeAddress(filters.patientAddress));
          paramIndex++;
        }

        if (filters.providerAddress) {
          query += ` AND provider_address = $${paramIndex}`;
          params.push(normalizeAddress(filters.providerAddress));
          paramIndex++;
        }

        if (filters.requestId !== undefined) {
          query += ` AND request_id = $${paramIndex}`;
          params.push(parseInt(filters.requestId, 10));
          paramIndex++;
        }

        if (filters.fromBlock) {
          query += ` AND block_number >= $${paramIndex}`;
          params.push(parseInt(filters.fromBlock, 10));
          paramIndex++;
        }

        if (filters.toBlock) {
          query += ` AND block_number <= $${paramIndex}`;
          params.push(parseInt(filters.toBlock, 10));
          paramIndex++;
        }

        query += ' ORDER BY block_number ASC, log_index ASC';

        const result = await client.query(query, params);
        return result.rows;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error querying access request events:', error.message);
      return [];
    }
  }

  /**
   * Check if event indexer is enabled
   * 
   * @returns {boolean} True if enabled
   */
  isEventIndexingEnabled() {
    return this.isEnabled;
  }

  /**
   * Close database connection pool
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isEnabled = false;
    }
  }
}

// Export singleton instance
const eventIndexer = new EventIndexer();
module.exports = eventIndexer;

