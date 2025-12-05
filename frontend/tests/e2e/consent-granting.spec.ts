/**
 * E2E Tests - Consent Granting
 * 
 * Tests the complete consent granting workflow
 */

import { test, expect, Page } from '@playwright/test';

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

  const openGrantDialog = async (page: Page) => {
    await page.getByRole('button', { name: /^grant consent$/i }).first().click();
  };

  test('should open grant consent dialog', async ({ page }) => {
    await openGrantDialog(page);
    await expect(page.getByRole('heading', { name: /grant consent/i })).toBeVisible();
  });

  test('should display all form fields', async ({ page }) => {
    await openGrantDialog(page);

    await expect(page.getByRole('combobox').filter({ hasText: /select providers/i }).first()).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: /select data types/i }).first()).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: /select purposes/i }).first()).toBeVisible();
    await expect(page.getByText(/expiration date \(optional\)/i)).toBeVisible();
  });

  test('should allow selecting multiple providers', async ({ page }) => {
    await openGrantDialog(page);

    const providerSelect = page.getByRole('combobox').filter({ hasText: /select providers/i }).first();
    await providerSelect.click();
    
    const providerOption = page.getByRole('option').first();
    await expect(providerOption).toBeVisible();
  });

  test('should allow selecting multiple data types', async ({ page }) => {
    await openGrantDialog(page);

    const dataTypeSelect = page.getByRole('combobox').filter({ hasText: /select data types/i }).first();
    await dataTypeSelect.click();
    
    const dataTypeOption = page.getByRole('option').first();
    await expect(dataTypeOption).toBeVisible();
  });

  test('should show summary when selections are made', async ({ page }) => {
    await openGrantDialog(page);

    const providerSelect = page.getByRole('combobox').filter({ hasText: /select providers/i }).first();
    await providerSelect.click();
    await page.getByRole('option').first().click();
    await page.keyboard.press('Escape');

    const dataTypeSelect = page.getByRole('combobox').filter({ hasText: /select data types/i }).first();
    await dataTypeSelect.click();
    await page.getByRole('option').first().click();
    await page.keyboard.press('Escape');

    const purposeSelect = page.getByRole('combobox').filter({ hasText: /select purposes/i }).first();
    await purposeSelect.click();
    await page.getByRole('option').first().click();
    await page.keyboard.press('Escape');

    await expect(page.getByText(/summary/i)).toBeVisible();
  });

  test('should disable submit button when form is incomplete', async ({ page }) => {
    await openGrantDialog(page);

    const submitButton = page.getByRole('button', { name: /grant consent/i }).last();
    await expect(submitButton).toBeDisabled();
  });
});

