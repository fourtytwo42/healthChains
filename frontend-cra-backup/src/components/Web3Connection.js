import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './Web3Connection.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const Web3Connection = ({ account, setAccount, contract, setContract }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [contractInfo, setContractInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchContractInfo();
  }, []);

  const fetchContractInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/contract/info`);
      const data = await response.json();
      if (data.success) {
        setContractInfo(data.contract);
      }
    } catch (err) {
      console.error('Error fetching contract info:', err);
    }
  };

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      if (typeof window.ethereum !== 'undefined') {
        // Request account access
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });

        if (accounts.length > 0) {
          setAccount(accounts[0]);

          // Create provider and signer (ethers v6)
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();

          // Load contract if address is available
          if (contractInfo && contractInfo.address) {
            try {
              // In a real app, you'd load the ABI from artifacts
              // For now, we'll create a basic contract instance
              const contractAddress = contractInfo.address;
              
              // Note: In production, load ABI from compiled contract artifacts
              const basicABI = [
                "function grantConsent(address provider, string memory dataType, uint256 expirationTime, string memory purpose) public returns (uint256)",
                "function revokeConsent(uint256 consentId) public",
                "function requestAccess(address patient, string memory dataType, string memory purpose) public returns (uint256)",
                "function hasActiveConsent(address patient, address provider, string memory dataType) public view returns (bool, uint256)",
                "function getPatientConsents(address patient) public view returns (uint256[])",
                "event ConsentGranted(uint256 indexed consentId, address indexed patient, address indexed provider, string dataType, uint256 timestamp)"
              ];

              const contractInstance = new ethers.Contract(
                contractAddress,
                basicABI,
                signer
              );

              setContract(contractInstance);
            } catch (contractError) {
              console.error('Error loading contract:', contractError);
              setError('Contract not deployed or address invalid. Please deploy the contract first.');
            }
          } else {
            setError('Contract not deployed. Please deploy the PatientConsentManager contract first.');
          }
        }
      } else {
        setError('MetaMask or another Web3 wallet is not installed. Please install MetaMask.');
      }
    } catch (err) {
      console.error('Error connecting wallet:', err);
      setError('Failed to connect wallet: ' + err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setContract(null);
  };

  return (
    <div className="card web3-connection">
      <h2>🔗 Web3 Connection</h2>
      
      {!account ? (
        <div>
          <p>Connect your Web3 wallet to interact with the smart contract.</p>
          <button
            className="button"
            onClick={connectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      ) : (
        <div>
          <div className="info-box">
            <strong>Connected Account:</strong>
            <div className="account-address">{account}</div>
          </div>
          
          {contractInfo && (
            <div className="info-box">
              <strong>Contract Address:</strong>
              <div className="contract-address">
                {contractInfo.address || 'Not deployed'}
              </div>
              <div className="contract-network">
                Network: {contractInfo.network || 'localhost'}
              </div>
            </div>
          )}

          {contract && (
            <div className="status-badge status-active">
              ✓ Contract Loaded
            </div>
          )}

          <button className="button" onClick={disconnectWallet}>
            Disconnect
          </button>
        </div>
      )}

      {error && (
        <div className="error-message" style={{ marginTop: '15px' }}>
          ⚠️ {error}
        </div>
      )}

      {!contractInfo?.address && (
        <div className="info-box" style={{ marginTop: '15px', background: '#fff3cd', borderColor: '#ffc107' }}>
          <strong>⚠️ Setup Required:</strong>
          <p>Please deploy the PatientConsentManager contract first:</p>
          <code>cd backend && npm run deploy:local</code>
        </div>
      )}
    </div>
  );
};

export default Web3Connection;

