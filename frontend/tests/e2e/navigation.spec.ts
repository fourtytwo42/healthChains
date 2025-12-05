/**
 * E2E Tests - Navigation
 * 
 * Tests page navigation and routing with role-based navigation
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet connection for role detection
    // Using registered patient address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (PAT-000001)
    await page.addInitScript(() => {
      (window as any).ethereum = {
        isMetaMask: true,
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_requestAccounts') {
            return ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266']; // Patient account (registered)
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
    // Wait for page to load, role detection, and redirect
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Give time for role API call and redirect
  });

  const sidebarNav = (page: Page) => page.getByRole('navigation', { name: /sidebar/i });

  test('should redirect to role-based dashboard', async ({ page }) => {
    // Connect wallet first (required for role detection)
    const connectButton = page.getByText('Connect Wallet');
    await expect(connectButton).toBeVisible({ timeout: 5000 });
    await connectButton.click();
    
    // Wait for dialog and click connect
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    const metamaskButton = page.getByRole('button', { name: /connect metamask/i });
    await expect(metamaskButton).toBeVisible({ timeout: 5000 });
    await metamaskButton.click();
    
    // Wait for wallet connection (check for connected address in header)
    await page.waitForSelector('text=/0xf39f/i', { timeout: 10000 });
    
    // Wait for role detection API call and redirect
    // The root page should redirect to /patient for registered patient address
    await page.waitForURL(/\/(patient|provider)$/, { timeout: 15000 });
    const url = page.url();
    expect(url).toMatch(/\/(patient|provider)$/);
  });

  test('should show role-based navigation for patient', async ({ page }) => {
    await page.goto('/patient');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // Check for any heading (might be "Patient Dashboard" or similar)
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    // Check for sidebar navigation
    const nav = sidebarNav(page);
    await expect(nav).toBeVisible({ timeout: 5000 });
  });

  test('should show role-based navigation for provider', async ({ page }) => {
    // Mock provider account
    await page.addInitScript(() => {
      (window as any).ethereum = {
        isMetaMask: true,
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_requestAccounts') {
            return ['0xbcd4042DE499D14e55001CcbB24a551F3b954096']; // Provider account
          }
          if (method === 'eth_chainId') {
            return '0x539';
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
    });
    await page.reload();
    await page.goto('/provider');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // Check for any heading
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    // Check for sidebar navigation
    const nav = sidebarNav(page);
    await expect(nav).toBeVisible({ timeout: 5000 });
  });

  test('should maintain header and sidebar on all pages', async ({ page }) => {
    const pages = ['/patient', '/provider'];
    
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      await expect(page.getByRole('banner')).toBeVisible({ timeout: 10000 });
      await expect(sidebarNav(page)).toBeVisible({ timeout: 5000 });
    }
  });
});

