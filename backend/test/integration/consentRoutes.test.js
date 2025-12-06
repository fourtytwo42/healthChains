const { expect } = require('chai');
process.env.HARDHAT_NETWORK = process.env.HARDHAT_NETWORK || 'localhost';
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const request = require('supertest');
const express = require('express');
const cors = require('cors');

// Import services and routes
const web3Service = require('../../services/web3Service');
const {
  consentRouter,
  requestRouter,
  eventRouter
} = require('../../routes/consentRoutes');
const { errorHandler, notFoundHandler } = require('../../middleware/errorHandler');

describe('Consent Routes - Integration Tests', function () {
  this.timeout(60000); // 60 second timeout for entire suite
  
  let app;
  let consentManager;
  let owner, patient, provider, requester;
  let patientAddress, providerAddress, requesterAddress;

  // Create Express app for testing
  before(function () {
    this.timeout(10000); // 10 second timeout for setup
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api/consent', consentRouter);
    app.use('/api/requests', requestRouter);
    app.use('/api/events', eventRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);
  });

  // Deploy contract and get signers
  before(async function () {
    this.timeout(30000); // 30 second timeout for contract deployment
    [owner, patient, provider, requester] = await ethers.getSigners();
    patientAddress = await patient.getAddress();
    providerAddress = await provider.getAddress();
    requesterAddress = await requester.getAddress();

    const PatientConsentManager = await ethers.getContractFactory('PatientConsentManager');
    consentManager = await PatientConsentManager.deploy();
    await consentManager.waitForDeployment();

    // Initialize Web3 service with deployed contract
    process.env.CONTRACT_ADDRESS = await consentManager.getAddress();
    process.env.RPC_URL = 'http://127.0.0.1:8545';
    await web3Service.initialize();
  });

  describe('GET /api/consent/status', function () {
    it('should return false when no consent exists', async function () {
      const res = await request(app)
        .get('/api/consent/status')
        .query({
          patientAddress: patientAddress,
          providerAddress: providerAddress,
          dataType: 'medical_records'
        });

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.hasConsent).to.be.false;
      expect(res.body.data.consentId).to.be.null;
    });

    it('should return true when consent exists', async function () {
      // Grant consent
      const expirationTime = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
      await consentManager.connect(patient).grantConsent(
        providerAddress,
        'medical_records',
        expirationTime,
        'treatment'
      );

      const res = await request(app)
        .get('/api/consent/status')
        .query({
          patientAddress: patientAddress,
          providerAddress: providerAddress,
          dataType: 'medical_records'
        });

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.hasConsent).to.be.true;
      expect(res.body.data.consentId).to.not.be.null;
      expect(res.body.metadata).to.have.property('blockNumber');
    });

    it('should return 400 for missing patientAddress', async function () {
      const res = await request(app)
        .get('/api/consent/status')
        .query({
          providerAddress: providerAddress,
          dataType: 'medical_records'
        });

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
      expect(res.body.error.code).to.equal('MISSING_PARAMETER');
    });

    it('should return 400 for invalid address', async function () {
      const res = await request(app)
        .get('/api/consent/status')
        .query({
          patientAddress: 'invalid',
          providerAddress: providerAddress,
          dataType: 'medical_records'
        });

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
    });
  });

  describe('GET /api/consent/:consentId', function () {
    let consentId;

    before(async function () {
      // Create a consent for testing
      const latestBlock = await ethers.provider.getBlock('latest');
      const expirationTime = Number(latestBlock.timestamp) + 86400;
      const tx = await consentManager.connect(patient).grantConsent(
        providerAddress,
        'genetic_data',
        expirationTime,
        'research'
      );
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return consentManager.interface.parseLog(log).name === 'ConsentGranted';
        } catch {
          return false;
        }
      });
      if (event) {
        const parsed = consentManager.interface.parseLog(event);
        consentId = Number(parsed.args.consentId);
      }
    });

    it('should return consent record for valid ID', async function () {
      const res = await request(app)
        .get(`/api/consent/${consentId}`);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.consentId).to.equal(consentId);
      expect(res.body.data.patientAddress.toLowerCase()).to.equal(patientAddress.toLowerCase());
      expect(res.body.data.providerAddress.toLowerCase()).to.equal(providerAddress.toLowerCase());
      expect(res.body.data.dataType).to.equal('genetic_data');
    });

    it('should return 404 for non-existent consent', async function () {
      const res = await request(app)
        .get('/api/consent/99999');

      expect(res.status).to.equal(404);
      expect(res.body.success).to.be.false;
      expect(res.body.error.code).to.equal('NOT_FOUND');
    });

    it('should return 400 for invalid consentId', async function () {
      const res = await request(app)
        .get('/api/consent/invalid');

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
    });
  });

  describe('GET /api/consent/patient/:patientAddress', function () {
    it('should return array of consents for patient', async function () {
      const res = await request(app)
        .get(`/api/consent/patient/${patientAddress}`);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.be.an('array');
      expect(res.body.metadata).to.have.property('count');
    });

    it('should filter expired consents by default', async function () {
      // Create a consent that will expire soon
      const latestBlock = await ethers.provider.getBlock('latest');
      const expirationTime = Number(latestBlock.timestamp) + 60; // 1 minute ahead of chain time
      await consentManager.connect(patient).grantConsent(
        providerAddress,
        'imaging_data',
        expirationTime,
        'treatment'
      );

      // Fast-forward time beyond expiration (checkAndExpireConsents removed - expiration checked off-chain)
      await time.increaseTo(expirationTime + 120);

      const res = await request(app)
        .get(`/api/consent/patient/${patientAddress}`)
        .query({ includeExpired: 'false' });

      expect(res.status).to.equal(200);
      // Expired consent should be filtered out by service layer (off-chain check)
      const expiredConsents = res.body.data.filter(c => c.isExpired);
      expect(expiredConsents.length).to.equal(0);
    });

    it('should include expired consents when requested', async function () {
      const res = await request(app)
        .get(`/api/consent/patient/${patientAddress}`)
        .query({ includeExpired: 'true' });

      expect(res.status).to.equal(200);
      // Should include expired consents
      expect(res.body.data.length).to.be.greaterThan(0);
    });
  });

  describe('GET /api/requests/:requestId', function () {
    let requestId;

    before(async function () {
      // Create an access request
      const expirationTime = Math.floor(Date.now() / 1000) + 86400;
      const tx = await consentManager.connect(requester).requestAccess(
        patientAddress,
        'medical_records',
        'treatment',
        expirationTime
      );
      const receipt = await tx.wait();
      const events = await consentManager.queryFilter(
        consentManager.filters.AccessRequested(null, null, patientAddress),
        receipt.blockNumber,
        receipt.blockNumber
      );
      if (events && events.length > 0) {
        requestId = Number(events[0].args.requestId);
      } else {
        throw new Error('AccessRequested event not found');
      }
    });

    it('should return access request for valid ID', async function () {
      const res = await request(app)
        .get(`/api/requests/${requestId}`);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.requestId).to.equal(requestId);
      expect(res.body.data.requester.toLowerCase()).to.equal(requesterAddress.toLowerCase());
      expect(res.body.data.patientAddress.toLowerCase()).to.equal(patientAddress.toLowerCase());
      expect(res.body.data.status).to.equal('pending');
    });

    it('should return 404 for non-existent request', async function () {
      const res = await request(app)
        .get('/api/requests/99999');

      expect(res.status).to.equal(404);
      expect(res.body.success).to.be.false;
    });
  });

  describe('GET /api/requests/patient/:patientAddress', function () {
    it('should return array of requests for patient', async function () {
      const res = await request(app)
        .get(`/api/requests/patient/${patientAddress}`);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.be.an('array');
      expect(res.body.metadata).to.have.property('count');
    });

    it('should filter by status', async function () {
      // Approve a request
      const requests = await consentManager.getPatientRequests(patientAddress);
      if (requests.length > 0) {
        await consentManager.connect(patient).respondToAccessRequest(requests[0], true);
      }

      const res = await request(app)
        .get(`/api/requests/patient/${patientAddress}`)
        .query({ status: 'approved' });

      expect(res.status).to.equal(200);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].status).to.equal('approved');
      }
    });
  });

  describe('GET /api/events/consent', function () {
    it('should return consent events', async function () {
      const res = await request(app)
        .get('/api/events/consent');

      if (res.status !== 200) {
        console.error('Error response:', JSON.stringify(res.body, null, 2));
      }

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.be.an('array');
      expect(res.body.metadata).to.have.property('count');
    });

    it('should filter by patient address', async function () {
      const res = await request(app)
        .get('/api/events/consent')
        .query({ patientAddress: patientAddress });

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      // All events should be for this patient
      res.body.data.forEach(event => {
        expect(event.patient.toLowerCase()).to.equal(patientAddress.toLowerCase());
      });
    });

    it('should validate block range', async function () {
      const res = await request(app)
        .get('/api/events/consent')
        .query({ fromBlock: 100, toBlock: 50 });

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
    });
  });

  describe('GET /api/events/requests', function () {
    it('should return access request events', async function () {
      const res = await request(app)
        .get('/api/events/requests');

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.be.an('array');
    });

    it('should filter by patient address', async function () {
      const res = await request(app)
        .get('/api/events/requests')
        .query({ patientAddress: patientAddress });

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      // All events should be for this patient
      res.body.data.forEach(event => {
        if (event.patient) {
          expect(event.patient.toLowerCase()).to.equal(patientAddress.toLowerCase());
        }
      });
    });
  });
});

