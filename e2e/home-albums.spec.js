import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const backendEnvPath = path.resolve(appRoot, '../navidrome/.env');

function readEnvValue(filePath, key) {
  if (!fs.existsSync(filePath)) return undefined;

  const line = fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));

  if (!line) return undefined;
  return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
}

const adminPassword = process.env.ADMIN_USER_STATIC_PASSWORD || readEnvValue(backendEnvPath, 'ADMIN_USER_STATIC_PASSWORD');

async function loginAsAdmin(page) {
  expect(adminPassword, 'ADMIN_USER_STATIC_PASSWORD must be set in the backend .env').toBeTruthy();

  await page.goto('/');
  await expect(page.locator('#waves-music-auth-modal')).toBeVisible();
  await page.locator('#waves-music-auth-username').fill('admin');
  await page.locator('#waves-music-auth-password').fill(adminPassword);

  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/rest/ping.view') && response.status() === 200),
    page.locator('#waves-music-auth-form button').click(),
  ]);

  await expect(page.locator('#waves-music-auth-modal')).toBeHidden({ timeout: 15000 });
}

async function openAlbumsTab(page) {
  await page.goto('/home');
  await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });
  await page.locator('.home-tab[data-tab="albums"]').click();
  await expect(page.locator('#home-view-albums')).toHaveClass(/active/, { timeout: 15000 });
}

test.describe('home page albums tab', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.afterEach(async ({ page }) => {
    await expect(page.locator('.error-panel')).not.toBeVisible();
  });

  test('populates the Albums tab with local Navidrome albums', async ({ page }) => {
    await loginAsAdmin(page);
    await openAlbumsTab(page);

    // Wait for the grid to have at least one album card
    await expect.poll(() => page.locator('#home-albums-grid .card').count(), { timeout: 30000 }).toBeGreaterThan(0);
    
    // Check if the first album has a title and artist
    const firstAlbum = page.locator('#home-albums-grid .card').first();
    await expect(firstAlbum.locator('.card-title')).not.toBeEmpty();
    await expect(firstAlbum.locator('.card-subtitle')).not.toBeEmpty();
  });

  test('switches between Artists and Albums tabs correctly', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/home');
    await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });

    // Switch to Artists
    await page.locator('.home-tab[data-tab="artists"]').click();
    await expect(page.locator('#home-view-artists')).toHaveClass(/active/);
    await expect(page.locator('#home-view-albums')).not.toHaveClass(/active/);

    // Switch to Albums
    await page.locator('.home-tab[data-tab="albums"]').click();
    await expect(page.locator('#home-view-albums')).toHaveClass(/active/);
    await expect(page.locator('#home-view-artists')).not.toHaveClass(/active/);

    // Switch back to Home (For You)
    await page.locator('.home-tab[data-tab="for-you"]').click();
    await expect(page.locator('#home-view-for-you')).toHaveClass(/active/);
    await expect(page.locator('#home-view-albums')).not.toHaveClass(/active/);
  });
});
