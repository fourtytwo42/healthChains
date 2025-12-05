/**
 * Consent Grant Dialog Component Tests
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GrantConsentDialog } from '@/components/consent-grant-dialog';
import { render as renderWithProviders } from '../../utils/test-utils';
import { server } from '../../utils/msw-server';
import { handlers } from '../../utils/mock-api';

const defaultWalletState = {
  account: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  isConnected: true,
};

// Mock wallet context
jest.mock('@/contexts/wallet-context', () => ({
  useWallet: jest.fn(() => defaultWalletState),
}));

// Mock API hooks
jest.mock('@/hooks/use-api', () => ({
  useGrantConsent: jest.fn(() => ({
    mutate: jest.fn(),
    isPending: false,
  })),
  useProviders: jest.fn(() => ({
    data: [
      {
        providerId: 'PROV-000001',
        organizationName: 'Test Hospital',
        blockchainIntegration: {
          walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        },
      },
    ],
  })),
  useDataTypes: jest.fn(() => ({
    data: ['medical_records', 'diagnostic_data', 'genetic_data'],
  })),
  usePurposes: jest.fn(() => ({
    data: ['treatment', 'research', 'analytics'],
  })),
}));

describe('GrantConsentDialog', () => {
  const { useWallet } = require('@/contexts/wallet-context');

  beforeEach(() => {
    useWallet.mockReturnValue(defaultWalletState);
  });

  beforeAll(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('should render dialog trigger button', () => {
    renderWithProviders(<GrantConsentDialog />);

    expect(screen.getByText('Grant Consent')).toBeInTheDocument();
  });

  it('should open dialog when trigger is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantConsentDialog />);

    const trigger = screen.getByText('Grant Consent');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Grant Consent', { selector: 'h2' })).toBeInTheDocument();
    });
  });

  it('should show wallet connection message when not connected', async () => {
    useWallet.mockReturnValue({
      account: null,
      isConnected: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<GrantConsentDialog />);

    const trigger = screen.getByText('Grant Consent');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
    });
  });

  it('should display provider multi-select', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantConsentDialog />);

    const trigger = screen.getByText('Grant Consent');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByLabelText(/providers/i)).toBeInTheDocument();
    });
  });

  it('should display data types multi-select', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantConsentDialog />);

    const trigger = screen.getByText('Grant Consent');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByLabelText(/data types/i)).toBeInTheDocument();
    });
  });

  it('should display purposes multi-select', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantConsentDialog />);

    const trigger = screen.getByText('Grant Consent');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByLabelText(/purposes/i)).toBeInTheDocument();
    });
  });

  it('should display expiration date picker', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantConsentDialog />);

    const trigger = screen.getByText('Grant Consent');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByLabelText(/expiration date/i)).toBeInTheDocument();
    });
  });

  it('should disable submit button when no selections made', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantConsentDialog />);

    const trigger = screen.getByText('Grant Consent');
    await user.click(trigger);

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /grant consent/i });
      expect(submitButton).toBeDisabled();
    });
  });
});

