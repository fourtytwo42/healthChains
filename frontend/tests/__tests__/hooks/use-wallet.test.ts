/**
 * Wallet Context Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { WalletProvider, useWallet } from '@/contexts/wallet-context';
import { mockWindowEthereum, cleanupWindowEthereum } from '../../utils/mock-wallet';

describe('useWallet', () => {
  beforeEach(() => {
    mockWindowEthereum();
  });

  afterEach(() => {
    cleanupWindowEthereum();
  });

  it('should provide wallet context', () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: WalletProvider,
    });

    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('isConnected');
    expect(result.current).toHaveProperty('account');
    expect(result.current).toHaveProperty('connect');
    expect(result.current).toHaveProperty('disconnect');
  });

  it('should start with disconnected state', () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: WalletProvider,
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.account).toBeNull();
  });

  it('should connect wallet successfully', async () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: WalletProvider,
    });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('should get signer when connected', async () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: WalletProvider,
    });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(async () => {
      const signer = await result.current.getSigner();
      expect(signer).toBeDefined();
    });
  });

  it('should check network correctly', async () => {
    const { result } = renderHook(() => useWallet(), {
      wrapper: WalletProvider,
    });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(async () => {
      const isCorrectNetwork = await result.current.checkNetwork();
      expect(typeof isCorrectNetwork).toBe('boolean');
    });
  });
});

