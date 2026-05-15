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

  const rawValue = line.slice(line.indexOf('=') + 1).trim();
  return rawValue.replace(/^['"]|['"]$/g, '');
}

const adminPassword = process.env.ADMIN_USER_STATIC_PASSWORD || readEnvValue(backendEnvPath, 'ADMIN_USER_STATIC_PASSWORD');

async function loginAsAdmin(page) {
  expect(adminPassword, 'ADMIN_USER_STATIC_PASSWORD must be set in the backend .env').toBeTruthy();

  await page.goto('/');
  await expect(page.locator('#waves-music-auth-modal')).toBeVisible({ timeout: 15000 });

  await page.locator('#waves-music-auth-username').fill('admin');
  await page.locator('#waves-music-auth-password').fill(adminPassword);

  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/rest/ping.view') && response.status() === 200),
    page.locator('#waves-music-auth-form button').click(),
  ]);

  await expect(page.locator('#waves-music-auth-modal')).toBeHidden({ timeout: 20000 });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('subsonic_user')))
    .toBe('admin');
}

test.describe('Playlist Immediate Add', () => {
  test.setTimeout(90000); // generous timeout for full real-backend flow

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('should show added song immediately in the playlist page when added from now playing bar', async ({ page }) => {
    await loginAsAdmin(page);

    // 1. Create a new playlist via sidebar button
    const playlistName = `Immediate Add ${Date.now()}`;
    await page.locator('#sidebar-create-btn').click();

    // Wait for the create playlist modal to be fully visible
    const createModal = page.locator('#playlist-modal');
    await expect(createModal).toHaveClass(/active/, { timeout: 5000 });

    // The input may be in a cover-picker that renders async — wait explicitly
    const nameInput = page.locator('#playlist-name-input');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(playlistName);
    await page.locator('#playlist-modal-save').click();
    await expect(createModal).not.toHaveClass(/active/, { timeout: 10000 });

    // 2. Navigate to the new playlist page via sidebar
    const playlistItem = page.locator('.sidebar-library-item').filter({ hasText: playlistName }).first();
    await expect(playlistItem).toBeVisible({ timeout: 10000 });
    await playlistItem.click();

    // Wait for playlist page to load
    await expect(page).toHaveURL(/\/userplaylist\//, { timeout: 10000 });
    await expect(page.locator('#playlist-detail-title')).toHaveText(playlistName, { timeout: 10000 });

    // Confirm the playlist is empty initially
    const tracklist = page.locator('#playlist-detail-tracklist');
    // Wait for tracklist to render (after potential skeleton phase)
    await page.waitForTimeout(1000);
    await expect(tracklist.locator('.track-item')).toHaveCount(0, { timeout: 5000 });

    // 3. Search for a song to play
    await page.goto('/search/CHIHIRO');
    await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });
    const trackRow = page.locator('.track-item').filter({ hasText: 'CHIHIRO' }).first();
    await expect(trackRow).toBeVisible({ timeout: 15000 });

    // Click the track to start playing it
    await trackRow.locator('.track-item-info').click();
    await expect(page.locator('.now-playing-bar .title')).toContainText('CHIHIRO', { timeout: 20000 });

    // 4. Navigate back to the playlist page
    await page.locator('.sidebar-library-item').filter({ hasText: playlistName }).first().click();
    await expect(page).toHaveURL(/\/userplaylist\//, { timeout: 10000 });
    await expect(page.locator('#playlist-detail-title')).toHaveText(playlistName, { timeout: 10000 });

    // 5. Add current track to playlist using now-playing-add-playlist-btn
    const addBtn = page.locator('#now-playing-add-playlist-btn');
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // The track library menu should appear
    const menu = page.locator('.track-library-menu');
    await expect(menu).toBeVisible({ timeout: 5000 });

    // Find our playlist in the menu list and click it
    const playlistOption = menu.locator('.track-library-menu-item').filter({ hasText: playlistName }).first();
    await expect(playlistOption).toBeVisible({ timeout: 5000 });
    await playlistOption.click();

    // Now the save button should appear (track was toggled into a playlist)
    const saveBtn = menu.locator('.track-library-menu-save');
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await saveBtn.click();

    // Menu should close after save
    await expect(menu).not.toBeVisible({ timeout: 5000 });

    // 6. Verify the song appears IMMEDIATELY in the tracklist (event-driven, no reload needed)
    const addedTrack = page.locator('#playlist-detail-tracklist .track-item').filter({ hasText: 'CHIHIRO' });
    await expect(addedTrack).toBeVisible({ timeout: 10000 });

    // Sanity: there should be exactly 1 track
    await expect(page.locator('#playlist-detail-tracklist .track-item')).toHaveCount(1);
  });
});
