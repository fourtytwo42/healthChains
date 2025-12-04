const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PatientConsentManager", function () {
  let consentManager;
  let owner;
  let patient;
  let provider;
  let otherAccount;

  beforeEach(async function () {
    [owner, patient, provider, otherAccount] = await ethers.getSigners();

    const PatientConsentManager = await ethers.getContractFactory("PatientConsentManager");
    consentManager = await PatientConsentManager.deploy();
    await consentManager.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await consentManager.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should initialize with zero consent counter", async function () {
      expect(await consentManager.consentCounter()).to.equal(0);
    });

    it("Should initialize with zero request counter", async function () {
      expect(await consentManager.requestCounter()).to.equal(0);
    });
  });

  describe("Grant Consent", function () {
    it("Should allow patient to grant consent", async function () {
      const dataType = "medical_records";
      const expirationTime = 0; // No expiration
      const purpose = "treatment";

      await expect(
        consentManager.connect(patient).grantConsent(
          provider.address,
          dataType,
          expirationTime,
          purpose
        )
      ).to.emit(consentManager, "ConsentGranted");

      const consentId = await consentManager.consentCounter() - 1n;
      const consent = await consentManager.getConsentRecord(consentId);

      expect(consent.patientAddress).to.equal(patient.address);
      expect(consent.providerAddress).to.equal(provider.address);
      expect(consent.dataType).to.equal(dataType);
      expect(consent.isActive).to.be.true;
    });

    it("Should reject granting consent to self", async function () {
      await expect(
        consentManager.connect(patient).grantConsent(
          patient.address,
          "medical_records",
          0,
          "treatment"
        )
      ).to.be.revertedWith("Cannot grant consent to self");
    });

    it("Should reject granting consent with empty data type", async function () {
      await expect(
        consentManager.connect(patient).grantConsent(
          provider.address,
          "",
          0,
          "treatment"
        )
      ).to.be.revertedWith("DataType cannot be empty");
    });

    it("Should reject granting consent with empty purpose", async function () {
      await expect(
        consentManager.connect(patient).grantConsent(
          provider.address,
          "medical_records",
          0,
          ""
        )
      ).to.be.revertedWith("Purpose cannot be empty");
    });
  });

  describe("Revoke Consent", function () {
    it("Should allow patient to revoke their consent", async function () {
      // First grant consent
      await consentManager.connect(patient).grantConsent(
        provider.address,
        "medical_records",
        0,
        "treatment"
      );

      const consentId = await consentManager.consentCounter() - 1n;

      await expect(
        consentManager.connect(patient).revokeConsent(consentId)
      ).to.emit(consentManager, "ConsentRevoked");

      const consent = await consentManager.getConsentRecord(consentId);
      expect(consent.isActive).to.be.false;
    });

    it("Should reject revocation by non-patient", async function () {
      await consentManager.connect(patient).grantConsent(
        provider.address,
        "medical_records",
        0,
        "treatment"
      );

      const consentId = await consentManager.consentCounter() - 1n;

      await expect(
        consentManager.connect(otherAccount).revokeConsent(consentId)
      ).to.be.revertedWith("Only patient can revoke consent");
    });
  });

  describe("Request Access", function () {
    it("Should allow provider to request access", async function () {
      const dataType = "medical_records";
      const purpose = "treatment";

      await expect(
        consentManager.connect(provider).requestAccess(
          patient.address,
          dataType,
          purpose
        )
      ).to.emit(consentManager, "AccessRequested");

      const requestId = await consentManager.requestCounter() - 1n;
      const request = await consentManager.getAccessRequest(requestId);

      expect(request.requester).to.equal(provider.address);
      expect(request.dataType).to.equal(dataType);
      expect(request.isProcessed).to.be.false;
    });
  });

  describe("Check Active Consent", function () {
    it("Should return true for active consent", async function () {
      await consentManager.connect(patient).grantConsent(
        provider.address,
        "medical_records",
        0,
        "treatment"
      );

      const [hasConsent, consentId] = await consentManager.hasActiveConsent(
        patient.address,
        provider.address,
        "medical_records"
      );

      expect(hasConsent).to.be.true;
      expect(consentId).to.equal(0);
    });

    it("Should return false when no consent exists", async function () {
      const [hasConsent, consentId] = await consentManager.hasActiveConsent(
        patient.address,
        provider.address,
        "medical_records"
      );

      expect(hasConsent).to.be.false;
      expect(consentId).to.equal(0);
    });

    it("Should return false for revoked consent", async function () {
      await consentManager.connect(patient).grantConsent(
        provider.address,
        "medical_records",
        0,
        "treatment"
      );

      const consentId = await consentManager.consentCounter() - 1n;
      await consentManager.connect(patient).revokeConsent(consentId);

      const [hasConsent] = await consentManager.hasActiveConsent(
        patient.address,
        provider.address,
        "medical_records"
      );

      expect(hasConsent).to.be.false;
    });
  });
});

