/**
 * Example E2E Test
 * 
 * This example demonstrates how to write end-to-end tests using Playwright.
 */

import { test, expect } from '@playwright/test';

test.describe('Example Feature', () => {
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
            return '0x539'; // 1337
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    });

    await page.goto('/');
  });

  test('should complete user workflow', async ({ page }) => {
    // Step 1: Connect wallet
    await page.getByText('Connect Wallet').click();
    await page.getByRole('button', { name: /connect metamask/i }).click();
    await page.waitForTimeout(1000);

    // Step 2: Navigate to feature
    await page.getByRole('link', { name: /feature/i }).click();
    await expect(page).toHaveURL(/.*feature/);

    // Step 3: Perform action
    await page.getByRole('button', { name: /action/i }).click();

    // Step 4: Verify result
    await expect(page.getByText('Success')).toBeVisible();
  });

  test('should handle error case', async ({ page }) => {
    // Mock error response
    await page.route('**/api/endpoint', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    await page.goto('/feature');
    await page.getByRole('button', { name: /action/i }).click();

    await expect(page.getByText(/error/i)).toBeVisible();
  });
});

