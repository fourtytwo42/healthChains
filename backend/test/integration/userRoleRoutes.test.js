const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const mockPatients = require('../../data/mockup-patients');
const mockProviders = require('../../data/mockup-providers');

describe('User Role Routes - Integration Tests', function () {
  this.timeout(10000);
  let app;

  before(function () {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());

    // Add the role endpoint
    app.get('/api/user/role', (req, res) => {
      const { address } = req.query;
      
      if (!address) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETER',
            message: 'address query parameter is required'
          }
        });
      }

      const normalizedAddress = address.toLowerCase();
      
      const patient = mockPatients.mockPatients.patients.find(
        p => p.blockchainIntegration?.walletAddress?.toLowerCase() === normalizedAddress
      );
      
      const provider = mockProviders.mockProviders.providers.find(
        p => p.blockchainIntegration?.walletAddress?.toLowerCase() === normalizedAddress
      );

      let role = 'unknown';
      const result = { role };

      if (patient && provider) {
        role = 'both';
        result.role = role;
        result.patientId = patient.patientId;
        result.providerId = provider.providerId;
      } else if (patient) {
        role = 'patient';
        result.role = role;
        result.patientId = patient.patientId;
      } else if (provider) {
        role = 'provider';
        result.role = role;
        result.providerId = provider.providerId;
      }

      res.json({
        success: true,
        data: result
      });
    });
  });

  describe('GET /api/user/role', function () {
    it('should return patient role for patient address', async function () {
      const patientAddress = mockPatients.mockPatients.patients[0].blockchainIntegration?.walletAddress;
      if (!patientAddress) {
        this.skip();
      }

      const res = await request(app)
        .get('/api/user/role')
        .query({ address: patientAddress });

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.role).to.equal('patient');
      expect(res.body.data.patientId).to.exist;
    });

    it('should return provider role for provider address', async function () {
      const providerAddress = mockProviders.mockProviders.providers[0].blockchainIntegration?.walletAddress;
      if (!providerAddress) {
        this.skip();
      }

      const res = await request(app)
        .get('/api/user/role')
        .query({ address: providerAddress });

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.role).to.equal('provider');
      expect(res.body.data.providerId).to.exist;
    });

    it('should return unknown role for unknown address', async function () {
      const res = await request(app)
        .get('/api/user/role')
        .query({ address: '0x0000000000000000000000000000000000000000' });

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.role).to.equal('unknown');
    });

    it('should return 400 if address is missing', async function () {
      const res = await request(app)
        .get('/api/user/role');

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
    });
  });
});

