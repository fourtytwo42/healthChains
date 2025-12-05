/**
 * E2E Tests - Consent Granting
 * 
 * Tests the complete consent granting workflow
 */

import { test, expect } from '@playwright/test';

test.describe('Consent Granting', () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet connection
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
          if (method === 'eth_sendTransaction') {
            return '0x1234567890abcdef';
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    });

    await page.goto('/consents');
    
    // Connect wallet first
    await page.getByText('Connect Wallet').click();
    await page.getByRole('button', { name: /connect metamask/i }).click();
    await page.waitForTimeout(1000);
  });

  test('should open grant consent dialog', async ({ page }) => {
    await page.getByRole('button', { name: /grant consent/i }).click();
    
    await expect(page.getByText('Grant Consent', { exact: false })).toBeVisible();
  });

  test('should display all form fields', async ({ page }) => {
    await page.getByRole('button', { name: /grant consent/i }).click();
    
    await expect(page.getByLabel(/providers/i)).toBeVisible();
    await expect(page.getByLabel(/data types/i)).toBeVisible();
    await expect(page.getByLabel(/purposes/i)).toBeVisible();
    await expect(page.getByLabel(/expiration date/i)).toBeVisible();
  });

  test('should allow selecting multiple providers', async ({ page }) => {
    await page.getByRole('button', { name: /grant consent/i }).click();
    
    const providerSelect = page.getByLabel(/providers/i);
    await providerSelect.click();
    
    // Should show provider options
    await expect(page.getByText(/test hospital/i)).toBeVisible();
  });

  test('should allow selecting multiple data types', async ({ page }) => {
    await page.getByRole('button', { name: /grant consent/i }).click();
    
    const dataTypeSelect = page.getByLabel(/data types/i);
    await dataTypeSelect.click();
    
    // Should show data type options
    await expect(page.getByText(/medical_records/i)).toBeVisible();
  });

  test('should show summary when selections are made', async ({ page }) => {
    await page.getByRole('button', { name: /grant consent/i }).click();
    
    // Make selections
    const providerSelect = page.getByLabel(/providers/i);
    await providerSelect.click();
    await page.getByText(/test hospital/i).click();
    
    // Summary should appear
    await expect(page.getByText(/summary/i)).toBeVisible();
  });

  test('should disable submit button when form is incomplete', async ({ page }) => {
    await page.getByRole('button', { name: /grant consent/i }).click();
    
    const submitButton = page.getByRole('button', { name: /grant.*consent/i });
    await expect(submitButton).toBeDisabled();
  });
});

