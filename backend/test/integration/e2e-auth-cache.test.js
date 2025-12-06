const { expect } = require('chai');
// Enable authentication for this test
process.env.AUTH_REQUIRED = 'true';
const { ethers } = require('ethers');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const authRouter = require('../../routes/authRoutes');
const authService = require('../../services/authService');
const cacheService = require('../../services/cacheService');
const { errorHandler, notFoundHandler } = require('../../middleware/errorHandler');

describe('End-to-End Auth + Cache Tests', function () {
  this.timeout(30000);

  let app;
  let testWallet;
  let testAddress;
  let testToken;

  before(function () {
    // Ensure AUTH_REQUIRED is set before loading middleware
    process.env.AUTH_REQUIRED = 'true';
    // Clear module cache to ensure fresh middleware
    delete require.cache[require.resolve('../../middleware/auth')];
    const { authenticate: freshAuthenticate, verifyOwnership: freshVerifyOwnership } = require('../../middleware/auth');
    
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/auth', authRouter);
    
    // Mock protected route that uses cache
    app.get('/api/test/cached/:address', freshAuthenticate, freshVerifyOwnership('address'), async (req, res) => {
      // Simulate a cached operation
      const cacheKey = `test:${req.params.address}`;
      const cached = await cacheService.get(cacheKey);
      
      if (cached) {
        return res.json({ success: true, data: cached, cached: true });
      }
      
      // Simulate expensive operation
      const data = { address: req.params.address, timestamp: Date.now() };
      await cacheService.set(cacheKey, data, 60);
      res.json({ success: true, data, cached: false });
    });
    
    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  before(async function () {
    // Initialize cache
    await cacheService.initialize();
  });

  before(async function () {
    // Create test wallet and get token
    testWallet = ethers.Wallet.createRandom();
    testAddress = testWallet.address;
    
    const message = 'HealthChains authentication message';
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await testWallet.signMessage(message);
    
    const loginResult = await authService.login(testAddress, signature, message, timestamp);
    testToken = loginResult.token;
  });

  after(async function () {
    // Clean up
    await cacheService.delete(`test:${testAddress}`);
    await cacheService.close();
  });

  describe('Complete Login Flow', function () {
    it('should login, get token, and access protected route', async function () {
      // Step 1: Login
      const message = 'HealthChains authentication message';
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await testWallet.signMessage(message);
      
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          address: testAddress,
          signature: signature,
          message: message,
          timestamp: timestamp
        })
        .expect(200);

      expect(loginResponse.body).to.have.property('success', true);
      const token = loginResponse.body.data.token;

      // Step 2: Use token to access protected route
      const protectedResponse = await request(app)
        .get(`/api/test/cached/${testAddress}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(protectedResponse.body).to.have.property('success', true);
      expect(protectedResponse.body.data).to.have.property('address');
    });
  });

  describe('Cache Performance', function () {
    it('should cache response and return cached data on second request', async function () {
      if (!cacheService.isAvailable()) {
        this.skip();
      }

      // Clear cache first
      await cacheService.delete(`test:${testAddress}`);

      // First request (cache miss)
      const response1 = await request(app)
        .get(`/api/test/cached/${testAddress}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response1.body).to.have.property('cached', false);

      // Second request (cache hit)
      const start = Date.now();
      const response2 = await request(app)
        .get(`/api/test/cached/${testAddress}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);
      const time = Date.now() - start;

      expect(response2.body).to.have.property('cached', true);
      expect(response2.body.data).to.deep.equal(response1.body.data);
      expect(time).to.be.lessThan(50); // Cache hit should be very fast
    });
  });

  describe('Authentication + Caching Together', function () {
    it('should require authentication even with cached data', async function () {
      // First, create cache entry
      await request(app)
        .get(`/api/test/cached/${testAddress}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      // Try to access without token (should fail)
      await request(app)
        .get(`/api/test/cached/${testAddress}`)
        .expect(401);
    });

    it('should verify ownership even with cached data', async function () {
      const otherAddress = ethers.Wallet.createRandom().address;
      
      // Should fail even if cache exists for other address
      await request(app)
        .get(`/api/test/cached/${otherAddress}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(403);
    });
  });

  describe('Multiple Users', function () {
    it('should handle multiple users accessing their own data simultaneously', async function () {
      const wallet2 = ethers.Wallet.createRandom();
      const address2 = wallet2.address;
      
      const message = 'HealthChains authentication message';
      const timestamp = Math.floor(Date.now() / 1000);
      const signature2 = await wallet2.signMessage(message);
      
      const login2 = await authService.login(address2, signature2, message, timestamp);
      const token2 = login2.token;

      // Both users should be able to access their own data
      const [response1, response2] = await Promise.all([
        request(app)
          .get(`/api/test/cached/${testAddress}`)
          .set('Authorization', `Bearer ${testToken}`)
          .expect(200),
        request(app)
          .get(`/api/test/cached/${address2}`)
          .set('Authorization', `Bearer ${token2}`)
          .expect(200)
      ]);

      expect(response1.body.data.address.toLowerCase()).to.equal(testAddress.toLowerCase());
      expect(response2.body.data.address.toLowerCase()).to.equal(address2.toLowerCase());
    });
  });
});

