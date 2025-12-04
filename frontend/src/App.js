import React, { useState, useEffect } from 'react';
import './App.css';
import Web3Connection from './components/Web3Connection';
import ConsentManager from './components/ConsentManager';
import PatientDataViewer from './components/PatientDataViewer';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [patientsRes, providersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/patients`),
        fetch(`${API_BASE_URL}/api/providers`)
      ]);

      const patientsData = await patientsRes.json();
      const providersData = await providersRes.json();

      if (patientsData.success) {
        setPatients(patientsData.data);
      }
      if (providersData.success) {
        setProviders(providersData.data);
      }
    } catch (err) {
      setError('Failed to load data from backend');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🏥 Healthcare Blockchain Assessment</h1>
        <p>Patient Consent Management System</p>
      </header>

      <div className="container">
        <Web3Connection
          account={account}
          setAccount={setAccount}
          contract={contract}
          setContract={setContract}
        />

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="loading">Loading data...</div>
        ) : (
          <>
            <ConsentManager
              account={account}
              contract={contract}
              patients={patients}
              providers={providers}
            />
            <PatientDataViewer
              patients={patients}
              providers={providers}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default App;

