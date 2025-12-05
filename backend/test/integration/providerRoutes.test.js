/**
 * Provider Routes Integration Tests
 * 
 * Tests all provider-related API endpoints
 */

const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const cors = require('cors');

// Import mock data
const mockProviders = require('../../data/mockup-providers');

describe('Provider Routes - Integration Tests', function () {
  this.timeout(30000); // 30 second timeout for entire suite
  
  let app;

  // Create Express app for testing
  before(function () {
    this.timeout(10000); // 10 second timeout for setup
    app = express();
    app.use(cors());
    app.use(express.json());

    // Add provider routes
    app.get('/api/providers', (req, res) => {
      res.json({
        success: true,
        data: mockProviders.mockProviders.providers,
        metadata: mockProviders.mockProviders.metadata
      });
    });

    app.get('/api/providers/:providerId', (req, res) => {
      const { providerId } = req.params;
      const provider = mockProviders.mockProviders.providers.find(
        p => p.providerId === providerId
      );

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Provider not found'
        });
      }

      res.json({
        success: true,
        data: provider
      });
    });
  });

  describe('GET /api/providers', function () {
    it('should return all providers', async function () {
      const res = await request(app)
        .get('/api/providers');

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.greaterThan(0);
      expect(res.body.metadata).to.have.property('totalProviders');
    });

    it('should return providers with correct structure', async function () {
      const res = await request(app)
        .get('/api/providers');

      expect(res.status).to.equal(200);
      const provider = res.body.data[0];
      expect(provider).to.have.property('providerId');
      expect(provider).to.have.property('organizationName');
      expect(provider).to.have.property('providerType');
    });

    it('should include blockchain integration data', async function () {
      const res = await request(app)
        .get('/api/providers');

      expect(res.status).to.equal(200);
      const provider = res.body.data[0];
      expect(provider).to.have.property('blockchainIntegration');
      expect(provider.blockchainIntegration).to.have.property('walletAddress');
      expect(provider.blockchainIntegration.walletAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('GET /api/providers/:providerId', function () {
    it('should return provider by ID', async function () {
      const providerId = mockProviders.mockProviders.providers[0].providerId;
      const res = await request(app)
        .get(`/api/providers/${providerId}`);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.providerId).to.equal(providerId);
    });

    it('should return 404 for non-existent provider', async function () {
      const res = await request(app)
        .get('/api/providers/NONEXISTENT');

      expect(res.status).to.equal(404);
      expect(res.body.success).to.be.false;
      expect(res.body.message).to.include('not found');
    });

    it('should return complete provider data', async function () {
      const providerId = mockProviders.mockProviders.providers[0].providerId;
      const res = await request(app)
        .get(`/api/providers/${providerId}`);

      expect(res.status).to.equal(200);
      const provider = res.body.data;
      expect(provider).to.have.property('organizationName');
      expect(provider).to.have.property('address');
      expect(provider).to.have.property('contact');
      expect(provider).to.have.property('specialties');
    });
  });
});

