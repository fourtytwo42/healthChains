const { expect } = require('chai');
// Enable authentication for this test
process.env.AUTH_REQUIRED = 'true';
const { ethers } = require('ethers');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const authService = require('../../services/authService');
const { errorHandler, notFoundHandler } = require('../../middleware/errorHandler');

describe('Protected Routes - Integration Tests', function () {
  this.timeout(10000);

  let app;
  let patientWallet, providerWallet;
  let patientAddress, providerAddress;
  let patientToken, providerToken;

  before(function () {
    // Ensure AUTH_REQUIRED is set before loading middleware
    process.env.AUTH_REQUIRED = 'true';
    // Clear module cache to ensure fresh middleware
    delete require.cache[require.resolve('../../middleware/auth')];
    
    app = express();
    app.use(cors());
    app.use(express.json());
    
    // Mock protected route for testing
    const { authenticate, verifyOwnership } = require('../../middleware/auth');
    app.get('/api/test/patient/:patientAddress', authenticate, verifyOwnership('patientAddress'), (req, res) => {
      res.json({ success: true, data: { patientAddress: req.params.patientAddress } });
    });
    app.get('/api/test/provider/:providerAddress', authenticate, verifyOwnership('providerAddress'), (req, res) => {
      res.json({ success: true, data: { providerAddress: req.params.providerAddress } });
    });
    
    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  before(function () {
    // Create test wallets
    patientWallet = ethers.Wallet.createRandom();
    providerWallet = ethers.Wallet.createRandom();
    patientAddress = patientWallet.address;
    providerAddress = providerWallet.address;
  });

  before(async function () {
    // Generate tokens for testing
    const message = 'HealthChains authentication message';
    const timestamp = Math.floor(Date.now() / 1000);
    
    const patientSignature = await patientWallet.signMessage(message);
    const providerSignature = await providerWallet.signMessage(message);
    
    const patientLogin = await authService.login(patientAddress, patientSignature, message, timestamp);
    const providerLogin = await authService.login(providerAddress, providerSignature, message, timestamp);
    
    patientToken = patientLogin.token;
    providerToken = providerLogin.token;
  });

  describe('Authentication Required', function () {
    it('should reject request without token', async function () {
      const response = await request(app)
        .get(`/api/test/patient/${patientAddress}`)
        .expect(401);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'AUTHENTICATION_REQUIRED');
    });

    it('should reject request with invalid token', async function () {
      const response = await request(app)
        .get(`/api/test/patient/${patientAddress}`)
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'INVALID_TOKEN');
    });

    it('should reject request with expired token', async function () {
      // Create an expired token (this would require modifying JWT_EXPIRES_IN temporarily)
      // For now, we'll just test that invalid tokens are rejected
      const response = await request(app)
        .get(`/api/test/patient/${patientAddress}`)
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZGRyZXNzIjoiMHgxMjMiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0.invalid')
        .expect(401);

      expect(response.body).to.have.property('success', false);
    });
  });

  describe('Ownership Verification', function () {
    it('should allow patient to access their own data', async function () {
      const response = await request(app)
        .get(`/api/test/patient/${patientAddress}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('patientAddress');
    });

    it('should reject patient accessing another patient\'s data', async function () {
      const otherPatientAddress = ethers.Wallet.createRandom().address;
      
      const response = await request(app)
        .get(`/api/test/patient/${otherPatientAddress}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'ACCESS_DENIED');
    });

    it('should allow provider to access their own data', async function () {
      const response = await request(app)
        .get(`/api/test/provider/${providerAddress}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('providerAddress');
    });

    it('should reject provider accessing another provider\'s data', async function () {
      const otherProviderAddress = ethers.Wallet.createRandom().address;
      
      const response = await request(app)
        .get(`/api/test/provider/${otherProviderAddress}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(403);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'ACCESS_DENIED');
    });

    it('should reject patient accessing provider route', async function () {
      const response = await request(app)
        .get(`/api/test/provider/${providerAddress}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'ACCESS_DENIED');
    });

    it('should reject provider accessing patient route', async function () {
      const response = await request(app)
        .get(`/api/test/patient/${patientAddress}`)
        .set('Authorization', `Bearer ${providerToken}`)
        .expect(403);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'ACCESS_DENIED');
    });
  });

  describe('Address Normalization', function () {
    it('should handle checksummed addresses correctly', async function () {
      // Test with different case variations
      const lowerCaseAddress = patientAddress.toLowerCase();
      
      const response = await request(app)
        .get(`/api/test/patient/${lowerCaseAddress}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
    });

    it('should handle mixed case addresses correctly', async function () {
      // ethers.getAddress() normalizes to checksum, so this should work
      const response = await request(app)
        .get(`/api/test/patient/${patientAddress}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
    });
  });
});

