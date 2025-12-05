/**
 * Wallet Connector Component Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletConnector } from '@/components/wallet-connector';
import { WalletProvider } from '@/contexts/wallet-context';
import { mockWindowEthereum, cleanupWindowEthereum } from '../../utils/mock-wallet';

// Mock the wallet context
jest.mock('@/contexts/wallet-context', () => ({
  useWallet: jest.fn(),
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { useWallet } from '@/contexts/wallet-context';

describe('WalletConnector', () => {
  const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

  beforeEach(() => {
    mockWindowEthereum();
  });

  afterEach(() => {
    cleanupWindowEthereum();
    jest.clearAllMocks();
  });

  it('should render connect button when not connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      account: null,
      chainId: null,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      checkNetwork: jest.fn(),
      switchNetwork: jest.fn(),
      getSigner: jest.fn(),
    });

    render(<WalletConnector />);

    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('should show connecting state', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      account: null,
      chainId: null,
      isConnecting: true,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      checkNetwork: jest.fn(),
      switchNetwork: jest.fn(),
      getSigner: jest.fn(),
    });

    render(<WalletConnector />);

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('should display connected wallet address', () => {
    const mockAccount = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    mockUseWallet.mockReturnValue({
      isConnected: true,
      account: mockAccount,
      chainId: 1337,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      checkNetwork: jest.fn(),
      switchNetwork: jest.fn(),
      getSigner: jest.fn(),
    });

    render(<WalletConnector />);

    expect(screen.getByText('0xf39f...2266')).toBeInTheDocument();
  });

  it('should show wrong network badge when chain ID does not match', () => {
    const mockAccount = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
    mockUseWallet.mockReturnValue({
      isConnected: true,
      account: mockAccount,
      chainId: 1, // Wrong chain ID
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      checkNetwork: jest.fn(),
      switchNetwork: jest.fn(),
      getSigner: jest.fn(),
    });

    render(<WalletConnector />);

    expect(screen.getByText('Wrong Network')).toBeInTheDocument();
  });

  it('should call disconnect when disconnect button is clicked', async () => {
    const user = userEvent.setup();
    const mockDisconnect = jest.fn();
    const mockAccount = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

    mockUseWallet.mockReturnValue({
      isConnected: true,
      account: mockAccount,
      chainId: 1337,
      isConnecting: false,
      error: null,
      connect: jest.fn(),
      disconnect: mockDisconnect,
      checkNetwork: jest.fn(),
      switchNetwork: jest.fn(),
      getSigner: jest.fn(),
    });

    render(<WalletConnector />);

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    await user.click(disconnectButton);

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it('should display error message when error exists', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      account: null,
      chainId: null,
      isConnecting: false,
      error: 'Connection failed',
      connect: jest.fn(),
      disconnect: jest.fn(),
      checkNetwork: jest.fn(),
      switchNetwork: jest.fn(),
      getSigner: jest.fn(),
    });

    render(<WalletConnector />);

    // Open dialog first
    const connectButton = screen.getByText('Connect Wallet');
    userEvent.click(connectButton);

    waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });
});

