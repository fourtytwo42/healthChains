const { expect } = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const chai = require('chai');
chai.use(sinonChai);

const consentService = require('../../services/consentService');
const { ValidationError, InvalidIdError, NotFoundError, ContractError } = require('../../utils/errors');
const { ethers } = require('ethers');

describe('ConsentService - Unit Tests', function () {
  this.timeout(30000); // 30 second timeout for entire suite
  let mockContract;
  let mockWeb3Service;

  beforeEach(function () {
    // Create mock contract
    mockContract = {
      getConsentRecord: sinon.stub(),
      getPatientConsents: sinon.stub(),
      getProviderConsents: sinon.stub(),
      isConsentExpired: sinon.stub(),
      getAccessRequest: sinon.stub(),
      getPatientRequests: sinon.stub(),
      queryFilter: sinon.stub(),
      filters: {
        ConsentGranted: sinon.stub().returns({}),
        ConsentRevoked: sinon.stub().returns({}),
        ConsentBatchGranted: sinon.stub().returns({}),
        AccessRequested: sinon.stub().returns({}),
        AccessApproved: sinon.stub().returns({}),
        AccessDenied: sinon.stub().returns({})
      }
    };

    // Mock web3Service
    mockWeb3Service = {
      getContract: sinon.stub().resolves(mockContract),
      getBlockNumber: sinon.stub().resolves(12345),
      getNetworkInfo: sinon.stub().resolves({ chainId: 1337, name: 'localhost' })
    };

    // Replace web3Service module
    const web3ServiceModule = require('../../services/web3Service');
    sinon.stub(web3ServiceModule, 'initialize').callsFake(async () => {
      web3ServiceModule.isInitialized = true;
    });
    sinon.stub(web3ServiceModule, 'getContract').callsFake(() => mockWeb3Service.getContract());
    sinon.stub(web3ServiceModule, 'getBlockNumber').callsFake(() => mockWeb3Service.getBlockNumber());
    sinon.stub(web3ServiceModule, 'getNetworkInfo').callsFake(() => mockWeb3Service.getNetworkInfo());

    // Reset service contract reference
    consentService.contract = null;
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('getConsentStatus', function () {
    it('should return consent status when consent exists (event-based)', async function () {
      const patientAddress = '0x1234567890123456789012345678901234567890';
      const providerAddress = '0x0987654321098765432109876543210987654321';
      const dataType = 'medical_records';

      // Mock event-based lookup (now uses getConsentEvents instead of hasActiveConsent)
      const mockGrantedEvent = {
        type: 'ConsentGranted',
        consentId: 1,
        patient: patientAddress,
        provider: providerAddress,
        dataType: dataType,
        dataTypes: [dataType],
        timestamp: new Date().toISOString(),
        expirationTime: null
      };

      mockContract.queryFilter.onFirstCall().resolves([mockGrantedEvent]);
      mockContract.queryFilter.onSecondCall().resolves([]); // No revoked events

      const result = await consentService.getConsentStatus(patientAddress, providerAddress, dataType);

      expect(result).to.have.property('hasConsent', true);
      expect(result).to.have.property('consentId', 1);
      expect(mockContract.queryFilter).to.have.been.called;
    });

    it('should return false when no consent exists', async function () {
      const patientAddress = '0x1234567890123456789012345678901234567890';
      const providerAddress = '0x0987654321098765432109876543210987654321';
      const dataType = 'medical_records';

      // No events found
      mockContract.queryFilter.onFirstCall().resolves([]);
      mockContract.queryFilter.onSecondCall().resolves([]);

      const result = await consentService.getConsentStatus(patientAddress, providerAddress, dataType);

      expect(result).to.have.property('hasConsent', false);
      expect(result).to.have.property('consentId', null);
    });

    it('should throw ValidationError for invalid patient address', async function () {
      await expect(
        consentService.getConsentStatus('invalid', '0x0987654321098765432109876543210987654321', 'medical_records')
      ).to.be.rejectedWith(ValidationError);
    });

    it('should throw ValidationError for invalid provider address', async function () {
      await expect(
        consentService.getConsentStatus('0x1234567890123456789012345678901234567890', 'invalid', 'medical_records')
      ).to.be.rejectedWith(ValidationError);
    });

    it('should throw ValidationError for empty dataType', async function () {
      await expect(
        consentService.getConsentStatus(
          '0x1234567890123456789012345678901234567890',
          '0x0987654321098765432109876543210987654321',
          ''
        )
      ).to.be.rejectedWith(ValidationError);
    });
  });

  describe('getConsentRecord', function () {
    it('should return transformed consent record', async function () {
      const consentId = 1;
      const mockRecord = {
        patientAddress: '0x1234567890123456789012345678901234567890',
        providerAddress: '0x0987654321098765432109876543210987654321',
        timestamp: 1000000n,
        expirationTime: 0n,
        isActive: true,
        dataType: 'medical_records',
        purpose: 'treatment'
      };

      mockContract.getConsentRecord.resolves(mockRecord);

      const result = await consentService.getConsentRecord(consentId);

      expect(result).to.have.property('consentId', consentId);
      expect(result).to.have.property('patientAddress');
      expect(result).to.have.property('providerAddress');
      expect(result).to.have.property('timestamp');
      expect(result.timestamp).to.be.a('string'); // ISO string
      expect(mockContract.getConsentRecord).to.have.been.calledWith(consentId);
    });

    it('should throw InvalidIdError for invalid consentId', async function () {
      await expect(consentService.getConsentRecord(-1)).to.be.rejectedWith(InvalidIdError);
      await expect(consentService.getConsentRecord('invalid')).to.be.rejectedWith(InvalidIdError);
      await expect(consentService.getConsentRecord(1.5)).to.be.rejectedWith(InvalidIdError);
    });

    it('should throw NotFoundError when consent does not exist', async function () {
      mockContract.getConsentRecord.rejects({ code: 'CALL_EXCEPTION', reason: 'ConsentNotFound()' });

      await expect(consentService.getConsentRecord(999)).to.be.rejectedWith(NotFoundError);
    });
  });

  describe('getPatientConsents', function () {
    it('should return array of consent records', async function () {
      const patientAddress = '0x1234567890123456789012345678901234567890';
      const mockConsentIds = [1n, 2n, 3n];
      const mockRecord = {
        patientAddress: patientAddress,
        providerAddress: '0x0987654321098765432109876543210987654321',
        timestamp: 1000000n,
        expirationTime: 0n,
        isActive: true,
        dataType: 'medical_records',
        purpose: 'treatment'
      };

      mockContract.getPatientConsents.resolves(mockConsentIds);
      mockContract.getConsentRecord.resolves(mockRecord);

      const result = await consentService.getPatientConsents(patientAddress);

      expect(result).to.be.an('array');
      expect(result.length).to.equal(3);
      expect(mockContract.getPatientConsents).to.have.been.calledOnce;
    });

    it('should filter expired consents when includeExpired is false', async function () {
      const patientAddress = '0x1234567890123456789012345678901234567890';
      const mockConsentIds = [1n];
      const expiredTime = Math.floor(Date.now() / 1000) - 86400; // 1 day ago
      const mockRecord = {
        patientAddress: patientAddress,
        providerAddress: '0x0987654321098765432109876543210987654321',
        timestamp: 1000000n,
        expirationTime: BigInt(expiredTime),
        isActive: false,
        dataType: 'medical_records',
        purpose: 'treatment'
      };

      mockContract.getPatientConsents.resolves(mockConsentIds);
      mockContract.getConsentRecord.resolves(mockRecord);

      const result = await consentService.getPatientConsents(patientAddress, false);

      expect(result).to.be.an('array');
      expect(result.length).to.equal(0); // Expired consent filtered out
    });

    it('should throw ValidationError for invalid address', async function () {
      await expect(consentService.getPatientConsents('invalid')).to.be.rejectedWith(ValidationError);
    });
  });

  describe('getAccessRequest', function () {
    it('should return transformed access request', async function () {
      const requestId = 1;
      const mockRequest = {
        requester: '0x1111111111111111111111111111111111111111',
        patientAddress: '0x1234567890123456789012345678901234567890',
        timestamp: 1000000n,
        expirationTime: 0n,
        isProcessed: false,
        status: 0, // Pending
        dataType: 'medical_records',
        purpose: 'treatment'
      };

      mockContract.getAccessRequest.resolves(mockRequest);

      const result = await consentService.getAccessRequest(requestId);

      expect(result).to.have.property('requestId', requestId);
      expect(result).to.have.property('status', 'pending');
      expect(result).to.have.property('requester');
      expect(mockContract.getAccessRequest).to.have.been.calledWith(requestId);
    });

    it('should throw InvalidIdError for invalid requestId', async function () {
      await expect(consentService.getAccessRequest(-1)).to.be.rejectedWith(InvalidIdError);
    });

    it('should throw NotFoundError when request does not exist', async function () {
      mockContract.getAccessRequest.rejects({ code: 'CALL_EXCEPTION', reason: 'RequestNotFound()' });

      await expect(consentService.getAccessRequest(999)).to.be.rejectedWith(NotFoundError);
    });
  });

  describe('getPatientRequests', function () {
    it('should return array of access requests', async function () {
      const patientAddress = '0x1234567890123456789012345678901234567890';
      const mockRequestIds = [1n, 2n];
      const mockRequest = {
        requester: '0x1111111111111111111111111111111111111111',
        patientAddress: patientAddress,
        timestamp: 1000000n,
        expirationTime: 0n,
        isProcessed: false,
        status: 0, // Pending
        dataType: 'medical_records',
        purpose: 'treatment'
      };

      mockContract.getPatientRequests.resolves(mockRequestIds);
      mockContract.getAccessRequest.resolves(mockRequest);

      const result = await consentService.getPatientRequests(patientAddress);

      expect(result).to.be.an('array');
      expect(result.length).to.equal(2);
    });

    it('should filter by status', async function () {
      const patientAddress = '0x1234567890123456789012345678901234567890';
      const mockRequestIds = [1n, 2n];
      const pendingRequest = {
        requester: '0x1111111111111111111111111111111111111111',
        patientAddress: patientAddress,
        timestamp: 1000000n,
        expirationTime: 0n,
        isProcessed: false,
        status: 0, // Pending
        dataType: 'medical_records',
        purpose: 'treatment'
      };
      const approvedRequest = {
        requester: '0x1111111111111111111111111111111111111111',
        patientAddress: patientAddress,
        timestamp: 1000000n,
        expirationTime: 0n,
        isProcessed: true,
        status: 1, // Approved
        dataType: 'medical_records',
        purpose: 'treatment'
      };

      mockContract.getPatientRequests.resolves(mockRequestIds);
      mockContract.getAccessRequest.onFirstCall().resolves(pendingRequest);
      mockContract.getAccessRequest.onSecondCall().resolves(approvedRequest);

      const result = await consentService.getPatientRequests(patientAddress, 'pending');

      expect(result).to.be.an('array');
      expect(result.length).to.equal(1);
      expect(result[0].status).to.equal('pending');
    });

    it('should throw ValidationError for invalid status', async function () {
      await expect(
        consentService.getPatientRequests('0x1234567890123456789012345678901234567890', 'invalid')
      ).to.be.rejectedWith(ValidationError);
    });
  });

  describe('getConsentEvents', function () {
    it('should return array of consent events', async function () {
      const patientAddress = '0x1234567890123456789012345678901234567890';
      const mockGrantedEvent = {
        blockNumber: 100,
        transactionHash: '0xabc123',
        args: {
          consentId: 1n,
          patient: patientAddress,
          provider: '0x0987654321098765432109876543210987654321',
          dataType: 'medical_records',
          expirationTime: 0n,
          purpose: 'treatment',
          timestamp: 1000000n
        }
      };

      mockContract.queryFilter.onFirstCall().resolves([mockGrantedEvent]);
      mockContract.queryFilter.onSecondCall().resolves([]);

      const result = await consentService.getConsentEvents(patientAddress);

      expect(result).to.be.an('array');
      expect(result.length).to.equal(1);
      expect(result[0]).to.have.property('type', 'ConsentGranted');
    });

    it('should validate block range', async function () {
      await expect(
        consentService.getConsentEvents(null, 100, 50) // fromBlock > toBlock
      ).to.be.rejectedWith(ValidationError);

      await expect(
        consentService.getConsentEvents(null, 0, 20000) // Range too large
      ).to.be.rejectedWith(ValidationError);
    });
  });

  describe('getAccessRequestEvents', function () {
    it('should return array of access request events', async function () {
      const patientAddress = '0x1234567890123456789012345678901234567890';
      const mockRequestedEvent = {
        blockNumber: 100,
        transactionHash: '0xabc123',
        args: {
          requestId: 1n,
          requester: '0x1111111111111111111111111111111111111111',
          patient: patientAddress,
          dataType: 'medical_records',
          purpose: 'treatment',
          expirationTime: 0n,
          timestamp: 1000000n
        }
      };

      mockContract.queryFilter.onFirstCall().resolves([mockRequestedEvent]);
      mockContract.queryFilter.onSecondCall().resolves([]);
      mockContract.queryFilter.onThirdCall().resolves([]);

      const result = await consentService.getAccessRequestEvents(patientAddress);

      expect(result).to.be.an('array');
      expect(result.length).to.equal(1);
      expect(result[0]).to.have.property('type', 'AccessRequested');
    });
  });
});

