import React, { useState } from 'react';
import './PatientDataViewer.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const PatientDataViewer = ({ patients, providers }) => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedDataType, setSelectedDataType] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const dataTypes = [
    'medical_records',
    'diagnostic_data',
    'genetic_data',
    'imaging_data',
    'laboratory_results',
    'prescription_history',
    'vital_signs',
    'treatment_history'
  ];

  const fetchPatientData = async () => {
    if (!selectedPatient || !selectedDataType) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/patients/${selectedPatient}/data/${selectedDataType}`
      );
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        setData(null);
        alert('Failed to fetch data: ' + result.message);
      }
    } catch (err) {
      console.error('Error fetching patient data:', err);
      setData(null);
      alert('Error fetching patient data');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = (patientId) => {
    setSelectedPatient(patientId);
    setData(null);
    setSelectedDataType('');
  };

  return (
    <div className="card patient-data-viewer">
      <h2>👤 Patient Data Viewer</h2>

      <div className="viewer-controls">
        <div className="input-group">
          <label>Select Patient</label>
          <select
            value={selectedPatient || ''}
            onChange={(e) => handlePatientSelect(e.target.value)}
          >
            <option value="">Select a patient...</option>
            {patients.map((patient) => (
              <option key={patient.patientId} value={patient.patientId}>
                {patient.demographics.firstName} {patient.demographics.lastName} - {patient.patientId}
              </option>
            ))}
          </select>
        </div>

        {selectedPatient && (
          <>
            <div className="input-group">
              <label>Data Type</label>
              <select
                value={selectedDataType}
                onChange={(e) => setSelectedDataType(e.target.value)}
                disabled={loading}
              >
                <option value="">Select data type...</option>
                {dataTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="button"
              onClick={fetchPatientData}
              disabled={!selectedDataType || loading}
            >
              {loading ? 'Loading...' : 'View Data'}
            </button>
          </>
        )}
      </div>

      {selectedPatient && !selectedDataType && (
        <div className="info-box">
          <strong>Patient Selected:</strong> {selectedPatient}
          <p>Please select a data type to view patient information.</p>
        </div>
      )}

      {data && (
        <div className="data-display">
          <h3>Data: {selectedDataType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
          <pre className="json-display">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}

      {selectedPatient && patients.find(p => p.patientId === selectedPatient) && (
        <div className="patient-summary">
          <h3>Patient Summary</h3>
          {(() => {
            const patient = patients.find(p => p.patientId === selectedPatient);
            return (
              <div className="summary-grid">
                <div className="summary-item">
                  <strong>Name:</strong> {patient.demographics.firstName} {patient.demographics.lastName}
                </div>
                <div className="summary-item">
                  <strong>Age:</strong> {patient.demographics.age}
                </div>
                <div className="summary-item">
                  <strong>Gender:</strong> {patient.demographics.gender}
                </div>
                <div className="summary-item">
                  <strong>Conditions:</strong> {patient.medicalHistory.conditions.length}
                </div>
                <div className="summary-item">
                  <strong>Medications:</strong> {patient.currentMedications.length}
                </div>
                <div className="summary-item">
                  <strong>Lab Results:</strong> {patient.laboratoryResults.length}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default PatientDataViewer;

