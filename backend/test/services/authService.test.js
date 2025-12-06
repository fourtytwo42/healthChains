const { expect } = require('chai');
const { ethers } = require('ethers');
const authService = require('../../services/authService');
const { ValidationError } = require('../../utils/errors');

describe('Auth Service', function () {
  this.timeout(10000);

  let testWallet;
  let testAddress;
  let testMessage;
  let testSignature;

  before(function () {
    // Create a test wallet
    testWallet = ethers.Wallet.createRandom();
    testAddress = testWallet.address;
    testMessage = 'HealthChains authentication message';
  });

  describe('JWT Token Generation', function () {
    it('should generate a valid JWT token', function () {
      const token = authService.generateToken(testAddress);
      expect(token).to.be.a('string');
      expect(token.split('.')).to.have.lengthOf(3); // JWT has 3 parts
    });

    it('should throw ValidationError for invalid address', function () {
      expect(() => authService.generateToken(null)).to.throw(ValidationError);
      expect(() => authService.generateToken('')).to.throw(ValidationError);
      expect(() => authService.generateToken('invalid')).to.throw(ValidationError);
    });
  });

  describe('JWT Token Verification', function () {
    it('should verify a valid token', function () {
      const token = authService.generateToken(testAddress);
      const decoded = authService.verifyToken(token);
      
      expect(decoded).to.have.property('address');
      expect(decoded.address.toLowerCase()).to.equal(testAddress.toLowerCase());
      expect(decoded).to.have.property('iat');
      expect(decoded).to.have.property('exp');
    });

    it('should throw ValidationError for invalid token', function () {
      expect(() => authService.verifyToken('invalid.token.here')).to.throw(ValidationError);
      expect(() => authService.verifyToken('')).to.throw(ValidationError);
      expect(() => authService.verifyToken(null)).to.throw(ValidationError);
    });

    it('should throw ValidationError for expired token', async function () {
      // Create a token with very short expiration (1 second)
      const originalExpiresIn = process.env.JWT_EXPIRES_IN;
      process.env.JWT_EXPIRES_IN = '1s';
      
      // Recreate auth service to pick up new env var
      delete require.cache[require.resolve('../../services/authService')];
      const tempAuthService = require('../../services/authService');
      
      const token = tempAuthService.generateToken(testAddress);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      expect(() => tempAuthService.verifyToken(token)).to.throw(ValidationError);
      
      // Restore original
      process.env.JWT_EXPIRES_IN = originalExpiresIn;
    });
  });

  describe('MetaMask Signature Verification', function () {
    before(async function () {
      // Sign message with test wallet
      testSignature = await testWallet.signMessage(testMessage);
    });

    it('should verify a valid signature', async function () {
      const isValid = await authService.verifySignature(
        testAddress,
        testSignature,
        testMessage
      );
      expect(isValid).to.be.true;
    });

    it('should throw ValidationError for wrong address', async function () {
      const wrongAddress = ethers.Wallet.createRandom().address;
      
      await expect(
        authService.verifySignature(wrongAddress, testSignature, testMessage)
      ).to.be.rejectedWith(ValidationError);
    });

    it('should throw ValidationError for invalid signature', async function () {
      const invalidSignature = '0x' + '1'.repeat(130);
      
      await expect(
        authService.verifySignature(testAddress, invalidSignature, testMessage)
      ).to.be.rejectedWith(ValidationError);
    });

    it('should throw ValidationError for missing parameters', async function () {
      await expect(
        authService.verifySignature(null, testSignature, testMessage)
      ).to.be.rejectedWith(ValidationError);
      
      await expect(
        authService.verifySignature(testAddress, null, testMessage)
      ).to.be.rejectedWith(ValidationError);
      
      await expect(
        authService.verifySignature(testAddress, testSignature, null)
      ).to.be.rejectedWith(ValidationError);
    });
  });

  describe('Login Flow', function () {
    it('should login with valid signature and return token', async function () {
      const signature = await testWallet.signMessage(testMessage);
      const timestamp = Math.floor(Date.now() / 1000);
      
      const result = await authService.login(testAddress, signature, testMessage, timestamp);
      
      expect(result).to.have.property('token');
      expect(result).to.have.property('address');
      expect(result).to.have.property('expiresIn');
      expect(result.address.toLowerCase()).to.equal(testAddress.toLowerCase());
      
      // Verify token is valid
      const decoded = authService.verifyToken(result.token);
      expect(decoded.address.toLowerCase()).to.equal(testAddress.toLowerCase());
    });

    it('should reject login with old timestamp', async function () {
      const signature = await testWallet.signMessage(testMessage);
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
      
      await expect(
        authService.login(testAddress, signature, testMessage, oldTimestamp)
      ).to.be.rejectedWith(ValidationError);
    });

    it('should reject login with future timestamp', async function () {
      const signature = await testWallet.signMessage(testMessage);
      const futureTimestamp = Math.floor(Date.now() / 1000) + 600; // 10 minutes in future
      
      await expect(
        authService.login(testAddress, signature, testMessage, futureTimestamp)
      ).to.be.rejectedWith(ValidationError);
    });
  });

  describe('Token Extraction', function () {
    it('should extract token from Authorization header', function () {
      const token = 'test-token-123';
      const header = `Bearer ${token}`;
      const extracted = authService.extractTokenFromHeader(header);
      expect(extracted).to.equal(token);
    });

    it('should return null for invalid header format', function () {
      expect(authService.extractTokenFromHeader('Invalid format')).to.be.null;
      expect(authService.extractTokenFromHeader('Bearer')).to.be.null;
      expect(authService.extractTokenFromHeader('')).to.be.null;
      expect(authService.extractTokenFromHeader(null)).to.be.null;
    });
  });
});

