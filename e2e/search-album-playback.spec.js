import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const backendEnvPath = path.resolve(appRoot, '../navidrome/.env');
const username = 'admin';
const artistQuery = 'Billie Eilish';

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

const password = process.env.ADMIN_USER_STATIC_PASSWORD || readEnvValue(backendEnvPath, 'ADMIN_USER_STATIC_PASSWORD');

function attachStrictBrowserGuards(page) {
  const failures = [];
  const criticalResourceTypes = new Set(['document', 'script', 'xhr', 'fetch', 'media']);

  page.on('console', (message) => {
    if (message.type() === 'error') {
      failures.push(`console.error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    failures.push(`pageerror: ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    if (criticalResourceTypes.has(request.resourceType())) {
      failures.push(`requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`);
    }
  });
  page.on('response', (response) => {
    const request = response.request();
    const url = response.url();
    if (criticalResourceTypes.has(request.resourceType()) && response.status() >= 400) {
      failures.push(`http ${response.status()}: ${request.method()} ${url}`);
    }
    if (url.includes('/api/v1/recommend/')) {
      failures.push(`unexpected recommendation request: ${request.method()} ${url}`);
    }
  });

  return {
    assertClean() {
      expect(failures, `Unexpected browser/runtime/network failures:\n${failures.join('\n')}`).toEqual([]);
    },
  };
}

async function login(page) {
  expect(password, 'ADMIN_USER_STATIC_PASSWORD must be set in the backend .env').toBeTruthy();

  await page.goto('/');

  await expect(page.locator('#waves-music-auth-modal')).toBeVisible({ timeout: 15000 });
  await page.locator('#waves-music-auth-username').fill(username);
  await page.locator('#waves-music-auth-password').fill(password);

  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/rest/ping.view') && response.status() === 200),
    page.locator('#waves-music-auth-form button[type="submit"]').click(),
  ]);

  await expect(page.locator('#waves-music-auth-modal')).toBeHidden({ timeout: 20000 });
  await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });
}

test('searches an artist, opens the first album result, and starts playback without browser errors', async ({ page }) => {
  test.setTimeout(120000);
  const browserGuards = attachStrictBrowserGuards(page);

  await page.addInitScript(() => {
    if (!localStorage.getItem('__waves_e2e_storage_cleared')) {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('__waves_e2e_storage_cleared', '1');
    }
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
    });
  });

  await login(page);

  await expect(page.locator('#search-input')).toBeVisible({ timeout: 15000 });
  await page.locator('#search-input').fill(artistQuery);
  await page.locator('#search-form').evaluate((form) => form.requestSubmit());
  await expect(page).toHaveURL(/\/search\/Billie%20Eilish$/, { timeout: 15000 });

  await page.locator('#page-search .search-tab[data-tab="albums"]').click();
  const firstAlbum = page.locator('#search-albums-container [data-testid="album-card"][data-album-id]').first();
  await expect(firstAlbum).toBeVisible({ timeout: 30000 });
  const albumId = await firstAlbum.getAttribute('data-album-id');
  expect(albumId).toBeTruthy();
  await firstAlbum.click();

  await expect(page).toHaveURL(new RegExp(`/album/${albumId}$`), { timeout: 15000 });
  await expect(page.locator('#album-detail-tracklist [data-testid="track-row"][data-track-id]').first()).toBeVisible({
    timeout: 30000,
  });

  const firstTrack = page.locator('#album-detail-tracklist [data-testid="track-row"][data-track-id]').first();
  const trackId = await firstTrack.getAttribute('data-track-id');
  expect(trackId).toBeTruthy();
  await firstTrack.locator('.track-item-info').click();

  await expect(page.locator(`.now-playing-bar [data-track-id="${trackId}"], .now-playing-bar .play-pause-btn`)).toBeVisible({
    timeout: 15000,
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const audio = document.querySelector('#audio-player');
          return Boolean(audio?.currentSrc || audio?.src);
        }),
      { timeout: 20000 }
    )
    .toBe(true);

  const paused = await page.evaluate(() => document.querySelector('#audio-player')?.paused ?? true);
  if (paused) {
    await page.locator('.now-playing-bar .play-pause-btn').click();
  }

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const audio = document.querySelector('#audio-player');
          return audio ? !audio.paused && audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA : false;
        }),
      { timeout: 20000 }
    )
    .toBe(true);

  const start = await page.evaluate(() => document.querySelector('#audio-player')?.currentTime || 0);
  await expect
    .poll(
      () =>
        page.evaluate((initialTime) => {
          const audio = document.querySelector('#audio-player');
          return audio ? audio.currentTime - initialTime : 0;
        }, start),
      { timeout: 15000 }
    )
    .toBeGreaterThan(0.25);

  await expect(page.locator('.error-panel')).not.toBeVisible();
  browserGuards.assertClean();
});
