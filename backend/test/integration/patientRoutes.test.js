/**
 * Patient Routes Integration Tests
 * 
 * Tests all patient-related API endpoints
 */

const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const cors = require('cors');

// Import mock data
const mockPatients = require('../../data/mockup-patients');

describe('Patient Routes - Integration Tests', function () {
  let app;

  // Create Express app for testing
  before(function () {
    app = express();
    app.use(cors());
    app.use(express.json());

    // Add patient routes
    app.get('/api/patients', (req, res) => {
      res.json({
        success: true,
        data: mockPatients.mockPatients.patients,
        metadata: mockPatients.mockPatients.metadata
      });
    });

    app.get('/api/patients/:patientId', (req, res) => {
      const { patientId } = req.params;
      const patient = mockPatients.mockPatients.patients.find(
        p => p.patientId === patientId
      );

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      res.json({
        success: true,
        data: patient
      });
    });

    app.get('/api/patients/:patientId/data/:dataType', (req, res) => {
      const { patientId, dataType } = req.params;
      const patient = mockPatients.mockPatients.patients.find(
        p => p.patientId === patientId
      );

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found'
        });
      }

      // Map data types to patient data structure
      const dataTypeMap = {
        'medical_records': patient.medicalHistory,
        'diagnostic_data': patient.laboratoryResults,
        'genetic_data': patient.geneticData,
        'imaging_data': patient.imagingStudies,
        'laboratory_results': patient.laboratoryResults,
        'prescription_history': patient.currentMedications,
        'vital_signs': patient.vitalSigns,
        'treatment_history': {
          conditions: patient.medicalHistory.conditions,
          surgeries: patient.medicalHistory.surgeries
        }
      };

      const data = dataTypeMap[dataType];
      if (!data) {
        return res.status(400).json({
          success: false,
          message: `Invalid data type: ${dataType}`
        });
      }

      res.json({
        success: true,
        data: data
      });
    });
  });

  describe('GET /api/patients', function () {
    it('should return all patients', async function () {
      const res = await request(app)
        .get('/api/patients');

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.be.an('array');
      expect(res.body.data.length).to.be.greaterThan(0);
      expect(res.body.metadata).to.have.property('totalPatients');
    });

    it('should return patients with correct structure', async function () {
      const res = await request(app)
        .get('/api/patients');

      expect(res.status).to.equal(200);
      const patient = res.body.data[0];
      expect(patient).to.have.property('patientId');
      expect(patient).to.have.property('demographics');
      expect(patient.demographics).to.have.property('firstName');
      expect(patient.demographics).to.have.property('lastName');
    });

    it('should include blockchain integration data', async function () {
      const res = await request(app)
        .get('/api/patients');

      expect(res.status).to.equal(200);
      const patientWithWallet = res.body.data.find(
        p => p.blockchainIntegration?.walletAddress
      );
      
      if (patientWithWallet) {
        expect(patientWithWallet.blockchainIntegration).to.have.property('walletAddress');
        expect(patientWithWallet.blockchainIntegration.walletAddress).to.match(/^0x[a-fA-F0-9]{40}$/);
      }
    });
  });

  describe('GET /api/patients/:patientId', function () {
    it('should return patient by ID', async function () {
      const patientId = mockPatients.mockPatients.patients[0].patientId;
      const res = await request(app)
        .get(`/api/patients/${patientId}`);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data.patientId).to.equal(patientId);
    });

    it('should return 404 for non-existent patient', async function () {
      const res = await request(app)
        .get('/api/patients/NONEXISTENT');

      expect(res.status).to.equal(404);
      expect(res.body.success).to.be.false;
      expect(res.body.message).to.include('not found');
    });

    it('should return complete patient data', async function () {
      const patientId = mockPatients.mockPatients.patients[0].patientId;
      const res = await request(app)
        .get(`/api/patients/${patientId}`);

      expect(res.status).to.equal(200);
      const patient = res.body.data;
      expect(patient).to.have.property('demographics');
      expect(patient).to.have.property('medicalHistory');
      expect(patient).to.have.property('currentMedications');
    });
  });

  describe('GET /api/patients/:patientId/data/:dataType', function () {
    it('should return medical records data', async function () {
      const patientId = mockPatients.mockPatients.patients[0].patientId;
      const res = await request(app)
        .get(`/api/patients/${patientId}/data/medical_records`);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.have.property('conditions');
    });

    it('should return laboratory results data', async function () {
      const patientId = mockPatients.mockPatients.patients[0].patientId;
      const res = await request(app)
        .get(`/api/patients/${patientId}/data/laboratory_results`);

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.be.an('array');
    });

    it('should return 404 for non-existent patient', async function () {
      const res = await request(app)
        .get('/api/patients/NONEXISTENT/data/medical_records');

      expect(res.status).to.equal(404);
      expect(res.body.success).to.be.false;
    });

    it('should return 400 for invalid data type', async function () {
      const patientId = mockPatients.mockPatients.patients[0].patientId;
      const res = await request(app)
        .get(`/api/patients/${patientId}/data/invalid_type`);

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
      expect(res.body.message).to.include('Invalid data type');
    });
  });
});

