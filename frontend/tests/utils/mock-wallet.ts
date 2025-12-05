/**
 * Mock Wallet Utilities
 * 
 * Provides utilities for mocking MetaMask wallet in tests
 */

export interface MockWallet {
  isConnected: boolean;
  account: string | null;
  chainId: number | null;
  connect: jest.Mock;
  disconnect: jest.Mock;
  switchNetwork: jest.Mock;
  getSigner: jest.Mock;
}

/**
 * Create a mock wallet for testing
 */
export function createMockWallet(overrides?: Partial<MockWallet>): MockWallet {
  const defaultAccount = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  const defaultChainId = 1337;

  return {
    isConnected: true,
    account: defaultAccount,
    chainId: defaultChainId,
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    switchNetwork: jest.fn().mockResolvedValue(undefined),
    getSigner: jest.fn().mockResolvedValue({
      getAddress: jest.fn().mockResolvedValue(defaultAccount),
    }),
    ...overrides,
  };
}

/**
 * Mock window.ethereum for MetaMask
 */
export function mockWindowEthereum(wallet?: Partial<MockWallet>) {
  const mockWallet = createMockWallet(wallet);

  (window as any).ethereum = {
    isMetaMask: true,
    request: jest.fn().mockImplementation(({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts':
          return Promise.resolve([mockWallet.account]);
        case 'eth_accounts':
          return Promise.resolve(mockWallet.account ? [mockWallet.account] : []);
        case 'eth_chainId':
          return Promise.resolve(
            mockWallet.chainId ? `0x${mockWallet.chainId.toString(16)}` : '0x539'
          );
        case 'wallet_switchEthereumChain':
          return Promise.resolve(null);
        default:
          return Promise.resolve(null);
      }
    }),
    on: jest.fn(),
    removeListener: jest.fn(),
  };

  return mockWallet;
}

/**
 * Clean up window.ethereum mock
 */
export function cleanupWindowEthereum() {
  delete (window as any).ethereum;
}

