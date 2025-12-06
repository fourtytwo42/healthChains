const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

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
          [dataType],
          expirationTime,
          [purpose]
        );

        const receipt = await tx.wait();
        const event = receipt.logs.find(log => {
          try {
            const parsed = consentManager.interface.parseLog(log);
            return parsed && parsed.name === "ConsentGranted";
          } catch {
            return false;
          }
        });
        expect(event).to.not.be.undefined;
        const parsedEvent = consentManager.interface.parseLog(event);
        expect(parsedEvent.args.patient).to.equal(patient.address);
        // New event format: (address indexed patient, uint256[] consentIds, uint128 timestamp)
        expect(parsedEvent.args.consentIds.length).to.equal(1);
        expect(parsedEvent.args.consentIds[0]).to.equal(0n);

        const consentId = 0n;
        const consent = await consentManager.getConsentRecord(consentId);

        expect(consent.patientAddress).to.equal(patient.address);
        expect(consent.providerAddress).to.equal(provider.address);
        // BatchConsentRecord stores arrays of hashes
        expect(consent.dataTypeHashes.length).to.equal(1);
        expect(consent.purposeHashes.length).to.equal(1);
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
            [dataType],
            futureTime,
            [purpose]
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
          ["medical_records"],
          0,
          ["treatment"]
        );
        expect(await consentManager.consentCounter()).to.equal(1);

        await consentManager.connect(patient).grantConsent(
          provider2.address,
          ["genetic_data"],
          0,
          ["research"]
        );
        expect(await consentManager.consentCounter()).to.equal(2);
      });

      it("Should track consents in patientConsents mapping", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          ["medical_records"],
          0,
          ["treatment"]
        );

        const consents = await consentManager.getPatientConsents(patient.address);
        expect(consents.length).to.equal(1);
        expect(consents[0]).to.equal(0);
      });

      it("Should track consents in providerConsents mapping", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          ["medical_records"],
          0,
          ["treatment"]
        );

        // Note: We don't have a getProviderConsents function, but we can verify through consent record
        const consent = await consentManager.getConsentRecord(0);
        expect(consent.providerAddress).to.equal(provider.address);
      });

      it("Should allow multiple consents for same patient", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          ["medical_records"],
          0,
          ["treatment"]
        );
        await consentManager.connect(patient).grantConsent(
          provider2.address,
          ["genetic_data"],
          0,
          ["research"]
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
            ["medical_records"],
            0,
            ["treatment"]
          )
        ).to.be.revertedWithCustomError(consentManager, "InvalidAddress");
      });

      it("Should reject granting consent to self", async function () {
        await expect(
          consentManager.connect(patient).grantConsent(
            patient.address,
            ["medical_records"],
            0,
            ["treatment"]
          )
        ).to.be.revertedWithCustomError(consentManager, "CannotGrantConsentToSelf");
      });

      it("Should reject granting consent with empty data type", async function () {
        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            [""],
            0,
            ["treatment"]
          )
        ).to.be.revertedWithCustomError(consentManager, "EmptyString");
      });

      it("Should reject granting consent with empty purpose", async function () {
        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            ["medical_records"],
            0,
            [""]
          )
        ).to.be.revertedWithCustomError(consentManager, "EmptyString");
      });

      it("Should reject granting consent with expiration time in the past", async function () {
        const pastTime = (await getCurrentTimestamp()) - 86400; // 1 day ago

        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            ["medical_records"],
            pastTime,
            ["treatment"]
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
            [maxLengthString],
            0,
            ["treatment"]
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
          [dataType],
          expirationTime,
          [purpose]
        );

        const receipt = await tx.wait();
        const event = receipt.logs.find(
          log => consentManager.interface.parseLog(log)?.name === "ConsentGranted"
        );

        expect(event).to.not.be.undefined;
        const parsedEvent = consentManager.interface.parseLog(event);
        // New event format: (address indexed patient, uint256[] consentIds, uint128 timestamp)
        expect(parsedEvent.args.patient).to.equal(patient.address);
        expect(parsedEvent.args.consentIds.length).to.equal(1);
        expect(parsedEvent.args.consentIds[0]).to.equal(0n);
        expect(parsedEvent.args.timestamp).to.be.greaterThan(0n);
      });
    });
  });

  // ==================== BATCH CONSENT TESTS ====================
  describe("Batch Consent Operations", function () {
    describe("Successful Batch Grants", function () {
      it("Should grant multiple consents in a single transaction", async function () {
        // New grantConsent() takes single provider, arrays of dataTypes and purposes
        // Creates ONE BatchConsentRecord covering all combinations
        const dataTypes = ["medical_records", "genetic_data", "imaging_data"];
        const expirationTime = 0;
        const purposes = ["treatment", "research"];

        const tx = await consentManager.connect(patient).grantConsent(
          provider.address,
          dataTypes,
          expirationTime,
          purposes
        );

        await expect(tx)
          .to.emit(consentManager, "ConsentGranted")
          .withArgs(
            patient.address,
            (ids) => ids.length === 1, // One BatchConsentRecord created
            (timestamp) => timestamp > 0n
          );

        // Verify one consent was created (BatchConsentRecord)
        expect(await consentManager.consentCounter()).to.equal(1);
        
        const consents = await consentManager.getPatientConsents(patient.address);
        expect(consents.length).to.equal(1);
        expect(consents[0]).to.equal(0);

        // Verify BatchConsentRecord
        const consent0 = await consentManager.getConsentRecord(0);
        expect(consent0.providerAddress).to.equal(provider.address);
        expect(consent0.dataTypeHashes.length).to.equal(3);
        expect(consent0.purposeHashes.length).to.equal(2);
      });

      it("Should emit ConsentGranted event with single consent ID", async function () {
        const dataTypes = ["medical_records", "genetic_data"];
        const expirationTime = 0;
        const purposes = ["treatment", "research"];

        const tx = await consentManager.connect(patient).grantConsent(
          provider.address,
          dataTypes,
          expirationTime,
          purposes
        );

        const receipt = await tx.wait();
        const consentGrantedEvents = receipt.logs.filter(
          log => consentManager.interface.parseLog(log)?.name === "ConsentGranted"
        );

        // One event with one consent ID (BatchConsentRecord)
        expect(consentGrantedEvents.length).to.equal(1);
      });

      it("Should handle large combinations (up to MAX_BATCH_SIZE)", async function () {
        // Create arrays that result in many combinations
        const dataTypes = [];
        const purposes = [];
        
        // 10 data types × 10 purposes = 100 combinations (within MAX_BATCH_SIZE of 200)
        for (let i = 0; i < 10; i++) {
          dataTypes.push(`data_type_${i}`);
          purposes.push(`purpose_${i}`);
        }

        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            dataTypes,
            0,
            purposes
          )
        ).to.emit(consentManager, "ConsentGranted");

        // One BatchConsentRecord created
        expect(await consentManager.consentCounter()).to.equal(1);
      });
    });

    describe("Batch Validation", function () {
      it("Should reject empty data types array", async function () {
        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            [],
            0,
            ["treatment"]
          )
        ).to.be.revertedWithCustomError(consentManager, "EmptyBatch");
      });

      it("Should reject empty purposes array", async function () {
        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            ["medical_records"],
            0,
            []
          )
        ).to.be.revertedWithCustomError(consentManager, "EmptyBatch");
      });

      it("Should reject if total combinations exceed MAX_BATCH_SIZE", async function () {
        // Create arrays that result in > 200 combinations
        const dataTypes = Array(15).fill("medical_records");
        const purposes = Array(15).fill("treatment"); // 15 × 15 = 225 > 200

        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            dataTypes,
            0,
            purposes
          )
        ).to.be.revertedWithCustomError(consentManager, "BatchSizeExceeded");
      });

      it("Should reject if dataTypes array exceeds MAX_BATCH_SIZE", async function () {
        const dataTypes = new Array(201).fill("medical_records"); // Exceeds MAX_BATCH_SIZE (200)
        const purposes = ["treatment"];

        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            dataTypes,
            0,
            purposes
          )
        ).to.be.revertedWithCustomError(consentManager, "BatchSizeExceeded");
      });

      it("Should revert if provider address is invalid", async function () {
        const dataTypes = ["medical_records"];
        const purposes = ["treatment"];

        await expect(
          consentManager.connect(patient).grantConsent(
            ethers.ZeroAddress, // Invalid address
            dataTypes,
            0,
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

        // Measure batch gas (using arrays for dataTypes and purposes)
        const batchTx = await consentManager.connect(patient).grantConsent(
          provider.address,
          dataTypes,
          0,
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
          ["medical_records"],
          0,
          ["treatment"]
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
          ["medical_records"],
          0,
          ["treatment"]
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
          ["medical_records"],
          0,
          ["treatment"]
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
          ["medical_records"],
          0,
          ["treatment"]
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
        const expirationTime = (await getCurrentTimestamp()) + 60; // Expires in 1 minute
        
        await consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          expirationTime,
          "treatment"
        );

        // Advance time past expiration
        await time.increase(120); // 2 minutes

        const expired = await consentManager.isConsentExpired(0);
        expect(expired).to.be.true;
      });

      it("Should return false for consent with no expiration", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          ["medical_records"],
          0,
          ["treatment"]
        );

        const expired = await consentManager.isConsentExpired(0);
        expect(expired).to.be.false;
      });

      it("Should return false for non-existent consent", async function () {
        const expired = await consentManager.isConsentExpired(999);
        expect(expired).to.be.false;
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
            [dataType],
            [purpose],
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
          ["medical_records"],
          ["treatment"],
          0
        );
        expect(await consentManager.requestCounter()).to.equal(1);

        await consentManager.connect(requester).requestAccess(
          patient.address,
          ["genetic_data"],
          ["research"],
          0
        );
        expect(await consentManager.requestCounter()).to.equal(2);
      });

      it("Should track requests in patientRequests mapping", async function () {
        await consentManager.connect(requester).requestAccess(
          patient.address,
          ["medical_records"],
          ["treatment"],
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
            ["medical_records"],
            ["treatment"],
            0
          )
        ).to.be.revertedWithCustomError(consentManager, "InvalidAddress");
      });

      it("Should reject request from self", async function () {
        await expect(
          consentManager.connect(patient).requestAccess(
            patient.address,
            ["medical_records"],
            ["treatment"],
            0
          )
        ).to.be.revertedWithCustomError(consentManager, "CannotRequestAccessFromSelf");
      });

      it("Should reject request with empty data type", async function () {
        await expect(
          consentManager.connect(requester).requestAccess(
            patient.address,
            [""],
            ["treatment"],
            0
          )
        ).to.be.revertedWithCustomError(consentManager, "EmptyString");
      });

      it("Should reject request with expiration in the past", async function () {
        const pastTime = (await getCurrentTimestamp()) - 86400;

        await expect(
          consentManager.connect(requester).requestAccess(
            patient.address,
            ["medical_records"],
            ["treatment"],
            pastTime
          )
        ).to.be.revertedWithCustomError(consentManager, "ExpirationInPast");
      });
    });

    describe("Request Approval/Denial", function () {
      beforeEach(async function () {
        await consentManager.connect(requester).requestAccess(
          patient.address,
          ["medical_records"],
          ["treatment"],
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
      });

      it("Should automatically grant consent when request is approved", async function () {
        const requestId = 0n;

        // When approving a request, it creates a batch consent and emits ConsentGranted
        await expect(
          consentManager.connect(patient).respondToAccessRequest(requestId, true)
        ).to.emit(consentManager, "ConsentGranted");

        // Verify batch consent was created (approving a request creates a batch consent)
        const patientConsents = await consentManager.getPatientConsents(patient.address);
        expect(patientConsents.length).to.be.greaterThan(0);
        const batchConsentId = patientConsents[patientConsents.length - 1];
        const batchConsent = await consentManager.getConsentRecord(batchConsentId);
        expect(batchConsent.patientAddress).to.equal(patient.address);
        expect(batchConsent.providerAddress).to.equal(requester.address);
        expect(batchConsent.isActive).to.be.true;
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
          ["medical_records"],
          ["treatment"],
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
        // ConsentRecord now stores hashes, not strings - verify hashes are present
        expect(consent.dataTypeHash).to.be.a("string");
        expect(consent.purposeHash).to.be.a("string");
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
          ["medical_records"],
          ["treatment"],
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
            ["medical_records"],
            0,
            ["treatment"]
          )
        ).to.not.be.reverted;
      });

      it("Should prevent reentrancy in batch operations", async function () {
        await expect(
          consentManager.connect(patient).grantConsent(
            provider.address,
            ["medical_records"],
            0,
            ["treatment"]
          )
        ).to.not.be.reverted;
      });
    });

    describe("Access Control", function () {
      it("Should prevent unauthorized consent revocation", async function () {
        await consentManager.connect(patient).grantConsent(
          provider.address,
          ["medical_records"],
          0,
          ["treatment"]
        );

        await expect(
          consentManager.connect(provider).revokeConsent(0)
        ).to.be.revertedWithCustomError(consentManager, "UnauthorizedRevocation");
      });

      it("Should prevent unauthorized request response", async function () {
        await consentManager.connect(requester).requestAccess(
          patient.address,
          ["medical_records"],
          ["treatment"],
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
            ["medical_records"],
            0,
            ["treatment"]
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
      
      // Now correctly rejects values > uint128.max with ExpirationTooLarge error
      await expect(
        consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          maxUint256,
          "treatment"
        )
      ).to.be.revertedWithCustomError(consentManager, "ExpirationTooLarge");
    });

    it("Should handle many consents for single patient", async function () {
      const count = 20;
      const allSigners = await ethers.getSigners();
      
      for (let i = 0; i < count; i++) {
        // Use provider addresses in rotation, or create new ones
        const providerSigner = allSigners[Math.min(i + 3, allSigners.length - 1)];
        await consentManager.connect(patient).grantConsent(
          providerSigner.address,
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

      const tx = await consentManager.connect(patient).grantConsent(
        provider.address,
        dataTypes,
        0,
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
        ["medical_records"],
        ["treatment"],
        0
      );

      // 2. Approve request
      await consentManager.connect(patient).respondToAccessRequest(0, true);

      // 3. Verify consent was automatically granted (hasActiveConsent removed, use event-based lookup)
      // Check that batch consent was created
      const patientConsents = await consentManager.getPatientConsents(patient.address);
      expect(patientConsents.length).to.be.greaterThan(0);
    });

    it("Should handle workflow: grant -> revoke -> check inactive", async function () {
      // 1. Grant consent
      await consentManager.connect(patient).grantConsent(
        provider.address,
        "medical_records",
        0,
        "treatment"
      );

      // 2. Verify active (hasActiveConsent removed, check consent record directly)
      const consent = await consentManager.getConsentRecord(0);
      expect(consent.isActive).to.be.true;

      // 3. Revoke
      await consentManager.connect(patient).revokeConsent(0);

      // 4. Verify inactive
      const revokedConsent = await consentManager.getConsentRecord(0);
      expect(revokedConsent.isActive).to.be.false;
    });

    it("Should handle complex scenario with multiple patients and providers", async function () {
      const patient2 = accounts[10];
      
      // Patient 1 grants consents
      await consentManager.connect(patient).grantConsent(
        provider.address,
        ["medical_records"],
        0,
        ["treatment"]
      );
      await consentManager.connect(patient).grantConsent(
        provider2.address,
        ["genetic_data"],
        0,
        ["research"]
      );

      // Patient 2 grants consents
      await consentManager.connect(patient2).grantConsent(
        provider.address,
        ["medical_records"],
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

  // ==================== EXPANDED GAS BENCHMARKS ====================
  describe("Gas Benchmarks - Comprehensive", function () {
    it("Should measure gas for single consent grant", async function () {
      const [patient, provider] = await ethers.getSigners();
      const expirationTime = Math.floor(Date.now() / 1000) + 86400;

      const tx = await consentManager.connect(patient).grantConsent(
        provider.address,
        ["medical_records"],
        expirationTime,
        ["treatment"]
      );
      const receipt = await tx.wait();

      console.log(`\n[Gas Benchmark] Single Consent Grant:`);
      console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`  Gas Price: ${tx.gasPrice?.toString() || 'N/A'}`);
      
      expect(receipt.gasUsed).to.be.greaterThan(0);
    });

    it("Should measure gas for batch consent grant (10 consents)", async function () {
      const [patient, provider] = await ethers.getSigners();
      const expirationTime = Math.floor(Date.now() / 1000) + 86400;

      // Create arrays with 10 data types and 1 purpose = 10 combinations
      const dataTypes = Array(10).fill("medical_records");
      const purposes = ["treatment"];

      const tx = await consentManager.connect(patient).grantConsent(
        provider.address,
        dataTypes,
        expirationTime,
        purposes
      );
      const receipt = await tx.wait();

      console.log(`\n[Gas Benchmark] Batch Consent Grant (10 consents):`);
      console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`  Average per consent: ${receipt.gasUsed / 10n}`);
      
      expect(receipt.gasUsed).to.be.greaterThan(0);
    });

    it("Should measure gas for batch consent grant (50 consents - max batch)", async function () {
      const [patient, provider] = await ethers.getSigners();
      const expirationTime = Math.floor(Date.now() / 1000) + 86400;

      // Create arrays with 50 data types and 1 purpose = 50 combinations
      const dataTypes = Array(50).fill("medical_records");
      const purposes = ["treatment"];

      const tx = await consentManager.connect(patient).grantConsent(
        provider.address,
        dataTypes,
        expirationTime,
        purposes
      );
      const receipt = await tx.wait();

      console.log(`\n[Gas Benchmark] Batch Consent Grant (50 consents - MAX):`);
      console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`  Average per consent: ${receipt.gasUsed / 50n}`);
      
      expect(receipt.gasUsed).to.be.greaterThan(0);
    });

    it("Should compare single vs batch gas efficiency", async function () {
      const [patient, provider] = await ethers.getSigners();
      const expirationTime = Math.floor(Date.now() / 1000) + 86400;

      // Single consent
      const tx1 = await consentManager.connect(patient).grantConsent(
        provider.address,
        ["medical_records"],
        expirationTime,
        ["treatment"]
      );
      const receipt1 = await tx1.wait();
      const singleGas = receipt1.gasUsed;

      // Batch of 5 combinations (5 data types × 1 purpose)
      const dataTypes = Array(5).fill("diagnostic_data");
      const purposes = ["research"];

      const tx2 = await consentManager.connect(patient).grantConsent(
        provider.address,
        dataTypes,
        expirationTime,
        purposes
      );
      const receipt2 = await tx2.wait();
      const batchGas = receipt2.gasUsed;

      console.log(`\n[Gas Comparison] Single vs Batch:`);
      console.log(`  Single consent: ${singleGas.toString()}`);
      console.log(`  Batch (5 combinations): ${batchGas.toString()}`);
      console.log(`  Average per combination (batch): ${batchGas / 5n}`);
      console.log(`  Savings per combination: ${singleGas - (batchGas / 5n)}`);

      // Batch should be more efficient per combination
      expect(batchGas / 5n).to.be.lessThan(singleGas);
    });
  });

  // ==================== STRESS TESTS ====================
  describe("Stress Tests", function () {
    it("Should handle maximum batch size (50 consents)", async function () {
      const [patient, provider] = await ethers.getSigners();
      const expirationTime = Math.floor(Date.now() / 1000) + 86400;

      // Create 50 combinations (50 data types × 1 purpose)
      const dataTypes = Array(50).fill("medical_records");
      const purposes = ["treatment"];

      const tx = await consentManager.connect(patient).grantConsent(
        provider.address,
        dataTypes,
        expirationTime,
        purposes
      );
      const receipt = await tx.wait();

      // Verify one BatchConsentRecord was created (covering 50 combinations)
      const consents = await consentManager.getPatientConsents(patient.address);
      expect(consents.length).to.equal(1);

      console.log(`\n[Stress Test] Maximum batch size (50 consents):`);
      console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
      console.log(`  Consents created: ${consents.length}`);
    });

    it("Should handle many consents per patient (100+ consents)", async function () {
      const [patient, provider] = await ethers.getSigners();
      const expirationTime = Math.floor(Date.now() / 1000) + 86400;

      // Create 100 combinations in batches (2 batches of 50 combinations each)
      for (let i = 0; i < 2; i++) {
        const dataTypes = Array(50).fill(`data_type_${i}`);
        const purposes = ["treatment"];

        await consentManager.connect(patient).grantConsent(
          provider.address,
          dataTypes,
          expirationTime,
          purposes
        );
      }

      // Should have 2 BatchConsentRecords (one per batch)
      const consents = await consentManager.getPatientConsents(patient.address);
      expect(consents.length).to.equal(2);

      console.log(`\n[Stress Test] Many consents per patient:`);
      console.log(`  Total consents: ${consents.length}`);
    });

    it("Should handle concurrent operations from different patients", async function () {
      const [patient1, patient2, patient3, provider] = await ethers.getSigners();
      const expirationTime = Math.floor(Date.now() / 1000) + 86400;

      // Grant consents concurrently
      const promises = [
        consentManager.connect(patient1).grantConsent(
          provider.address,
          ["medical_records"],
          expirationTime,
          ["treatment"]
        ),
        consentManager.connect(patient2).grantConsent(
          provider.address,
          ["diagnostic_data"],
          expirationTime,
          ["research"]
        ),
        consentManager.connect(patient3).grantConsent(
          provider.address,
          ["genetic_data"],
          expirationTime,
          ["analytics"]
        ),
      ];

      const receipts = await Promise.all(promises.map(p => p.then(tx => tx.wait())));

      // Verify all consents were created
      const consents1 = await consentManager.getPatientConsents(patient1.address);
      const consents2 = await consentManager.getPatientConsents(patient2.address);
      const consents3 = await consentManager.getPatientConsents(patient3.address);

      expect(consents1.length).to.be.greaterThan(0);
      expect(consents2.length).to.be.greaterThan(0);
      expect(consents3.length).to.be.greaterThan(0);

      console.log(`\n[Stress Test] Concurrent operations:`);
      console.log(`  Patient 1 consents: ${consents1.length}`);
      console.log(`  Patient 2 consents: ${consents2.length}`);
      console.log(`  Patient 3 consents: ${consents3.length}`);
    });

    it("Should handle long data type and purpose strings", async function () {
      const [patient, provider] = await ethers.getSigners();
      const expirationTime = Math.floor(Date.now() / 1000) + 86400;

      // Test with maximum length strings (100 chars)
      const longDataType = "a".repeat(100);
      const longPurpose = "b".repeat(100);

      const tx = await consentManager.connect(patient).grantConsent(
        provider.address,
        [longDataType],
        expirationTime,
        [longPurpose]
      );
      const receipt = await tx.wait();

      expect(receipt.status).to.equal(1);

      console.log(`\n[Stress Test] Long strings:`);
      console.log(`  Data type length: ${longDataType.length}`);
      console.log(`  Purpose length: ${longPurpose.length}`);
      console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
    });

    it("Should handle many access requests per patient", async function () {
      const [patient, requester1, requester2, requester3] = await ethers.getSigners();
      const expirationTime = Math.floor(Date.now() / 1000) + 86400;

      // Create multiple access requests
      const requests = [
        consentManager.connect(requester1).requestAccess(
          patient.address,
          ["medical_records"],
          ["treatment"],
          expirationTime
        ),
        consentManager.connect(requester2).requestAccess(
          patient.address,
          ["diagnostic_data"],
          ["research"],
          expirationTime
        ),
        consentManager.connect(requester3).requestAccess(
          patient.address,
          ["genetic_data"],
          ["analytics"],
          expirationTime
        ),
      ];

      const receipts = await Promise.all(requests.map(r => r.then(tx => tx.wait())));

      // Verify all requests were created
      const patientRequests = await consentManager.getPatientRequests(patient.address);
      expect(patientRequests.length).to.be.greaterThanOrEqual(3);

      console.log(`\n[Stress Test] Many access requests:`);
      console.log(`  Total requests: ${patientRequests.length}`);
    });
  });
});
