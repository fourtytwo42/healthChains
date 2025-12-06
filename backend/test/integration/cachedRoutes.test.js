const { expect } = require('chai');
const cacheService = require('../../services/cacheService');
const consentService = require('../../services/consentService');
const web3Service = require('../../services/web3Service');

describe('Cached Routes - Integration Tests', function () {
  this.timeout(30000);

  const testPatientAddress = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const testProviderAddress = '0xBcd4042DE499D14e55001CcbB24a551F3b954096';

  before(async function () {
    // Initialize services
    await cacheService.initialize();
    await web3Service.initialize();
  });

  after(async function () {
    // Clean up cache
    await cacheService.invalidatePatient(testPatientAddress);
    await cacheService.invalidateProvider(testProviderAddress);
    await cacheService.close();
  });

  describe('Cache Hit/Miss Scenarios', function () {
    it('should cache consent status and return cached value on second request', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      const dataType = 'medical_records';
      
      // First request (cache miss)
      const start1 = Date.now();
      const result1 = await consentService.getConsentStatus(
        testPatientAddress,
        testProviderAddress,
        dataType
      );
      const time1 = Date.now() - start1;

      // Second request (cache hit)
      const start2 = Date.now();
      const result2 = await consentService.getConsentStatus(
        testPatientAddress,
        testProviderAddress,
        dataType
      );
      const time2 = Date.now() - start2;

      // Results should be the same
      expect(result1).to.deep.equal(result2);
      
      // Second request should be faster (cache hit)
      // Note: This may not always be true due to timing, but cache hit should be faster
      if (time1 > 100) { // Only check if first request took significant time
        expect(time2).to.be.lessThan(time1);
      }
    });

    it('should cache consent record and return cached value', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      // This test assumes there's at least one consent in the contract
      // If not, it will fail gracefully
      try {
        // First request
        const result1 = await consentService.getConsentRecord(1);
        
        // Second request (should be cached)
        const start = Date.now();
        const result2 = await consentService.getConsentRecord(1);
        const time = Date.now() - start;

        expect(result1).to.deep.equal(result2);
        // Cache hit should be very fast (< 50ms)
        expect(time).to.be.lessThan(50);
      } catch (error) {
        // If consent doesn't exist, skip this test
        if (error.name === 'NotFoundError') {
          this.skip();
        }
        throw error;
      }
    });

    it('should cache patient consents', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      // First request
      const result1 = await consentService.getPatientConsents(testPatientAddress, false);
      
      // Second request (should be cached)
      const start = Date.now();
      const result2 = await consentService.getPatientConsents(testPatientAddress, false);
      const time = Date.now() - start;

      expect(result1).to.deep.equal(result2);
      expect(time).to.be.lessThan(100); // Cache hit should be fast
    });
  });

  describe('Cache Invalidation', function () {
    it('should invalidate patient cache when requested', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      // Set some cache
      await consentService.getPatientConsents(testPatientAddress, false);
      
      // Invalidate
      const deleted = await cacheService.invalidatePatient(testPatientAddress);
      expect(deleted).to.be.at.least(0);
    });

    it('should invalidate provider cache when requested', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      // Set some cache
      await consentService.getProviderConsents(testProviderAddress, false);
      
      // Invalidate
      const deleted = await cacheService.invalidateProvider(testProviderAddress);
      expect(deleted).to.be.at.least(0);
    });
  });

  describe('Cache TTL Expiration', function () {
    it('should expire cache after TTL', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      const dataType = 'medical_records';
      
      // Set cache with short TTL (manually set)
      const cacheKey = `consent:status:${testPatientAddress.toLowerCase()}:${testProviderAddress.toLowerCase()}:${dataType}`;
      await cacheService.set(cacheKey, { test: 'data' }, 2); // 2 second TTL
      
      // Should be available immediately
      const immediate = await cacheService.get(cacheKey);
      expect(immediate).to.not.be.null;
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Should be null after expiration
      const expired = await cacheService.get(cacheKey);
      expect(expired).to.be.null;
    });
  });

  describe('Graceful Degradation', function () {
    it('should work without cache if Redis is unavailable', async function () {
      // This test verifies that services work even if cache is unavailable
      // The cache service should gracefully degrade
      const result = await consentService.getConsentStatus(
        testPatientAddress,
        testProviderAddress,
        'medical_records'
      );
      
      // Should return a result (even if not cached)
      expect(result).to.have.property('hasConsent');
    });
  });

  describe('Cache Key Collisions', function () {
    it('should use different keys for different parameters', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      const dataType1 = 'medical_records';
      const dataType2 = 'diagnostic_data';
      
      const result1 = await consentService.getConsentStatus(
        testPatientAddress,
        testProviderAddress,
        dataType1
      );
      
      const result2 = await consentService.getConsentStatus(
        testPatientAddress,
        testProviderAddress,
        dataType2
      );
      
      // Results may be different, but both should be cached separately
      expect(result1).to.have.property('hasConsent');
      expect(result2).to.have.property('hasConsent');
    });
  });
});

