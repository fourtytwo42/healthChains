/**
 * E2E Tests - Navigation
 * 
 * Tests page navigation and routing
 */

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate to dashboard', async ({ page }) => {
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should navigate to patients page', async ({ page }) => {
    await page.getByRole('link', { name: /patients/i }).click();
    await expect(page).toHaveURL(/.*patients/);
    await expect(page.getByText(/patients/i)).toBeVisible();
  });

  test('should navigate to consents page', async ({ page }) => {
    await page.getByRole('link', { name: /consents/i }).click();
    await expect(page).toHaveURL(/.*consents/);
    await expect(page.getByText(/consent/i)).toBeVisible();
  });

  test('should navigate to requests page', async ({ page }) => {
    await page.getByRole('link', { name: /requests/i }).click();
    await expect(page).toHaveURL(/.*requests/);
    await expect(page.getByText(/access requests/i)).toBeVisible();
  });

  test('should navigate to events page', async ({ page }) => {
    await page.getByRole('link', { name: /events/i }).click();
    await expect(page).toHaveURL(/.*events/);
    await expect(page.getByText(/events/i)).toBeVisible();
  });

  test('should maintain header and sidebar on all pages', async ({ page }) => {
    const pages = ['/', '/patients', '/consents', '/requests', '/events'];
    
    for (const path of pages) {
      await page.goto(path);
      
      // Check for header
      await expect(page.getByText(/healthchains/i)).toBeVisible();
      
      // Check for sidebar navigation
      await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /patients/i })).toBeVisible();
    }
  });
});

