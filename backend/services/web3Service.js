const { ethers } = require('ethers');
const fs = require('fs').promises; // Use async file operations
const fsSync = require('fs'); // Keep sync version for existsSync only
const path = require('path');
const { ConfigurationError, Web3ConnectionError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Web3 Service - Centralized blockchain connection and contract management
 * 
 * Handles:
 * - Provider initialization and connection management
 * - Contract ABI loading from compiled artifacts
 * - Contract address loading from deployment.json or environment
 * - Connection health checks and retry logic
 * 
 * @class Web3Service
 */
class Web3Service {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.signer = null;
    this.signedContract = null; // Contract instance with signer for write operations
    this.contractAddress = null;
    this.networkName = null;
    this.chainId = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the Web3 service with provider and contract
   * 
   * Loads configuration from environment variables with sensible defaults.
   * Sets up JsonRpcProvider and loads contract ABI and address.
   * 
   * @throws {ConfigurationError} If required configuration is missing
   * @throws {Web3ConnectionError} If RPC connection fails
   */
  /**
   * Reset the service to allow re-initialization
   */
  reset() {
    this.provider = null;
    this.contract = null;
    this.signer = null;
    this.signedContract = null;
    this.contractAddress = null;
    this.networkName = null;
    this.chainId = null;
    this.isInitialized = false;
  }

  async initialize() {
    // Allow re-initialization if contract address changes (for tests)
    const newContractAddress = process.env.CONTRACT_ADDRESS || await this._loadContractAddress();
    if (this.isInitialized && this.contractAddress === newContractAddress) {
      return;
    }
    
    // Reset if contract address changed
    if (this.isInitialized && this.contractAddress !== newContractAddress) {
      this.reset();
    }

    // Load configuration from environment
    const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
    const networkName = process.env.NETWORK_NAME || 'localhost';
    const requestTimeout = parseInt(process.env.REQUEST_TIMEOUT || '30000', 10);
    const maxRetries = parseInt(process.env.MAX_RETRIES || '3', 10);

    // Initialize provider with timeout and retry configuration
    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        staticNetwork: true
      });

      // Test connection
      await this.provider.getBlockNumber();
      
      // Get network info
      const network = await this.provider.getNetwork();
      this.chainId = Number(network.chainId);
      this.networkName = networkName;

      logger.info(`✅ Web3 Provider connected to ${rpcUrl}`);
      logger.info(`   Chain ID: ${this.chainId}`);
      logger.info(`   Network: ${this.networkName}`);
    } catch (error) {
      throw new Web3ConnectionError(
        `Failed to connect to RPC endpoint: ${rpcUrl}`,
        error
      );
    }

    // Load contract address
    this.contractAddress = await this._loadContractAddress();
    if (!this.contractAddress) {
      throw new ConfigurationError(
        'Contract address not found. Deploy contract first or set CONTRACT_ADDRESS environment variable.'
      );
    }
    
    // Verify contract exists at this address (with retry for test deployments)
    let code;
    let retries = 3;
    while (retries > 0) {
      try {
        code = await this.provider.getCode(this.contractAddress);
        if (code && code !== '0x' && code.length > 2) {
          break; // Contract exists
        }
        // Wait a bit and retry (contract might be deploying)
        if (retries > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        retries--;
      } catch (error) {
        retries--;
        if (retries === 0) {
          throw new Web3ConnectionError(
            `Failed to verify contract deployment at ${this.contractAddress}`,
            error
          );
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!code || code === '0x' || code.length <= 2) {
      throw new ConfigurationError(
        `No contract code found at address ${this.contractAddress}. Contract may not be deployed.`
      );
    }

    // Load contract ABI
    const abi = await this._loadContractABI();
    if (!abi) {
      throw new ConfigurationError(
        'Contract ABI not found. Compile contract first with: npm run compile:contract'
      );
    }

    // Create contract instance (read-only)
    this.contract = new ethers.Contract(
      this.contractAddress,
      abi,
      this.provider
    );

    // Create signer and signed contract instance for write operations (if private key provided)
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
      try {
        this.signer = new ethers.Wallet(privateKey, this.provider);
        this.signedContract = new ethers.Contract(
          this.contractAddress,
          abi,
          this.signer
        );
        logger.info(`Signer configured for write operations: ${this.signer.address}`);
      } catch (error) {
        logger.warn('Warning: Failed to create signer. Write operations will not be available', { error: error.message });
      }
    } else {
      logger.warn('⚠️  Warning: PRIVATE_KEY not set. Write operations will not be available.');
    }

    this.isInitialized = true;
    logger.info(`✅ Contract instance created at ${this.contractAddress}`);
  }

  /**
   * Get the contract instance (lazy initialization)
   * 
   * @returns {Promise<ethers.Contract>} Contract instance (read-only)
   * @throws {ConfigurationError} If service not initialized
   */
  async getContract() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.contract;
  }

  /**
   * Get the signed contract instance for write operations
   * 
   * @returns {Promise<ethers.Contract>} Signed contract instance
   * @throws {ConfigurationError} If service not initialized or signer not available
   */
  async getSignedContract() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    if (!this.signedContract) {
      throw new ConfigurationError(
        'Signed contract not available. Set PRIVATE_KEY environment variable for write operations.'
      );
    }
    return this.signedContract;
  }

  /**
   * Get the signer address
   * 
   * @returns {Promise<string|null>} Signer address or null if not available
   */
  async getSignerAddress() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.signer ? this.signer.address : null;
  }

  /**
   * Check if RPC connection is healthy
   * 
   * @returns {Promise<boolean>} True if connection is healthy
   */
  async isConnected() {
    try {
      if (!this.provider) {
        return false;
      }
      await this.provider.getBlockNumber();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current block number
   * 
   * @returns {Promise<number>} Current block number
   * @throws {Web3ConnectionError} If RPC call fails
   */
  async getBlockNumber() {
    if (!this.provider) {
      throw new Web3ConnectionError('Provider not initialized');
    }

    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      throw new Web3ConnectionError('Failed to get block number', error);
    }
  }

  /**
   * Get network information
   * 
   * @returns {Promise<Object>} Network info with chainId and name
   * @throws {Web3ConnectionError} If RPC call fails
   */
  async getNetworkInfo() {
    if (!this.provider) {
      throw new Web3ConnectionError('Provider not initialized');
    }

    try {
      const network = await this.provider.getNetwork();
      return {
        chainId: Number(network.chainId),
        name: this.networkName || network.name,
        address: this.contractAddress
      };
    } catch (error) {
      throw new Web3ConnectionError('Failed to get network info', error);
    }
  }

  /**
   * Load contract address from deployment.json or environment variable
   * 
   * @private
   * @returns {Promise<string|null>} Contract address or null
   */
  async _loadContractAddress() {
    // First try environment variable (highest priority - used in tests)
    if (process.env.CONTRACT_ADDRESS) {
      const address = process.env.CONTRACT_ADDRESS.trim();
      if (address && address.startsWith('0x')) {
        return address;
      }
    }

    // Then try deployment.json
    const deploymentPath = path.join(__dirname, '..', 'deployment.json');
    try {
      if (fsSync.existsSync(deploymentPath)) {
        const deploymentContent = await fs.readFile(deploymentPath, 'utf8');
        const deployment = JSON.parse(deploymentContent);
        if (deployment.address) {
          return deployment.address;
        }
      }
    } catch (error) {
      logger.warn('Warning: Could not read deployment.json:', error.message);
    }

    return null;
  }

  /**
   * Load contract ABI from compiled artifacts
   * 
   * @private
   * @returns {Promise<Array|null>} Contract ABI or null
   */
  async _loadContractABI() {
    const artifactPath = path.join(
      __dirname,
      '..',
      'artifacts',
      'contracts',
      'PatientConsentManager.sol',
      'PatientConsentManager.json'
    );

    try {
      if (fsSync.existsSync(artifactPath)) {
        const artifactContent = await fs.readFile(artifactPath, 'utf8');
        const artifact = JSON.parse(artifactContent);
        return artifact.abi;
      }
    } catch (error) {
      logger.warn('Warning: Could not read contract artifact:', error.message);
    }

    return null;
  }
}

// Export singleton instance
const web3Service = new Web3Service();
module.exports = web3Service;

