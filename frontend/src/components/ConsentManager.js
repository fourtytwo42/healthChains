import React, { useState } from 'react';
import './ConsentManager.css';

const ConsentManager = ({ account, contract, patients, providers }) => {
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [dataType, setDataType] = useState('medical_records');
  const [purpose, setPurpose] = useState('treatment');
  const [expirationDays, setExpirationDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [consents, setConsents] = useState([]);

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

  const purposes = [
    'treatment',
    'research',
    'analytics',
    'diagnosis',
    'preventive_care',
    'clinical_trial',
    'public_health'
  ];

  const grantConsent = async () => {
    if (!account || !contract) {
      setError('Please connect your wallet first');
      return;
    }

    if (!selectedPatient || !selectedProvider) {
      setError('Please select both patient and provider');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setTxHash(null);

      // Calculate expiration timestamp
      const expirationTime = expirationDays === '0' 
        ? 0 
        : Math.floor(Date.now() / 1000) + (parseInt(expirationDays) * 24 * 60 * 60);

      // Call smart contract
      const tx = await contract.grantConsent(
        selectedProvider,
        dataType,
        expirationTime,
        purpose
      );

      setTxHash(tx.hash);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Get the consent ID from the event (ethers v6)
      let consentId = null;
      try {
        // In ethers v6, events are parsed differently
        for (const log of receipt.logs) {
          try {
            const parsed = contract.interface.parseEventLog("ConsentGranted", log);
            if (parsed) {
              consentId = parsed.args.consentId.toString();
              break;
            }
          } catch {
            // Not the event we're looking for
            continue;
          }
        }
      } catch (parseError) {
        console.warn('Could not parse event:', parseError);
      }

      if (consentId) {
        
        setConsents([...consents, {
          id: consentId,
          patient: selectedPatient,
          provider: selectedProvider,
          dataType,
          purpose,
          timestamp: new Date().toISOString()
        }]);
      }

      alert('Consent granted successfully!');
    } catch (err) {
      console.error('Error granting consent:', err);
      setError('Failed to grant consent: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const requestAccess = async () => {
    if (!account || !contract) {
      setError('Please connect your wallet first');
      return;
    }

    if (!selectedPatient || !selectedProvider) {
      setError('Please select both patient and provider');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setTxHash(null);

      const tx = await contract.requestAccess(
        selectedPatient,
        dataType,
        purpose
      );

      setTxHash(tx.hash);
      await tx.wait();
      
      alert('Access request submitted successfully!');
    } catch (err) {
      console.error('Error requesting access:', err);
      setError('Failed to request access: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card consent-manager">
      <h2>📋 Consent Management</h2>

      <div className="form-section">
        <div className="input-group">
          <label>Patient Address</label>
          <select
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
            disabled={loading}
          >
            <option value="">Select a patient...</option>
            {patients.map((patient) => (
              <option key={patient.patientId} value={patient.patientId}>
                {patient.demographics.firstName} {patient.demographics.lastName} ({patient.patientId})
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>Provider Address</label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            disabled={loading}
          >
            <option value="">Select a provider...</option>
            {providers.map((provider) => (
              <option key={provider.providerId} value={provider.blockchainIntegration.walletAddress}>
                {provider.organizationName} ({provider.providerId})
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>Data Type</label>
          <select
            value={dataType}
            onChange={(e) => setDataType(e.target.value)}
            disabled={loading}
          >
            {dataTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>Purpose</label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            disabled={loading}
          >
            {purposes.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label>Expiration (days, 0 for no expiration)</label>
          <input
            type="number"
            value={expirationDays}
            onChange={(e) => setExpirationDays(e.target.value)}
            min="0"
            disabled={loading}
          />
        </div>

        <div className="button-group">
          <button
            className="button"
            onClick={grantConsent}
            disabled={loading || !account || !contract}
          >
            {loading ? 'Processing...' : 'Grant Consent'}
          </button>

          <button
            className="button"
            onClick={requestAccess}
            disabled={loading || !account || !contract}
            style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
          >
            {loading ? 'Processing...' : 'Request Access'}
          </button>
        </div>
      </div>

      {txHash && (
        <div className="info-box" style={{ marginTop: '15px' }}>
          <strong>Transaction Hash:</strong>
          <div className="tx-hash">{txHash}</div>
        </div>
      )}

      {error && (
        <div className="error-message" style={{ marginTop: '15px' }}>
          ⚠️ {error}
        </div>
      )}

      {consents.length > 0 && (
        <div className="consents-list" style={{ marginTop: '20px' }}>
          <h3>Recent Consents</h3>
          {consents.map((consent, index) => (
            <div key={index} className="consent-item">
              <strong>Consent ID:</strong> {consent.id}<br />
              <strong>Data Type:</strong> {consent.dataType}<br />
              <strong>Purpose:</strong> {consent.purpose}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConsentManager;

