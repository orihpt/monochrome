import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const backendEnvPath = path.resolve(appRoot, '../navidrome/.env');
const billieArtistId = '2cUlR50RVMP4dAUFB7ghi6';

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

async function expectLoadedImage(locator) {
  await expect(locator).toBeVisible({ timeout: 20000 });
  await expect
    .poll(
      async () =>
        locator.evaluate((img) => ({
          complete: img.complete,
          width: img.naturalWidth,
          height: img.naturalHeight,
          src: img.currentSrc || img.src,
        })),
      { timeout: 20000 }
    )
    .toMatchObject({ complete: true, width: expect.any(Number), height: expect.any(Number) });

  const imageState = await locator.evaluate((img) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
    src: img.currentSrc || img.src,
  }));
  expect(imageState.width).toBeGreaterThan(0);
  expect(imageState.height).toBeGreaterThan(0);
  expect(imageState.src).not.toMatch(/artist_placeholder|no_album_cover/i);
}

async function openArtistsTab(page) {
  await page.goto('/home');
  await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });
  await page.locator('.home-tab[data-tab="artists"]').click();
  await expect(page.locator('#home-view-artists')).toHaveClass(/active/, { timeout: 15000 });
}

test.describe('artist library presentation', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('populates the Artists tab with local Navidrome artists', async ({ page }) => {
    await loginAsAdmin(page);
    await openArtistsTab(page);

    await expect.poll(() => page.locator('#home-artists-grid [data-artist-id]').count(), { timeout: 30000 }).toBeGreaterThan(0);
    await expect(page.locator(`#home-artists-grid [data-artist-id="${billieArtistId}"]`)).toContainText(/Billie Eilish/i);
  });

  test('shows Billie Eilish artwork and information across artist surfaces', async ({ page }) => {
    await loginAsAdmin(page);

    await openArtistsTab(page);
    const artistsTabBillie = page.locator(`#home-artists-grid [data-artist-id="${billieArtistId}"]`);
    await expect(artistsTabBillie).toBeVisible({ timeout: 30000 });
    await expectLoadedImage(artistsTabBillie.locator('img.card-image'));

    await page.goto('/search/Billie%20Eilish');
    await expect(page.locator('#search-results-title')).toContainText('Billie Eilish', { timeout: 15000 });
    const searchBillie = page.locator(`[data-artist-id="${billieArtistId}"]`).filter({ hasText: /Billie Eilish/i }).first();
    await expect(searchBillie).toBeVisible({ timeout: 20000 });
    await expectLoadedImage(searchBillie.locator('img').first());

    await page.goto(`/artist/${billieArtistId}`);
    await expect(page.locator('#artist-detail-name')).toContainText(/Billie Eilish/i, { timeout: 20000 });
    await expectLoadedImage(page.locator('#artist-detail-image'));

    await expect(page.locator('#artist-detail-meta')).toContainText(/album|song/i, { timeout: 20000 });
    await expect(page.locator('#artist-detail-bio')).not.toContainText(/Could not load|not found/i);
    await expect
      .poll(
        () =>
          page.locator('#artist-detail-banner-container').evaluate((banner) => {
            const style = getComputedStyle(banner);
            return {
              opacity: Number(style.opacity),
              backgroundImage: style.backgroundImage,
              videos: banner.querySelectorAll('video').length,
            };
          }),
        { timeout: 20000 }
      )
      .toEqual(expect.objectContaining({ opacity: 1 }));

    const bannerState = await page.locator('#artist-detail-banner-container').evaluate((banner) => {
      const style = getComputedStyle(banner);
      return { backgroundImage: style.backgroundImage, videos: banner.querySelectorAll('video').length };
    });
    expect(bannerState.backgroundImage !== 'none' || bannerState.videos > 0).toBeTruthy();
  });
});
