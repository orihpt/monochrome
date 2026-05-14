import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const backendEnvPath = path.resolve(appRoot, '../navidrome/.env');
const hitMeHardAndSoftAlbumId = '4ZmbVLUy4kYrqwxgIGsYtk';
const linkinParkAlbumId = '0cO3n7CUb9lQ6scVrEvVTO';

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

async function expectNoRuntimeErrors(page, action) {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });

  await action();

  expect(runtimeErrors, `Unexpected browser errors:\n${runtimeErrors.join('\n')}`).toEqual([]);
}

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
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('subsonic_user')))
    .toBe('admin');
}

async function search(page, query) {
  await page.goto(`/search/${encodeURIComponent(query)}`);
  await expect(page).toHaveURL(new RegExp(`/search/${encodeURIComponent(query)}`), { timeout: 15000 });
  await expect(page.locator('#search-results-title')).toContainText(query, { timeout: 15000 });
}

async function openHitMeHardAndSoft(page) {
  await page.goto(`/album/${hitMeHardAndSoftAlbumId}`);
  await expect(page.locator('#album-detail-title')).toContainText(/HIT ME HARD AND SOFT/i, { timeout: 20000 });
  await expect.poll(() => page.locator('#album-detail-tracklist .track-item').count()).toBeGreaterThan(0);
}

function trackIn(page, container, title) {
  return page
    .locator(`${container} .track-item`)
    .filter({ has: page.locator('.track-item-details .title', { hasText: new RegExp(`^\\s*${title}\\b`, 'i') }) })
    .first();
}

function albumTrack(page, title) {
  return trackIn(page, '#album-detail-tracklist', title);
}

function playlistTrack(page, title) {
  return trackIn(page, '#playlist-detail-tracklist', title);
}

async function playAlbumTrack(page, title) {
  const track = albumTrack(page, title);
  await expect(track).toBeVisible({ timeout: 15000 });
  await track.locator('.track-item-info').click();
  await expect(page.locator('.now-playing-bar .title')).toContainText(new RegExp(title, 'i'), { timeout: 15000 });
  await expect(page.locator('.now-playing-bar .play-pause-btn')).toBeVisible();
  return track;
}

test.describe('Waves Music frontend E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test.afterEach(async ({ page }) => {
    await expect(page.locator('.error-panel')).not.toBeVisible();
  });

  test('should show login modal when entering the website without credentials', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#waves-music-auth-modal')).toBeVisible();
    await expect(page.locator('#waves-music-auth-username')).toBeVisible();
    await expect(page.locator('#waves-music-auth-password')).toBeVisible();
  });

  test('should accept the admin credentials from the backend env', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.locator('#waves-music-auth-modal')).toBeHidden();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('subsonic_user'))).toBe('admin');
  });

  test('should expose scanner controls to the admin user', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/settings');

    await expect(page.locator('#settings-admin-tab')).toBeVisible({ timeout: 15000 });
    await page.locator('#settings-admin-tab').click();
    await expect(page.locator('#settings-tab-admin')).toHaveClass(/active/);
    await expect(page.locator('#trigger-scan-btn')).toBeVisible();
  });

  test('should trigger a library scan through the frontend scanner control', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/settings');
    await page.locator('#settings-admin-tab').click();

    const [scanResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/rest/startScan.view') && response.status() === 200),
      page.locator('#trigger-scan-btn').click(),
    ]);
    const body = await scanResponse.json();

    expect(body['subsonic-response']?.status).toBe('ok');
    expect(body['subsonic-response']?.scanStatus).toBeTruthy();
    await expect(page.locator('#admin-actions-status')).toContainText(/Library rescan started/i, { timeout: 15000 });
  });

  test("should show CHIHIRO and LUNCH in the HIT ME HARD AND SOFT songs list", async ({ page }) => {
    await loginAsAdmin(page);
    await openHitMeHardAndSoft(page);

    await expect(albumTrack(page, 'CHIHIRO')).toBeVisible();
    await expect(albumTrack(page, 'LUNCH')).toBeVisible();
  });

  test('should play a song', async ({ page }) => {
    await loginAsAdmin(page);
    await openHitMeHardAndSoft(page);

    await playAlbumTrack(page, 'CHIHIRO');
  });

  test('should open the lyrics page for CHIHIRO without errors', async ({ page }) => {
    await loginAsAdmin(page);
    await openHitMeHardAndSoft(page);
    await playAlbumTrack(page, 'CHIHIRO');

    await expectNoRuntimeErrors(page, async () => {
      await expect(page.locator('#now-playing-lyrics-page-btn')).toBeVisible({ timeout: 15000 });
      await page.locator('#now-playing-lyrics-page-btn').click();
      await expect(page).toHaveURL(/\/lyrics$/, { timeout: 15000 });
      await expect(page.locator('#lyrics-page-track-info')).toContainText(/CHIHIRO/i, { timeout: 15000 });
    });

    await expect(page.locator('#lyrics-page-content')).not.toContainText(/Failed to load lyrics/i);
  });

  test('should add a song to a playlist from the plus button next to the song', async ({ page }) => {
    await loginAsAdmin(page);
    await openHitMeHardAndSoft(page);

    const playlistName = `E2E Playlist ${Date.now()}`;
    const chihiro = albumTrack(page, 'CHIHIRO');
    const plusButton = chihiro.locator('.track-library-btn');

    await plusButton.click();
    await expect(plusButton).toHaveClass(/in-library/, { timeout: 15000 });

    await plusButton.click();
    await expect(page.locator('.track-library-menu')).toBeVisible();
    await page.locator('.track-library-menu-add').click();

    await expect(page.locator('#playlist-modal')).toHaveClass(/active/);
    await page.locator('#playlist-name-input').fill(playlistName);
    await page.locator('#playlist-modal-save').click();
    await expect(page.locator('#playlist-modal')).not.toHaveClass(/active/, { timeout: 15000 });

    await page.goto('/library');
    const playlistCard = page.locator('[data-user-playlist-id]').filter({ hasText: playlistName }).first();
    await expect(playlistCard).toBeVisible({ timeout: 15000 });
    await playlistCard.click();
    await expect(page).toHaveURL(/\/userplaylist\//, { timeout: 15000 });
    await expect(playlistTrack(page, 'CHIHIRO')).toBeVisible({ timeout: 15000 });
  });

  test('should find Billie Eilish and HIT ME HARD AND SOFT from search', async ({ page }) => {
    await loginAsAdmin(page);
    await search(page, 'Billie Eilish');

    await expect(page.locator('[data-artist-id]').filter({ hasText: /Billie Eilish/i }).first()).toBeVisible({
      timeout: 20000,
    });
    await expect(page.locator('[data-album-id]').filter({ hasText: /HIT ME HARD AND SOFT/i }).first()).toBeVisible();
  });

  test('should display all songs for an album and match the track count in meta', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/album/${linkinParkAlbumId}`);

    // Wait for the album title to confirm we are on the right page
    await expect(page.locator('#album-detail-title')).toContainText(/Heavy Is the Crown/i, { timeout: 20000 });

    // Get the track count from the meta text (e.g. "2 tracks • 5:57")
    const metaText = await page.locator('#album-detail-meta').textContent();
    const trackCountMatch = metaText.match(/(\d+)\s+tracks/);
    expect(trackCountMatch, `Could not find track count in meta text: "${metaText}"`).not.toBeNull();
    const expectedTrackCount = parseInt(trackCountMatch[1], 10);
    expect(expectedTrackCount).toBeGreaterThan(0);

    // Verify that the number of tracks in the list matches the expected count
    await expect.poll(async () => {
      return await page.locator('#album-detail-tracklist .track-item').count();
    }, {
      timeout: 15000,
      message: `Expected ${expectedTrackCount} tracks in the list`
    }).toBe(expectedTrackCount);
  });
});
