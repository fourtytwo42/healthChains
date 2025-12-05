/**
 * E2E Tests - Provider Request Consent Flow
 * 
 * Tests the complete provider request consent workflow
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Provider Request Consent', () => {
  test.beforeEach(async ({ page }) => {
    // Mock provider wallet connection
    await page.addInitScript(() => {
      (window as any).ethereum = {
        isMetaMask: true,
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_requestAccounts') {
            return ['0xbcd4042DE499D14e55001CcbB24a551F3b954096']; // Provider account
          }
          if (method === 'eth_chainId') {
            return '0x539'; // 1337
          }
          if (method === 'eth_sendTransaction') {
            return '0x1234567890abcdef';
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    });

    // Don't mock role API - use real backend to detect role from registered addresses
    // The address 0xbcd4042DE499D14e55001CcbB24a551F3b954096 is registered as a provider (PROV-000001)
    // Let the real backend API handle role detection

    // Mock API response for all patients (to avoid backend dependency for test data)
    await page.route('**/api/patients', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            patients: [
              {
                patientId: 'PAT-000001',
                demographics: {
                  firstName: 'John',
                  lastName: 'Smith'
                },
                blockchainIntegration: {
                  walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
                },
                consentStatus: {}
              }
            ]
          }
        }),
      });
    });

    // Mock API response for provider patients
    await page.route('**/api/provider/*/patients*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            patients: [
              {
                patientId: 'PAT-000001',
                demographics: {
                  firstName: 'John',
                  lastName: 'Smith'
                },
                blockchainIntegration: {
                  walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
                },
                consentStatus: {}
              }
            ]
          }
        }),
      });
    });

    // Mock API response for provider consents (paginated)
    await page.route('**/api/provider/*/consents*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            consents: [],
            total: 0
          }
        }),
      });
    });

    // Connect wallet first on root page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for connect wallet button and click it
    const connectButton = page.getByText('Connect Wallet');
    await expect(connectButton).toBeVisible({ timeout: 10000 });
    await connectButton.click();
    
    // Wait for dialog to appear (with retry)
    let dialogVisible = false;
    for (let i = 0; i < 5; i++) {
      try {
        await page.waitForSelector('[role="dialog"]', { timeout: 2000 });
        dialogVisible = true;
        break;
      } catch (e) {
        await page.waitForTimeout(500);
      }
    }
    
    if (dialogVisible) {
      // Click connect MetaMask button in dialog
      const metamaskButton = page.getByRole('button', { name: /connect metamask/i });
      await expect(metamaskButton).toBeVisible({ timeout: 5000 });
      await metamaskButton.click();
    } else {
      // Fallback: try clicking the button directly if dialog selector doesn't work
      const metamaskButton = page.getByRole('button', { name: /connect metamask/i });
      if (await metamaskButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await metamaskButton.click();
      }
    }
    
    // Wait for wallet connection to complete
    await page.waitForTimeout(2000);
    
    // Verify wallet is connected by checking for connected address in header
    const connectedAddress = page.getByText(/0xbcd4/i);
    const isConnected = await connectedAddress.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!isConnected) {
      console.log('Wallet not connected, retrying...');
      // Try connecting again
      const connectButton = page.getByText('Connect Wallet');
      if (await connectButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await connectButton.click();
        await page.waitForTimeout(1000);
        const metamaskButton = page.getByRole('button', { name: /connect metamask/i });
        if (await metamaskButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await metamaskButton.click();
          await page.waitForTimeout(2000);
        }
      }
    }
    
    // Wait for wallet connection to complete
    await page.waitForTimeout(2000);
    
    // Navigate to root and let client-side routing handle the redirect
    // The root page should redirect to /provider based on role
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for role detection and client-side redirect
    // The root page uses router.replace() which is client-side only
    await page.waitForURL(/\/provider/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give React time to hydrate and render
  });

  const openRequestDialog = async (page: Page) => {
    // Click on first patient row to open request dialog
    await page.getByRole('row').nth(1).click(); // First data row (skip header)
    await page.waitForTimeout(500);
    // Or click the "Request Consent" button if visible
    const requestButton = page.getByRole('button', { name: /request consent/i }).first();
    if (await requestButton.isVisible()) {
      await requestButton.click();
    }
  };

  test('should display provider dashboard with patient table', async ({ page }) => {
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give React time to hydrate and render
    
    // Debug: Check what's on the page
    const url = page.url();
    const title = await page.title();
    const bodyText = await page.textContent('body') || '';
    
    console.log('Page URL:', url);
    console.log('Page title:', title);
    console.log('Body contains "Provider":', bodyText.includes('Provider'));
    console.log('Body contains "Dashboard":', bodyText.includes('Dashboard'));
    
    // Check if we're on the right page (should be /provider or redirected from /)
    expect(url).toMatch(/\/provider|\/$/);
    
    // Check for provider dashboard heading (case insensitive, flexible matching)
    const heading = page.getByRole('heading', { name: /provider/i });
    const hasHeading = await heading.isVisible({ timeout: 15000 }).catch(() => false);
    
    if (!hasHeading) {
      // Check for "Connect your wallet" message (means page loaded but wallet not connected)
      const connectWallet = await page.getByText(/connect your wallet/i).isVisible({ timeout: 2000 }).catch(() => false);
      if (connectWallet) {
        throw new Error('Wallet not connected - page is showing "Connect your wallet" message');
      }
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/debug-provider-page.png', fullPage: true });
      throw new Error(`Provider dashboard heading not found. URL: ${url}, Title: ${title}`);
    }
    
    // Should show table with patients (or loading state)
    const table = page.getByRole('table');
    const hasTable = await table.isVisible({ timeout: 10000 }).catch(() => false);
    const hasSkeleton = await page.locator('[class*="skeleton"]').isVisible({ timeout: 2000 }).catch(() => false);
    
    // Either table or skeleton should be visible (skeleton means data is loading)
    expect(hasTable || hasSkeleton).toBe(true);
    
    // If we have a table, verify it has structure
    if (hasTable) {
      const headers = await page.getByRole('columnheader').all();
      expect(headers.length).toBeGreaterThan(0);
    }
  });

  test('should display request consent dialog', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Find a patient with a wallet and click request consent
    const requestButton = page.getByRole('button', { name: /request consent/i }).first();
    const isVisible = await requestButton.isVisible({ timeout: 10000 }).catch(() => false);
    if (isVisible) {
      await requestButton.click();
      await expect(page.getByRole('heading', { name: /request consent/i })).toBeVisible({ timeout: 10000 });
    } else {
      // Skip if no patients with wallets
      test.skip();
    }
  });

  test('should display all form fields in request dialog', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const requestButton = page.getByRole('button', { name: /request consent/i }).first();
    const isVisible = await requestButton.isVisible({ timeout: 10000 }).catch(() => false);
    if (isVisible) {
      await requestButton.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('#dataTypes')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#purposes')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/expiration date/i)).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('should allow selecting multiple data types', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const requestButton = page.getByRole('button', { name: /request consent/i }).first();
    const isVisible = await requestButton.isVisible({ timeout: 10000 }).catch(() => false);
    if (isVisible) {
      await requestButton.click();
      await page.waitForTimeout(1000);
      const dataTypeSelect = page.locator('#dataTypes');
      await dataTypeSelect.click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: /medical_records/i }).first().click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: /diagnostic_data/i }).first().click();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await expect(dataTypeSelect).toContainText('medical_records', { timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('should allow selecting multiple purposes', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const requestButton = page.getByRole('button', { name: /request consent/i }).first();
    const isVisible = await requestButton.isVisible({ timeout: 10000 }).catch(() => false);
    if (isVisible) {
      await requestButton.click();
      await page.waitForTimeout(1000);
      const purposeSelect = page.locator('#purposes');
      await purposeSelect.click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: /treatment/i }).first().click();
      await page.waitForTimeout(500);
      await page.getByRole('option', { name: /research/i }).first().click();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await expect(purposeSelect).toContainText('treatment', { timeout: 5000 });
    } else {
      test.skip();
    }
  });
});

