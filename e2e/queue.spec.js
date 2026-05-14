import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const backendEnvPath = path.resolve(appRoot, '../navidrome/.env');

// Deterministic album ID used in other tests
const hitMeHardAndSoftAlbumId = '4ZmbVLUy4kYrqwxgIGsYtk';

function readEnvValue(filePath, key) {
  if (!fs.existsSync(filePath)) return undefined;

  const line = fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));

  if (!line) return undefined;

  const rawValue = line.slice(line.indexOf('=') + 1).trim();
  return rawValue.replace(/^['"]|['"]$/g, '');
}

const adminPassword = process.env.ADMIN_USER_STATIC_PASSWORD || readEnvValue(backendEnvPath, 'ADMIN_USER_STATIC_PASSWORD');

async function loginAsAdmin(page) {
  expect(adminPassword, 'ADMIN_USER_STATIC_PASSWORD must be set in the backend .env').toBeTruthy();

  await page.goto('/');
  await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });
  await expect(page.locator('#waves-music-auth-modal')).toBeVisible();

  await page.locator('#waves-music-auth-username').fill('admin');
  await page.locator('#waves-music-auth-password').fill(adminPassword);

  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/rest/ping.view') && response.status() === 200),
    page.locator('#waves-music-auth-form button').click(),
  ]);

  await expect(page.locator('#waves-music-auth-modal')).toBeHidden({ timeout: 15000 });
}

async function openAlbum(page, albumId) {
  await page.goto(`/album/${albumId}`);
  await expect(page.locator('#album-detail-title')).toBeVisible({ timeout: 20000 });
  // Wait for tracks to load
  await expect.poll(() => page.locator('#album-detail-tracklist .track-item').count()).toBeGreaterThan(0);
}

test.describe('Album Queue Flow', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should add an entire album to the playback queue', async ({ page }) => {
    await loginAsAdmin(page);
    await openAlbum(page, hitMeHardAndSoftAlbumId);

    // Get the number of tracks in the album to verify later
    const albumTrackCount = await page.locator('#album-detail-tracklist .track-item').count();
    expect(albumTrackCount).toBeGreaterThan(0);

    // Open album ellipsis menu
    const albumMenuBtn = page.locator('#album-menu-btn');
    await albumMenuBtn.scrollIntoViewIfNeeded();
    await albumMenuBtn.click();
    
    // Wait for the "Add to queue" item in the context menu
    const addToQueueItem = page.locator('#context-menu li[data-action="add-to-queue"]');
    await expect(addToQueueItem).toBeVisible({ timeout: 15000 });

    // Click "Add to queue"
    await addToQueueItem.click();
    await expect(addToQueueItem).not.toBeVisible();

    // Open the queue side panel
    await page.locator('#queue-btn').click();
    await expect(page.locator('#side-panel')).toBeVisible();
    await expect(page.locator('#side-panel-title')).toContainText(/תור|Queue/i);

    // Verify the tracks were added
    const queueTracks = page.locator('#side-panel-content .queue-track-item');
    await expect(queueTracks).toHaveCount(albumTrackCount, { timeout: 15000 });

    // Verify first track name matches (anywhere in the queue to be robust)
    const firstAlbumTrackTitle = (await page.locator('#album-detail-tracklist .track-item .title').first().textContent()).trim();
    await expect(queueTracks.filter({ hasText: firstAlbumTrackTitle }).first()).toBeVisible({ timeout: 15000 });
  });

  test('should add a specific track to the playback queue', async ({ page }) => {
    await loginAsAdmin(page);
    await openAlbum(page, hitMeHardAndSoftAlbumId);

    const trackTitle = 'CHIHIRO';
    const trackItem = page.locator('#album-detail-tracklist .track-item').filter({ hasText: trackTitle }).first();
    await expect(trackItem).toBeVisible();

    // Open track ellipsis menu
    const trackMenuBtn = trackItem.locator('.track-menu-btn');
    await trackMenuBtn.scrollIntoViewIfNeeded();
    await trackMenuBtn.click();
    
    // Wait for the "Add to queue" item in the context menu
    const addToQueueItem = page.locator('#context-menu li[data-action="add-to-queue"]');
    await expect(addToQueueItem).toBeVisible({ timeout: 15000 });

    // Click "Add to queue"
    await addToQueueItem.click();
    await expect(addToQueueItem).not.toBeVisible();

    // Open the queue side panel
    await page.locator('#queue-btn').click();
    await expect(page.locator('#side-panel')).toBeVisible();

    // Verify the track is in the queue
    const queueTracks = page.locator('#side-panel-content .queue-track-item');
    await expect(queueTracks.filter({ hasText: trackTitle })).toBeVisible({ timeout: 15000 });
  });
});
