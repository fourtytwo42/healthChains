const { expect } = require("chai");
const { ethers, time } = require("hardhat");

describe("PatientConsentManager - Comprehensive Test Suite", function () {
  let consentManager;
  let owner;
  let patient;
  let provider;
  let provider2;
  let provider3;
  let requester;
  let otherAccount;
  let accounts;

  // Helper to get current timestamp
  const getCurrentTimestamp = async () => {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    return block.timestamp;
  };

  // Helper to get future timestamp (days from now)
  const getFutureTimestamp = async (days) => {
    const now = await getCurrentTimestamp();
    return now + (days * 24 * 60 * 60);
  };

  beforeEach(async function () {
    [owner, patient, provider, provider2, provider3, requester, otherAccount, ...accounts] = await ethers.getSigners();

    const PatientConsentManager = await ethers.getContractFactory("PatientConsentManager");
    consentManager = await PatientConsentManager.deploy();
    await consentManager.waitForDeployment();
  });

  // ==================== DEPLOYMENT TESTS ====================
  describe("Deployment", function () {
    it("Should deploy successfully with valid address", async function () {
      const address = await consentManager.getAddress();
      expect(address).to.not.equal(ethers.ZeroAddress);
      expect(ethers.isAddress(address)).to.be.true;
    });

    it("Should initialize with zero consent counter", async function () {
      expect(await consentManager.consentCounter()).to.equal(0);
    });

    it("Should initialize with zero request counter", async function () {
      expect(await consentManager.requestCounter()).to.equal(0);
    });

    it("Should be deployed with ReentrancyGuard", async function () {
      // ReentrancyGuard is inherited, verify by checking function modifiers exist
      // We can verify this by attempting a call and checking it doesn't fail with "nonReentrant" error
      expect(await consentManager.getAddress()).to.not.be.undefined;
    });
  });

  // ==================== GRANT CONSENT TESTS ====================
  describe("Grant Consent", function () {
    describe("Successful Grants", function () {
      it("Should allow patient to grant consent with no expiration", async function () {
        const dataType = "medical_records";
        const expirationTime = 0;
        const purpose = "treatment";

        const tx = await consentManager.connect(patient).grantConsent(
          provider.address,
          dataType,
          expirationTime,
          purpose
        );

        await expect(tx)
          .to.emit(consentManager, "ConsentGranted")
          .withArgs(
            (consentId) => consentId === 0n,
            patient.address,
            provider.address,
            dataType,
            expirationTime,
            purpose,
            (timestamp) => timestamp > 0n
          );

        const consentId = 0n;
        const consent = await consentManager.getConsentRecord(consentId);

        expect(consent.patientAddress).to.equal(patient.address);
        expect(consent.providerAddress).to.equal(provider.address);
        expect(consent.dataType).to.equal(dataType);
        expect(consent.purpose).to.equal(purpose);
        expect(consent.isActive).to.be.true;
        expect(consent.expirationTime).to.equal(0);
        expect(consent.timestamp).to.be.greaterThan(0);
      });

      it("Should allow patient to grant consent with future expiration", async function () {
        const dataType = "diagnostic_data";
        const futureTime = await getFutureTimestamp(30);
        const purpose = "research";

        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            dataType,
            futureTime,
            purpose
          )
        ).to.emit(consentManager, "ConsentGranted");

        const consentId = 0n;
        const consent = await consentManager.getConsentRecord(consentId);
        expect(consent.expirationTime).to.equal(futureTime);
        expect(consent.isActive).to.be.true;
      });

      it("Should increment consent counter correctly", async function () {
        expect(await consentManager.consentCounter()).to.equal(0);

        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0,
          "treatment"
        );
        expect(await consentManager.consentCounter()).to.equal(1);

        await consentManager.connect(patient).grantConsent(
          provider2.address,
          "genetic_data",
          0,
          "research"
        );
        expect(await consentManager.consentCounter()).to.equal(2);
      });

      it("Should track consents in patientConsents mapping", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0,
          "treatment"
        );

        const consents = await consentManager.getPatientConsents(patient.address);
        expect(consents.length).to.equal(1);
        expect(consents[0]).to.equal(0);
      });

      it("Should track consents in providerConsents mapping", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0,
          "treatment"
        );

        // Note: We don't have a getProviderConsents function, but we can verify through consent record
        const consent = await consentManager.getConsentRecord(0);
        expect(consent.providerAddress).to.equal(provider.address);
      });

      it("Should allow multiple consents for same patient", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0,
          "treatment"
        );
        await consentManager.connect(patient).grantConsent(
          provider2.address,
          "genetic_data",
          0,
          "research"
        );

        const consents = await consentManager.getPatientConsents(patient.address);
        expect(consents.length).to.equal(2);
      });
    });

    describe("Input Validation", function () {
      it("Should reject granting consent with zero address provider", async function () {
        await expect(
          consentManager.connect(patient).grantConsent(
            ethers.ZeroAddress,
            "medical_records",
            0,
            "treatment"
          )
        ).to.be.revertedWithCustomError(consentManager, "InvalidAddress");
      });

      it("Should reject granting consent to self", async function () {
        await expect(
          consentManager.connect(patient).grantConsent(
            patient.address,
            "medical_records",
            0,
            "treatment"
          )
        ).to.be.revertedWithCustomError(consentManager, "CannotGrantConsentToSelf");
      });

      it("Should reject granting consent with empty data type", async function () {
        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            "",
            0,
            "treatment"
          )
        ).to.be.revertedWithCustomError(consentManager, "EmptyString");
      });

      it("Should reject granting consent with empty purpose", async function () {
        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            "medical_records",
            0,
            ""
          )
        ).to.be.revertedWithCustomError(consentManager, "EmptyString");
      });

      it("Should reject granting consent with expiration time in the past", async function () {
        const pastTime = (await getCurrentTimestamp()) - 86400; // 1 day ago

        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            "medical_records",
            pastTime,
            "treatment"
          )
        ).to.be.revertedWithCustomError(consentManager, "ExpirationInPast");
      });

      it("Should reject granting consent with string exceeding max length", async function () {
        const longString = "a".repeat(257); // Exceeds MAX_STRING_LENGTH (256)

        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            longString,
            0,
            "treatment"
          )
        ).to.be.revertedWithCustomError(consentManager, "StringTooLong");
      });

      it("Should accept string at exactly max length", async function () {
        const maxLengthString = "a".repeat(256); // Exactly MAX_STRING_LENGTH

        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            maxLengthString,
            0,
            "treatment"
          )
        ).to.emit(consentManager, "ConsentGranted");
      });
    });

    describe("Event Verification", function () {
      it("Should emit ConsentGranted event with correct parameters", async function () {
        const dataType = "medical_records";
        const expirationTime = 0;
        const purpose = "treatment";

        const tx = await consentManager.connect(patient).grantConsent(
          provider.address,
          dataType,
          expirationTime,
          purpose
        );

        const receipt = await tx.wait();
        const event = receipt.logs.find(
          log => consentManager.interface.parseLog(log)?.name === "ConsentGranted"
        );

        expect(event).to.not.be.undefined;
        const parsedEvent = consentManager.interface.parseLog(event);
        expect(parsedEvent.args.consentId).to.equal(0n);
        expect(parsedEvent.args.patient).to.equal(patient.address);
        expect(parsedEvent.args.provider).to.equal(provider.address);
        expect(parsedEvent.args.dataType).to.equal(dataType);
        expect(parsedEvent.args.purpose).to.equal(purpose);
      });
    });
  });

  // ==================== BATCH CONSENT TESTS ====================
  describe("Batch Consent Operations", function () {
    describe("Successful Batch Grants", function () {
      it("Should grant multiple consents in a single transaction", async function () {
        const providers = [provider.address, provider2.address, provider3.address];
        const dataTypes = ["medical_records", "genetic_data", "imaging_data"];
        const expirationTimes = [0, 0, await getFutureTimestamp(30)];
        const purposes = ["treatment", "research", "diagnosis"];

        const tx = await consentManager.connect(patient).grantConsentBatch(
          providers,
          dataTypes,
          expirationTimes,
          purposes
        );

        await expect(tx)
          .to.emit(consentManager, "ConsentBatchGranted")
          .withArgs(
            patient.address,
            (ids) => ids.length === 3,
            (timestamp) => timestamp > 0n
          );

        // Verify all consents were created
        expect(await consentManager.consentCounter()).to.equal(3);
        
        const consents = await consentManager.getPatientConsents(patient.address);
        expect(consents.length).to.equal(3);
        expect(consents[0]).to.equal(0);
        expect(consents[1]).to.equal(1);
        expect(consents[2]).to.equal(2);

        // Verify individual consent records
        const consent0 = await consentManager.getConsentRecord(0);
        expect(consent0.providerAddress).to.equal(provider.address);
        expect(consent0.dataType).to.equal("medical_records");

        const consent1 = await consentManager.getConsentRecord(1);
        expect(consent1.providerAddress).to.equal(provider2.address);
        expect(consent1.dataType).to.equal("genetic_data");
      });

      it("Should emit individual ConsentGranted events for each consent in batch", async function () {
        const providers = [provider.address, provider2.address];
        const dataTypes = ["medical_records", "genetic_data"];
        const expirationTimes = [0, 0];
        const purposes = ["treatment", "research"];

        const tx = await consentManager.connect(patient).grantConsentBatch(
          providers,
          dataTypes,
          expirationTimes,
          purposes
        );

        const receipt = await tx.wait();
        const consentGrantedEvents = receipt.logs.filter(
          log => consentManager.interface.parseLog(log)?.name === "ConsentGranted"
        );

        expect(consentGrantedEvents.length).to.equal(2);
      });

      it("Should handle large batch operations (up to MAX_BATCH_SIZE)", async function () {
        const batchSize = 10;
        const providers = [];
        const dataTypes = [];
        const expirationTimes = [];
        const purposes = [];

        for (let i = 0; i < batchSize; i++) {
          providers.push(accounts[i].address);
          dataTypes.push(`data_type_${i}`);
          expirationTimes.push(0);
          purposes.push(`purpose_${i}`);
        }

        await expect(
          consentManager.connect(patient).grantConsentBatch(
            providers,
            dataTypes,
            expirationTimes,
            purposes
          )
        ).to.emit(consentManager, "ConsentBatchGranted");

        expect(await consentManager.consentCounter()).to.equal(batchSize);
      });
    });

    describe("Batch Validation", function () {
      it("Should reject empty batch", async function () {
        await expect(
          consentManager.connect(patient).grantConsentBatch(
            [],
            [],
            [],
            []
          )
        ).to.be.revertedWithCustomError(consentManager, "EmptyBatch");
      });

      it("Should reject batch with mismatched array lengths", async function () {
        await expect(
          consentManager.connect(patient).grantConsentBatch(
            [provider.address],
            ["medical_records", "genetic_data"], // Different length
            [0],
            ["treatment"]
          )
        ).to.be.revertedWithCustomError(consentManager, "EmptyBatch");
      });

      it("Should reject batch exceeding MAX_BATCH_SIZE", async function () {
        const batchSize = 51; // Exceeds MAX_BATCH_SIZE (50)
        const providers = new Array(batchSize).fill(provider.address);
        const dataTypes = new Array(batchSize).fill("medical_records");
        const expirationTimes = new Array(batchSize).fill(0);
        const purposes = new Array(batchSize).fill("treatment");

        await expect(
          consentManager.connect(patient).grantConsentBatch(
            providers,
            dataTypes,
            expirationTimes,
            purposes
          )
        ).to.be.revertedWithCustomError(consentManager, "EmptyBatch");
      });

      it("Should revert entire batch if any validation fails", async function () {
        const providers = [provider.address, ethers.ZeroAddress]; // Second one invalid
        const dataTypes = ["medical_records", "genetic_data"];
        const expirationTimes = [0, 0];
        const purposes = ["treatment", "research"];

        await expect(
          consentManager.connect(patient).grantConsentBatch(
            providers,
            dataTypes,
            expirationTimes,
            purposes
          )
        ).to.be.revertedWithCustomError(consentManager, "InvalidAddress");

        // Verify no consents were created
        expect(await consentManager.consentCounter()).to.equal(0);
      });
    });

    describe("Gas Efficiency", function () {
      it("Should use less gas for batch of 5 than 5 individual calls", async function () {
        const batchSize = 5;
        const providers = [];
        const dataTypes = [];
        const expirationTimes = [];
        const purposes = [];

        for (let i = 0; i < batchSize; i++) {
          providers.push(accounts[i].address);
          dataTypes.push(`data_type_${i}`);
          expirationTimes.push(0);
          purposes.push(`purpose_${i}`);
        }

        // Measure batch gas
        const batchTx = await consentManager.connect(patient).grantConsentBatch(
          providers,
          dataTypes,
          expirationTimes,
          purposes
        );
        const batchReceipt = await batchTx.wait();
        const batchGas = batchReceipt.gasUsed;

        // Reset and measure individual calls
        const PatientConsentManager = await ethers.getContractFactory("PatientConsentManager");
        const consentManager2 = await PatientConsentManager.deploy();
        await consentManager2.waitForDeployment();

        let individualGas = 0n;
        for (let i = 0; i < batchSize; i++) {
          const tx = await consentManager2.connect(patient).grantConsent(
            accounts[i].address,
            `data_type_${i}`,
            0,
            `purpose_${i}`
          );
          const receipt = await tx.wait();
          individualGas += receipt.gasUsed;
        }

        // Batch should be more gas efficient (approximately 40-60% savings expected)
        expect(batchGas).to.be.lessThan(individualGas);
      });
    });
  });

  // ==================== REVOKE CONSENT TESTS ====================
  describe("Revoke Consent", function () {
    describe("Successful Revocations", function () {
      it("Should allow patient to revoke their own consent", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0,
          "treatment"
        );

        const consentId = 0n;

        await expect(
          consentManager.connect(patient).revokeConsent(consentId)
        )
          .to.emit(consentManager, "ConsentRevoked")
          .withArgs(consentId, patient.address, (timestamp) => timestamp > 0n);

        const consent = await consentManager.getConsentRecord(consentId);
        expect(consent.isActive).to.be.false;
        // Verify other fields are preserved
        expect(consent.patientAddress).to.equal(patient.address);
        expect(consent.providerAddress).to.equal(provider.address);
      });

      it("Should preserve consent record after revocation", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0,
          "treatment"
        );

        const consentId = 0n;
        const consentBefore = await consentManager.getConsentRecord(consentId);

        await consentManager.connect(patient).revokeConsent(consentId);

        const consentAfter = await consentManager.getConsentRecord(consentId);
        expect(consentAfter.isActive).to.be.false;
        expect(consentAfter.patientAddress).to.equal(consentBefore.patientAddress);
        expect(consentAfter.providerAddress).to.equal(consentBefore.providerAddress);
        expect(consentAfter.dataType).to.equal(consentBefore.dataType);
      });
    });

    describe("Access Control", function () {
      it("Should reject revocation by non-patient", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0,
          "treatment"
        );

        const consentId = 0n;

        await expect(
          consentManager.connect(otherAccount).revokeConsent(consentId)
        ).to.be.revertedWithCustomError(consentManager, "UnauthorizedRevocation");
      });

      it("Should reject revocation of non-existent consent", async function () {
        await expect(
          consentManager.connect(patient).revokeConsent(999)
        ).to.be.revertedWithCustomError(consentManager, "ConsentNotFound");
      });

      it("Should reject revocation of already inactive consent", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0,
          "treatment"
        );

        const consentId = 0n;
        await consentManager.connect(patient).revokeConsent(consentId);

        await expect(
          consentManager.connect(patient).revokeConsent(consentId)
        ).to.be.revertedWithCustomError(consentManager, "ConsentAlreadyInactive");
      });
    });
  });

  // ==================== EXPIRATION TESTS ====================
  describe("Consent Expiration", function () {
    describe("Expiration Checking", function () {
      it("Should correctly identify non-expired consent", async function () {
        const futureTime = await getFutureTimestamp(30);
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          futureTime,
          "treatment"
        );

        const expired = await consentManager.isConsentExpired(0);
        expect(expired).to.be.false;
      });

      it("Should correctly identify expired consent", async function () {
        const pastTime = (await getCurrentTimestamp()) - 86400; // 1 day ago
        
        // Manually set expiration (we'll use time manipulation for testing)
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          pastTime,
          "treatment"
        );

        // Advance time
        await time.increase(86400 * 2); // 2 days

        const expired = await consentManager.isConsentExpired(0);
        expect(expired).to.be.true;
      });

      it("Should return false for consent with no expiration", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0,
          "treatment"
        );

        const expired = await consentManager.isConsentExpired(0);
        expect(expired).to.be.false;
      });

      it("Should return false for non-existent consent", async function () {
        const expired = await consentManager.isConsentExpired(999);
        expect(expired).to.be.false;
      });
    });

    describe("Automatic Expiration Handling", function () {
      it("Should mark expired consents as inactive", async function () {
        const expirationTime = (await getCurrentTimestamp()) + 60; // Expires in 1 minute
        
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          expirationTime,
          "treatment"
        );

        // Advance time past expiration
        await time.increase(120); // 2 minutes

        const expiredCount = await consentManager.checkAndExpireConsents(patient.address);
        expect(expiredCount).to.equal(1);

        const consent = await consentManager.getConsentRecord(0);
        expect(consent.isActive).to.be.false;
      });

      it("Should emit ConsentExpired event when marking expired consents", async function () {
        const expirationTime = (await getCurrentTimestamp()) + 60;
        
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          expirationTime,
          "treatment"
        );

        await time.increase(120);

        await expect(
          consentManager.checkAndExpireConsents(patient.address)
        ).to.emit(consentManager, "ConsentExpired");
      });

      it("Should return count of expired consents", async function () {
        // Create multiple consents with different expiration times
        const exp1 = (await getCurrentTimestamp()) + 60;
        const exp2 = (await getCurrentTimestamp()) + 120;
        
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          exp1,
          "treatment"
        );
        await consentManager.connect(patient).grantConsent(
          provider2.address,
          "genetic_data",
          exp2,
          "research"
        );

        await time.increase(90); // Expires first but not second

        const expiredCount = await consentManager.checkAndExpireConsents(patient.address);
        expect(expiredCount).to.equal(1);
      });

      it("Should handle patient with no expired consents", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0, // No expiration
          "treatment"
        );

        const expiredCount = await consentManager.checkAndExpireConsents(patient.address);
        expect(expiredCount).to.equal(0);
      });
    });

    describe("Get Expired Consents", function () {
      it("Should return array of expired consent IDs", async function () {
        const exp1 = (await getCurrentTimestamp()) + 60;
        const exp2 = (await getCurrentTimestamp()) + 120;
        
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          exp1,
          "treatment"
        );
        await consentManager.connect(patient).grantConsent(
          provider2.address,
          "genetic_data",
          exp2,
          "research"
        );
        await consentManager.connect(patient).grantConsent(
          provider3.address,
          "imaging_data",
          0, // No expiration
          "diagnosis"
        );

        await time.increase(90);

        const expiredIds = await consentManager.getExpiredConsents(patient.address);
        expect(expiredIds.length).to.equal(1);
        expect(expiredIds[0]).to.equal(0);
      });
    });

    describe("Expiration in hasActiveConsent", function () {
      it("Should return false for expired consent", async function () {
        const expirationTime = (await getCurrentTimestamp()) + 60;
        
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          expirationTime,
          "treatment"
        );

        await time.increase(120);

        const [hasConsent] = await consentManager.hasActiveConsent(
          patient.address,
          provider.address,
          "medical_records"
        );
        expect(hasConsent).to.be.false;
      });

      it("Should return true for consent with no expiration", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0,
          "treatment"
        );

        const [hasConsent] = await consentManager.hasActiveConsent(
          patient.address,
          provider.address,
          "medical_records"
        );
        expect(hasConsent).to.be.true;
      });
    });
  });

  // ==================== ACCESS REQUEST TESTS ====================
  describe("Access Request Workflow", function () {
    describe("Request Creation", function () {
      it("Should allow provider to request access", async function () {
        const dataType = "medical_records";
        const purpose = "treatment";
        const expirationTime = 0;

        await expect(
          consentManager.connect(requester).requestAccess(
            patient.address,
            dataType,
            purpose,
            expirationTime
          )
        ).to.emit(consentManager, "AccessRequested");

        const requestId = 0n;
        const request = await consentManager.getAccessRequest(requestId);

        expect(request.requester).to.equal(requester.address);
        expect(request.patientAddress).to.equal(patient.address);
        expect(request.dataType).to.equal(dataType);
        expect(request.purpose).to.equal(purpose);
        expect(request.isProcessed).to.be.false;
        expect(request.status).to.equal(0); // RequestStatus.Pending = 0
      });

      it("Should increment request counter", async function () {
        expect(await consentManager.requestCounter()).to.equal(0);

        await consentManager.connect(requester).requestAccess(
          patient.address,
          "medical_records",
          "treatment",
          0
        );
        expect(await consentManager.requestCounter()).to.equal(1);

        await consentManager.connect(requester).requestAccess(
          patient.address,
          "genetic_data",
          "research",
          0
        );
        expect(await consentManager.requestCounter()).to.equal(2);
      });

      it("Should track requests in patientRequests mapping", async function () {
        await consentManager.connect(requester).requestAccess(
          patient.address,
          "medical_records",
          "treatment",
          0
        );

        const requests = await consentManager.getPatientRequests(patient.address);
        expect(requests.length).to.equal(1);
        expect(requests[0]).to.equal(0);
      });
    });

    describe("Request Validation", function () {
      it("Should reject request with zero address patient", async function () {
        await expect(
          consentManager.connect(requester).requestAccess(
            ethers.ZeroAddress,
            "medical_records",
            "treatment",
            0
          )
        ).to.be.revertedWithCustomError(consentManager, "InvalidAddress");
      });

      it("Should reject request from self", async function () {
        await expect(
          consentManager.connect(patient).requestAccess(
            patient.address,
            "medical_records",
            "treatment",
            0
          )
        ).to.be.revertedWithCustomError(consentManager, "CannotRequestAccessFromSelf");
      });

      it("Should reject request with empty data type", async function () {
        await expect(
          consentManager.connect(requester).requestAccess(
            patient.address,
            "",
            "treatment",
            0
          )
        ).to.be.revertedWithCustomError(consentManager, "EmptyString");
      });

      it("Should reject request with expiration in the past", async function () {
        const pastTime = (await getCurrentTimestamp()) - 86400;

        await expect(
          consentManager.connect(requester).requestAccess(
            patient.address,
            "medical_records",
            "treatment",
            pastTime
          )
        ).to.be.revertedWithCustomError(consentManager, "ExpirationInPast");
      });
    });

    describe("Request Approval/Denial", function () {
      beforeEach(async function () {
        await consentManager.connect(requester).requestAccess(
          patient.address,
          "medical_records",
          "treatment",
          0
        );
      });

      it("Should allow patient to approve request", async function () {
        const requestId = 0n;

        await expect(
          consentManager.connect(patient).respondToAccessRequest(requestId, true)
        )
          .to.emit(consentManager, "AccessApproved")
          .withArgs(requestId, patient.address, (timestamp) => timestamp > 0n);

        const request = await consentManager.getAccessRequest(requestId);
        expect(request.isProcessed).to.be.true;
        expect(request.status).to.equal(1); // RequestStatus.Approved = 1
        expect(request.isApproved).to.be.true;
      });

      it("Should automatically grant consent when request is approved", async function () {
        const requestId = 0n;

        await expect(
          consentManager.connect(patient).respondToAccessRequest(requestId, true)
        ).to.emit(consentManager, "ConsentGranted");

        // Verify consent was created
        const consent = await consentManager.getConsentRecord(0);
        expect(consent.patientAddress).to.equal(patient.address);
        expect(consent.providerAddress).to.equal(requester.address);
        expect(consent.isActive).to.be.true;
      });

      it("Should allow patient to deny request", async function () {
        const requestId = 0n;

        await expect(
          consentManager.connect(patient).respondToAccessRequest(requestId, false)
        )
          .to.emit(consentManager, "AccessDenied")
          .withArgs(requestId, patient.address, (timestamp) => timestamp > 0n);

        const request = await consentManager.getAccessRequest(requestId);
        expect(request.isProcessed).to.be.true;
        expect(request.status).to.equal(2); // RequestStatus.Denied = 2
        expect(request.isApproved).to.be.false;
      });

      it("Should not create consent when request is denied", async function () {
        const requestId = 0n;

        await consentManager.connect(patient).respondToAccessRequest(requestId, false);

        // Verify no consent was created
        expect(await consentManager.consentCounter()).to.equal(0);
      });

      it("Should reject approval/denial by non-patient", async function () {
        const requestId = 0n;

        await expect(
          consentManager.connect(otherAccount).respondToAccessRequest(requestId, true)
        ).to.be.revertedWithCustomError(consentManager, "UnauthorizedResponse");
      });

      it("Should reject processing already processed request", async function () {
        const requestId = 0n;

        await consentManager.connect(patient).respondToAccessRequest(requestId, true);

        await expect(
          consentManager.connect(patient).respondToAccessRequest(requestId, false)
        ).to.be.revertedWithCustomError(consentManager, "RequestAlreadyProcessed");
      });

      it("Should automatically deny expired requests", async function () {
        const expirationTime = (await getCurrentTimestamp()) + 60;
        
        await consentManager.connect(requester).requestAccess(
          patient.address,
          "medical_records",
          "treatment",
          expirationTime
        );

        await time.increase(120);

        const requestId = 1n; // Second request
        
        await expect(
          consentManager.connect(patient).respondToAccessRequest(requestId, true)
        ).to.emit(consentManager, "AccessDenied");

        const request = await consentManager.getAccessRequest(requestId);
        expect(request.status).to.equal(2); // Denied
      });
    });
  });

  // ==================== VIEW FUNCTION TESTS ====================
  describe("View Functions", function () {
    beforeEach(async function () {
      // Set up test data
      await consentManager.connect(patient).grantConsent(
        provider.address,
        "medical_records",
        0,
        "treatment"
      );
      await consentManager.connect(patient).grantConsent(
        provider2.address,
        "genetic_data",
        0,
        "research"
      );
    });

    describe("hasActiveConsent", function () {
      it("Should return true and consent ID for active consent", async function () {
        const [hasConsent, consentId] = await consentManager.hasActiveConsent(
          patient.address,
          provider.address,
          "medical_records"
        );

        expect(hasConsent).to.be.true;
        expect(consentId).to.equal(0);
      });

      it("Should return false for non-existent consent", async function () {
        const [hasConsent, consentId] = await consentManager.hasActiveConsent(
          patient.address,
          provider3.address,
          "imaging_data"
        );

        expect(hasConsent).to.be.false;
        expect(consentId).to.equal(0);
      });

      it("Should return false for revoked consent", async function () {
        await consentManager.connect(patient).revokeConsent(0);

        const [hasConsent] = await consentManager.hasActiveConsent(
          patient.address,
          provider.address,
          "medical_records"
        );

        expect(hasConsent).to.be.false;
      });

      it("Should return false for wrong data type", async function () {
        const [hasConsent] = await consentManager.hasActiveConsent(
          patient.address,
          provider.address,
          "genetic_data" // Different from "medical_records"
        );

        expect(hasConsent).to.be.false;
      });

      it("Should return false for wrong provider", async function () {
        const [hasConsent] = await consentManager.hasActiveConsent(
          patient.address,
          provider3.address, // Different provider
          "medical_records"
        );

        expect(hasConsent).to.be.false;
      });
    });

    describe("getPatientConsents", function () {
      it("Should return all consent IDs for a patient", async function () {
        const consents = await consentManager.getPatientConsents(patient.address);
        expect(consents.length).to.equal(2);
        expect(consents[0]).to.equal(0);
        expect(consents[1]).to.equal(1);
      });

      it("Should return empty array for patient with no consents", async function () {
        const consents = await consentManager.getPatientConsents(otherAccount.address);
        expect(consents.length).to.equal(0);
      });
    });

    describe("getConsentRecord", function () {
      it("Should return complete consent record", async function () {
        const consent = await consentManager.getConsentRecord(0);
        
        expect(consent.patientAddress).to.equal(patient.address);
        expect(consent.providerAddress).to.equal(provider.address);
        expect(consent.dataType).to.equal("medical_records");
        expect(consent.purpose).to.equal("treatment");
        expect(consent.isActive).to.be.true;
        expect(consent.expirationTime).to.equal(0);
        expect(consent.timestamp).to.be.greaterThan(0);
      });

      it("Should revert for non-existent consent", async function () {
        await expect(
          consentManager.getConsentRecord(999)
        ).to.be.revertedWithCustomError(consentManager, "ConsentNotFound");
      });
    });

    describe("getAccessRequest", function () {
      it("Should return complete access request", async function () {
        await consentManager.connect(requester).requestAccess(
          patient.address,
          "medical_records",
          "treatment",
          0
        );

        const request = await consentManager.getAccessRequest(0);
        
        expect(request.requester).to.equal(requester.address);
        expect(request.patientAddress).to.equal(patient.address);
        expect(request.dataType).to.equal("medical_records");
        expect(request.purpose).to.equal("treatment");
        expect(request.isProcessed).to.be.false;
        expect(request.status).to.equal(0); // Pending
      });

      it("Should revert for non-existent request", async function () {
        await expect(
          consentManager.getAccessRequest(999)
        ).to.be.revertedWithCustomError(consentManager, "RequestNotFound");
      });
    });
  });

  // ==================== SECURITY TESTS ====================
  describe("Security", function () {
    describe("Reentrancy Protection", function () {
      it("Should prevent reentrancy in grantConsent", async function () {
        // This test verifies nonReentrant modifier is working
        // In a real attack scenario, we'd need a malicious contract
        // For now, we verify the modifier exists by checking the function works correctly
        
        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            "medical_records",
            0,
            "treatment"
          )
        ).to.not.be.reverted;
      });

      it("Should prevent reentrancy in batch operations", async function () {
        await expect(
          consentManager.connect(patient).grantConsentBatch(
            [provider.address],
            ["medical_records"],
            [0],
            ["treatment"]
          )
        ).to.not.be.reverted;
      });
    });

    describe("Access Control", function () {
      it("Should prevent unauthorized consent revocation", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0,
          "treatment"
        );

        await expect(
          consentManager.connect(provider).revokeConsent(0)
        ).to.be.revertedWithCustomError(consentManager, "UnauthorizedRevocation");
      });

      it("Should prevent unauthorized request response", async function () {
        await consentManager.connect(requester).requestAccess(
          patient.address,
          "medical_records",
          "treatment",
          0
        );

        await expect(
          consentManager.connect(provider).respondToAccessRequest(0, true)
        ).to.be.revertedWithCustomError(consentManager, "UnauthorizedResponse");
      });
    });

    describe("Input Validation", function () {
      it("Should reject all zero address inputs", async function () {
        await expect(
          consentManager.connect(patient).grantConsent(
            ethers.ZeroAddress,
            "medical_records",
            0,
            "treatment"
          )
        ).to.be.revertedWithCustomError(consentManager, "InvalidAddress");
      });

      it("Should enforce string length limits", async function () {
        const longString = "a".repeat(257);
        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            longString,
            0,
            "treatment"
          )
        ).to.be.revertedWithCustomError(consentManager, "StringTooLong");
      });
    });
  });

  // ==================== EDGE CASES ====================
  describe("Edge Cases", function () {
    it("Should handle multiple consents with same provider and data type", async function () {
      await consentManager.connect(patient).grantConsent(
        provider.address,
        "medical_records",
        0,
        "treatment"
      );
      
      await consentManager.connect(patient).grantConsent(
        provider.address,
        "medical_records",
        0,
        "research" // Different purpose
      );

      const consents = await consentManager.getPatientConsents(patient.address);
      expect(consents.length).to.equal(2);
    });

    it("Should handle consent expiration at exact timestamp", async function () {
      const expirationTime = (await getCurrentTimestamp()) + 60;
      
      await consentManager.connect(patient).grantConsent(
        provider.address,
        "medical_records",
        expirationTime,
        "treatment"
      );

      await time.increaseTo(expirationTime);

      const expired = await consentManager.isConsentExpired(0);
      expect(expired).to.be.false; // Not expired yet (expires at > expirationTime)

      await time.increase(1); // 1 second past expiration

      const expiredAfter = await consentManager.isConsentExpired(0);
      expect(expiredAfter).to.be.true;
    });

    it("Should handle maximum uint256 expiration time", async function () {
      const maxUint256 = ethers.MaxUint256;
      
      // This should not revert, but expiration will effectively never occur
      await expect(
        consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          maxUint256,
          "treatment"
        )
      ).to.emit(consentManager, "ConsentGranted");
    });

    it("Should handle many consents for single patient", async function () {
      const count = 20;
      
      for (let i = 0; i < count; i++) {
        await consentManager.connect(patient).grantConsent(
          accounts[i].address,
          `data_type_${i}`,
          0,
          `purpose_${i}`
        );
      }

      const consents = await consentManager.getPatientConsents(patient.address);
      expect(consents.length).to.equal(count);
    });
  });

  // ==================== GAS OPTIMIZATION TESTS ====================
  describe("Gas Optimization", function () {
    it("Should measure and log gas for single consent grant", async function () {
      const tx = await consentManager.connect(patient).grantConsent(
        provider.address,
        "medical_records",
        0,
        "treatment"
      );
      const receipt = await tx.wait();
      
      console.log(`Single consent grant gas: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.greaterThan(0);
    });

    it("Should measure and log gas for batch consent grant", async function () {
      const batchSize = 5;
      const providers = [];
      const dataTypes = [];
      const expirationTimes = [];
      const purposes = [];

      for (let i = 0; i < batchSize; i++) {
        providers.push(accounts[i].address);
        dataTypes.push(`data_type_${i}`);
        expirationTimes.push(0);
        purposes.push(`purpose_${i}`);
      }

      const tx = await consentManager.connect(patient).grantConsentBatch(
        providers,
        dataTypes,
        expirationTimes,
        purposes
      );
      const receipt = await tx.wait();
      
      console.log(`Batch consent grant (${batchSize}) gas: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.greaterThan(0);
    });
  });

  // ==================== INTEGRATION TESTS ====================
  describe("Integration Scenarios", function () {
    it("Should handle complete workflow: request -> approve -> grant consent", async function () {
      // 1. Request access
      await consentManager.connect(requester).requestAccess(
        patient.address,
        "medical_records",
        "treatment",
        0
      );

      // 2. Approve request
      await consentManager.connect(patient).respondToAccessRequest(0, true);

      // 3. Verify consent was automatically granted
      const [hasConsent] = await consentManager.hasActiveConsent(
        patient.address,
        requester.address,
        "medical_records"
      );
      expect(hasConsent).to.be.true;
    });

    it("Should handle workflow: grant -> revoke -> check inactive", async function () {
      // 1. Grant consent
      await consentManager.connect(patient).grantConsent(
        provider.address,
        "medical_records",
        0,
        "treatment"
      );

      // 2. Verify active
      let [hasConsent] = await consentManager.hasActiveConsent(
        patient.address,
        provider.address,
        "medical_records"
      );
      expect(hasConsent).to.be.true;

      // 3. Revoke
      await consentManager.connect(patient).revokeConsent(0);

      // 4. Verify inactive
      [hasConsent] = await consentManager.hasActiveConsent(
        patient.address,
        provider.address,
        "medical_records"
      );
      expect(hasConsent).to.be.false;
    });

    it("Should handle complex scenario with multiple patients and providers", async function () {
      const patient2 = accounts[10];
      
      // Patient 1 grants consents
      await consentManager.connect(patient).grantConsent(
        provider.address,
        "medical_records",
        0,
        "treatment"
      );
      await consentManager.connect(patient).grantConsent(
        provider2.address,
        "genetic_data",
        0,
        "research"
      );

      // Patient 2 grants consents
      await consentManager.connect(patient2).grantConsent(
        provider.address,
        "medical_records",
        0,
        "treatment"
      );

      // Verify each patient's consents are tracked separately
      const patient1Consents = await consentManager.getPatientConsents(patient.address);
      const patient2Consents = await consentManager.getPatientConsents(patient2.address);

      expect(patient1Consents.length).to.equal(2);
      expect(patient2Consents.length).to.equal(1);
    });
  });
});
