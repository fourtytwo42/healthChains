const { expect } = require('chai');
const { ethers } = require('ethers');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const authRouter = require('../../routes/authRoutes');
const { errorHandler, notFoundHandler } = require('../../middleware/errorHandler');

describe('Auth Routes - Integration Tests', function () {
  this.timeout(10000);

  let app;
  let testWallet;
  let testAddress;
  let testMessage;
  let testSignature;

  before(function () {
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/auth', authRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  before(function () {
    // Create test wallet
    testWallet = ethers.Wallet.createRandom();
    testAddress = testWallet.address;
    testMessage = 'HealthChains authentication message';
  });

  before(async function () {
    // Sign message
    testSignature = await testWallet.signMessage(testMessage);
  });

  describe('POST /api/auth/login', function () {
    it('should login with valid signature and return JWT token', async function () {
      const timestamp = Math.floor(Date.now() / 1000);
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          address: testAddress,
          signature: testSignature,
          message: testMessage,
          timestamp: timestamp
        })
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('token');
      expect(response.body.data).to.have.property('address');
      expect(response.body.data).to.have.property('expiresIn');
      expect(response.body.data.address.toLowerCase()).to.equal(testAddress.toLowerCase());
    });

    it('should reject login with invalid signature', async function () {
      const wrongWallet = ethers.Wallet.createRandom();
      const wrongSignature = await wrongWallet.signMessage(testMessage);
      const timestamp = Math.floor(Date.now() / 1000);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          address: testAddress,
          signature: wrongSignature,
          message: testMessage,
          timestamp: timestamp
        })
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'AUTHENTICATION_FAILED');
    });

    it('should reject login with wrong address', async function () {
      const wrongAddress = ethers.Wallet.createRandom().address;
      const timestamp = Math.floor(Date.now() / 1000);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          address: wrongAddress,
          signature: testSignature,
          message: testMessage,
          timestamp: timestamp
        })
        .expect(400);

      expect(response.body).to.have.property('success', false);
    });

    it('should reject login with old timestamp', async function () {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          address: testAddress,
          signature: testSignature,
          message: testMessage,
          timestamp: oldTimestamp
        })
        .expect(400);

      expect(response.body).to.have.property('success', false);
    });

    it('should reject login with missing parameters', async function () {
      const timestamp = Math.floor(Date.now() / 1000);

      // Missing address
      await request(app)
        .post('/api/auth/login')
        .send({
          signature: testSignature,
          message: testMessage,
          timestamp: timestamp
        })
        .expect(400);

      // Missing signature
      await request(app)
        .post('/api/auth/login')
        .send({
          address: testAddress,
          message: testMessage,
          timestamp: timestamp
        })
        .expect(400);

      // Missing message
      await request(app)
        .post('/api/auth/login')
        .send({
          address: testAddress,
          signature: testSignature,
          timestamp: timestamp
        })
        .expect(400);
    });

    it('should reject login with invalid address format', async function () {
      const timestamp = Math.floor(Date.now() / 1000);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          address: 'invalid-address',
          signature: testSignature,
          message: testMessage,
          timestamp: timestamp
        })
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'INVALID_ADDRESS');
    });
  });

  describe('POST /api/auth/verify', function () {
    let validToken;

    before(async function () {
      // Get a valid token first
      const timestamp = Math.floor(Date.now() / 1000);
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          address: testAddress,
          signature: testSignature,
          message: testMessage,
          timestamp: timestamp
        });
      validToken = loginResponse.body.data.token;
    });

    it('should verify a valid token', async function () {
      const response = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).to.have.property('success', true);
      expect(response.body.data).to.have.property('valid', true);
      expect(response.body.data).to.have.property('address');
      expect(response.body.data).to.have.property('expiresAt');
      expect(response.body.data.address.toLowerCase()).to.equal(testAddress.toLowerCase());
    });

    it('should reject verification without token', async function () {
      const response = await request(app)
        .post('/api/auth/verify')
        .expect(400);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'MISSING_TOKEN');
    });

    it('should reject verification with invalid token', async function () {
      const response = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(response.body).to.have.property('success', false);
      expect(response.body.error).to.have.property('code', 'INVALID_TOKEN');
    });

    it('should reject verification with wrong header format', async function () {
      const response = await request(app)
        .post('/api/auth/verify')
        .set('Authorization', `Invalid ${validToken}`)
        .expect(400);

      expect(response.body).to.have.property('success', false);
    });
  });
});

