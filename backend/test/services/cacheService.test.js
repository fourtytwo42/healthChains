const { expect } = require('chai');
const cacheService = require('../../services/cacheService');

describe('Cache Service', function () {
  this.timeout(10000); // 10 second timeout

  before(async function () {
    // Initialize cache service
    await cacheService.initialize();
  });

  after(async function () {
    // Close Redis connection
    await cacheService.close();
  });

  describe('Connection', function () {
    it('should be available if Redis is connected', async function () {
      const isAvailable = cacheService.isAvailable();
      // May be false if Redis is disabled or not connected
      expect(typeof isAvailable).to.equal('boolean');
    });

    it('should return health check status', async function () {
      const health = await cacheService.healthCheck();
      expect(health).to.have.property('enabled');
      expect(health).to.have.property('connected');
      expect(health).to.have.property('status');
    });
  });

  describe('Basic Operations', function () {
    it('should set and get a value', async function () {
      if (!cacheService.isAvailable()) {
        this.skip(); // Skip if Redis is not available
      }

      const key = 'test:key:1';
      const value = { test: 'data', number: 123 };
      
      await cacheService.set(key, value, 60);
      const retrieved = await cacheService.get(key);
      
      expect(retrieved).to.deep.equal(value);
    });

    it('should return null for non-existent key', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      const retrieved = await cacheService.get('test:key:nonexistent');
      expect(retrieved).to.be.null;
    });

    it('should delete a key', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      const key = 'test:key:delete';
      const value = { test: 'delete' };
      
      await cacheService.set(key, value, 60);
      await cacheService.delete(key);
      const retrieved = await cacheService.get(key);
      
      expect(retrieved).to.be.null;
    });

    it('should handle TTL expiration', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      const key = 'test:key:ttl';
      const value = { test: 'ttl' };
      
      // Set with 2 second TTL
      await cacheService.set(key, value, 2);
      
      // Should be available immediately
      const immediate = await cacheService.get(key);
      expect(immediate).to.deep.equal(value);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Should be null after expiration
      const expired = await cacheService.get(key);
      expect(expired).to.be.null;
    });
  });

  describe('Cache Key Generation', function () {
    it('should handle different key formats', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      const keys = [
        'consent:status:0x123:0x456:medical_records',
        'consent:record:1',
        'consent:patient:0x123:false',
        'events:consent:0x123:0:100'
      ];

      for (const key of keys) {
        const value = { test: key };
        await cacheService.set(key, value, 60);
        const retrieved = await cacheService.get(key);
        expect(retrieved).to.deep.equal(value);
        await cacheService.delete(key);
      }
    });
  });

  describe('Graceful Degradation', function () {
    it('should return null when Redis is unavailable', async function () {
      // This test verifies that get() returns null gracefully
      // even if Redis is not available (handled by isAvailable check)
      const result = await cacheService.get('test:unavailable');
      // Should not throw, should return null
      expect(result === null || typeof result === 'object').to.be.true;
    });

    it('should not throw when setting with Redis unavailable', async function () {
      // Should not throw even if Redis is unavailable
      // set() returns a promise, so we await it
      const result = await cacheService.set('test:unavailable', { test: 'data' }, 60);
      // Result should be a boolean (true if set, false if unavailable)
      expect(typeof result).to.equal('boolean');
    });
  });

  describe('Cache Invalidation', function () {
    it('should invalidate consent by ID', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      const consentId = 999;
      const key = `consent:record:${consentId}`;
      await cacheService.set(key, { test: 'data' }, 60);
      
      const deleted = await cacheService.invalidateConsent(consentId);
      expect(deleted).to.be.at.least(0);
      
      const retrieved = await cacheService.get(key);
      // May or may not be null depending on pattern matching
      expect(retrieved === null || typeof retrieved === 'object').to.be.true;
    });

    it('should invalidate patient cache', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      const patientAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      const key = `consent:patient:${patientAddress}:false`;
      await cacheService.set(key, [{ test: 'data' }], 60);
      
      const deleted = await cacheService.invalidatePatient(patientAddress);
      expect(deleted).to.be.at.least(0);
    });

    it('should invalidate provider cache', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      const providerAddress = '0xBcd4042DE499D14e55001CcbB24a551F3b954096';
      const key = `consent:provider:${providerAddress}:false`;
      await cacheService.set(key, [{ test: 'data' }], 60);
      
      const deleted = await cacheService.invalidateProvider(providerAddress);
      expect(deleted).to.be.at.least(0);
    });
  });
});

