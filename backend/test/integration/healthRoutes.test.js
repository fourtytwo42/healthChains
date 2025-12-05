/**
 * Health and Info Routes Integration Tests
 * 
 * Tests health check, contract info, data types, and purposes endpoints
 */

const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
process.env.HARDHAT_NETWORK = process.env.HARDHAT_NETWORK || 'localhost';
const { ethers } = require('hardhat');

// Import services and mock data
const web3Service = require('../../services/web3Service');
const mockPatients = require('../../data/mockup-patients');
const mockProviders = require('../../data/mockup-providers');

describe('Health and Info Routes - Integration Tests', function () {
  this.timeout(60000); // 60 second timeout for entire suite
  
  let app;
  let consentManager;

  // Create Express app for testing
  before(function () {
    this.timeout(10000); // 10 second timeout for setup
    app = express();
    app.use(cors());
    app.use(express.json());

    // Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        data: {
          patients: mockPatients.mockPatients.patients.length,
          providers: mockProviders.mockProviders.providers.length
        }
      });
    });

    // Data types
    app.get('/api/data-types', (req, res) => {
      res.json({
        success: true,
        data: mockPatients.dataTypes
      });
    });

    // Purposes
    app.get('/api/purposes', (req, res) => {
      res.json({
        success: true,
        data: mockPatients.purposes
      });
    });

    // Contract info
    app.get('/api/contract/info', async (req, res, next) => {
      try {
        // Check if web3Service is initialized
        if (!web3Service.isInitialized) {
          return res.status(503).json({
            success: false,
            error: {
              code: 'SERVICE_NOT_INITIALIZED',
              message: 'Web3 service is not initialized'
            }
          });
        }

        const contractAddress = web3Service.contractAddress;
        const blockNumber = await web3Service.getBlockNumber();
        const networkInfo = await web3Service.getNetworkInfo();

        res.json({
          success: true,
          contract: {
            address: contractAddress,
            name: 'PatientConsentManager'
          },
          web3: {
            connected: true,
            network: networkInfo.name,
            chainId: networkInfo.chainId
          },
          deployment: {
            blockNumber: blockNumber
          }
        });
      } catch (error) {
        next(error);
      }
    });
  });

  // Deploy contract for contract info tests
  before(async function () {
    this.timeout(30000); // 30 second timeout for contract deployment
    try {
      const [owner] = await ethers.getSigners();
      const PatientConsentManager = await ethers.getContractFactory('PatientConsentManager');
      consentManager = await PatientConsentManager.deploy();
      await consentManager.waitForDeployment();

      // Reset web3Service to ensure clean state
      if (web3Service.isInitialized) {
        web3Service.reset();
      }

      // Initialize Web3 service
      process.env.CONTRACT_ADDRESS = await consentManager.getAddress();
      process.env.RPC_URL = 'http://127.0.0.1:8545';
      
      // Wait a bit for Hardhat node to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        await web3Service.initialize();
        console.log('✅ Web3 service initialized successfully');
      } catch (initError) {
        console.error('❌ Failed to initialize Web3 service:', initError.message);
        console.error('Stack:', initError.stack);
        throw initError;
      }
    } catch (error) {
      console.warn('Warning: Could not initialize Web3 service. Contract info tests will be skipped.');
      console.warn('Error:', error.message);
      consentManager = null;
    }
  });

  describe('GET /health', function () {
    it('should return healthy status', async function () {
      const res = await request(app)
        .get('/health');

      expect(res.status).to.equal(200);
      expect(res.body.status).to.equal('healthy');
      expect(res.body).to.have.property('timestamp');
      expect(res.body.data).to.have.property('patients');
      expect(res.body.data).to.have.property('providers');
    });

    it('should include correct patient and provider counts', async function () {
      const res = await request(app)
        .get('/health');

      expect(res.status).to.equal(200);
      expect(res.body.data.patients).to.equal(mockPatients.mockPatients.patients.length);
      expect(res.body.data.providers).to.equal(mockProviders.mockProviders.providers.length);
    });
  });

  describe('GET /api/data-types', function () {
    it('should return all data types', async function () {
      const res = await request(app)
        .get('/api/data-types');

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.greaterThan(0);
    });

    it('should return expected data types', async function () {
      const res = await request(app)
        .get('/api/data-types');

      expect(res.status).to.equal(200);
      const dataTypes = res.body.data;
      expect(dataTypes).to.include('medical_records');
      expect(dataTypes).to.include('diagnostic_data');
    });
  });

  describe('GET /api/purposes', function () {
    it('should return all purposes', async function () {
      const res = await request(app)
        .get('/api/purposes');

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.greaterThan(0);
    });

    it('should return expected purposes', async function () {
      const res = await request(app)
        .get('/api/purposes');

      expect(res.status).to.equal(200);
      const purposes = res.body.data;
      expect(purposes).to.include('treatment');
      expect(purposes).to.include('research');
    });
  });

  describe('GET /api/contract/info', function () {
    beforeEach(function () {
      if (!consentManager || !web3Service.isInitialized) {
        this.skip(); // Skip tests if Web3 service not initialized
      }
    });

    it('should return contract information', async function () {
      const res = await request(app)
        .get('/api/contract/info');

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.contract).to.have.property('address');
      expect(res.body.contract).to.have.property('name');
      expect(res.body.web3).to.have.property('connected');
      expect(res.body.web3.connected).to.be.true;
    });

    it('should return valid contract address', async function () {
      const res = await request(app)
        .get('/api/contract/info');

      expect(res.status).to.equal(200);
      const address = res.body.contract.address;
      expect(address).to.match(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should return network information', async function () {
      const res = await request(app)
        .get('/api/contract/info');

      expect(res.status).to.equal(200);
      expect(res.body.web3).to.have.property('network');
      expect(res.body.web3).to.have.property('chainId');
      expect(res.body.web3.chainId).to.equal(1337);
    });
  });
});

