/**
 * E2E Tests - Navigation
 * 
 * Tests page navigation and routing
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  const sidebarNav = (page: Page) => page.locator('nav').first();

  test('should navigate to dashboard', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('should navigate to patients page', async ({ page }) => {
    await sidebarNav(page).getByRole('link', { name: 'Patients', exact: true }).click();
    await expect(page).toHaveURL(/\/patients$/);
    await expect(page.getByRole('heading', { name: /patients/i })).toBeVisible();
  });

  test('should navigate to consents page', async ({ page }) => {
    await sidebarNav(page).getByRole('link', { name: 'Consents', exact: true }).click();
    await expect(page).toHaveURL(/\/consents$/);
    await expect(page.getByRole('heading', { name: /consents/i })).toBeVisible();
  });

  test('should navigate to requests page', async ({ page }) => {
    await sidebarNav(page).getByRole('link', { name: 'Requests', exact: true }).click();
    await expect(page).toHaveURL(/\/requests$/);
    await expect(page.getByRole('heading', { name: /access requests/i })).toBeVisible();
  });

  test('should navigate to events page', async ({ page }) => {
    await sidebarNav(page).getByRole('link', { name: 'Events', exact: true }).click();
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByRole('heading', { name: /events/i })).toBeVisible();
  });

  test('should maintain header and sidebar on all pages', async ({ page }) => {
    const pages = ['/', '/patients', '/consents', '/requests', '/events'];
    
    for (const path of pages) {
      await page.goto(path);
      
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(sidebarNav(page).getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
      await expect(sidebarNav(page).getByRole('link', { name: 'Patients', exact: true })).toBeVisible();
    }
  });
});

