/**
 * E2E Tests - Wallet Connection
 * 
 * Tests the MetaMask wallet connection flow
 */

import { test, expect } from '@playwright/test';

test.describe('Wallet Connection', () => {
  test.beforeEach(async ({ page }) => {
    // Mock window.ethereum for MetaMask
    await page.addInitScript(() => {
      (window as any).ethereum = {
        isMetaMask: true,
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_requestAccounts') {
            return ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'];
          }
          if (method === 'eth_chainId') {
            return '0x539'; // 1337 in hex
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    });

    await page.goto('/');
  });

  test('should display connect wallet button when not connected', async ({ page }) => {
    await expect(page.getByText('Connect Wallet')).toBeVisible();
  });

  test('should open connection dialog when connect button is clicked', async ({ page }) => {
    await page.getByText('Connect Wallet').click();
    
    await expect(page.getByText('Connect MetaMask Wallet')).toBeVisible();
    await expect(page.getByText(/connect your metamask wallet/i)).toBeVisible();
  });

  test('should connect wallet successfully', async ({ page }) => {
    await page.getByText('Connect Wallet').click();
    await page.getByRole('button', { name: /connect metamask/i }).click();
    
    // Wait for connection
    await page.waitForTimeout(1000);
    
    // Should show connected address
    await expect(page.getByText(/0xf39f...2266/i)).toBeVisible();
  });

  test('should show wrong network badge when on wrong network', async ({ page }) => {
    // Mock wrong chain ID
    await page.addInitScript(() => {
      (window as any).ethereum = {
        isMetaMask: true,
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_requestAccounts') {
            return ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'];
          }
          if (method === 'eth_chainId') {
            return '0x1'; // Mainnet (wrong network)
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    });

    await page.reload();
    await page.getByText('Connect Wallet').click();
    await page.getByRole('button', { name: /connect metamask/i }).click();

    await expect(page.getByText(/network mismatch\. current: 1/i)).toBeVisible();
  });
});

