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
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.getByText('Connect Wallet').click();
    
    await expect(page.getByText('Connect MetaMask Wallet')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/connect your metamask wallet/i)).toBeVisible({ timeout: 5000 });
  });

  test('should connect wallet successfully', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.getByText('Connect Wallet').click();
    await page.getByRole('button', { name: /connect metamask/i }).click();
    
    // Wait for connection and redirect
    await page.waitForTimeout(3000);
    
    // Should redirect to role-based page and show connected address
    await page.waitForURL(/\/(patient|provider)$/, { timeout: 10000 }).catch(() => {});
    const url = page.url();
    expect(url).toMatch(/\/(patient|provider)$/);
    // Check for connected address (might be in header)
    const addressText = page.getByText(/0xf39f...2266/i);
    await expect(addressText).toBeVisible({ timeout: 10000 });
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
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.getByText('Connect Wallet').click();
    await page.getByRole('button', { name: /connect metamask/i }).click();
    await page.waitForTimeout(1000);

    await expect(page.getByText(/network mismatch/i)).toBeVisible({ timeout: 10000 });
  });
});

