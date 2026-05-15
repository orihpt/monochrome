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
  await page.goto('/');
  await expect(page.locator('#waves-music-auth-modal')).toBeVisible({ timeout: 15000 });
  await page.locator('#waves-music-auth-username').fill('admin');
  await page.locator('#waves-music-auth-password').fill(adminPassword);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/rest/ping.view') && response.status() === 200),
    page.locator('#waves-music-auth-form button').click(),
  ]);
  await expect(page.locator('#waves-music-auth-modal')).toBeHidden({ timeout: 20000 });
}

test.describe('Home Page Sections Visibility', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('empty content sections should be hidden', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/');

    // Wait for the home page to be active
    await expect(page.locator('.home-view.active')).toBeVisible({ timeout: 20000 });

    // Give async content sections time to load or hide themselves
    // We wait for the app to finish initializing
    await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });

    // Additional wait for dynamic home sections to render/hide
    await page.waitForTimeout(4000);

    const sections = page.locator('.content-section');
    const count = await sections.count();

    expect(count, 'Expected at least one .content-section in the page').toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const section = sections.nth(i);
      const isVisible = await section.isVisible();

      if (!isVisible) {
        // Section is already hidden — this is CORRECT behavior for empty sections
        continue;
      }

      const id = await section.getAttribute('id') || `index-${i}`;

      // Count items that qualify as "real" content
      const realContentCount = await section.evaluate((el) => {
        const selectors = [
          '.track-item',
          '.grid-card',
          '.user-playlist',
          '.artist-card',
          '.album-card',
          '.playlist-card',
          '.artist-request-row',
          '.card',          // base card for playlists/albums in grid
          '[data-track-id]', // any track row
        ];
        let count = 0;
        for (const sel of selectors) {
          count += el.querySelectorAll(sel).length;
        }
        return count;
      });

      const hasRichPlaceholder = await section.locator('.rich-placeholder').count() > 0;
      const hasSkeletonOnly = await section.evaluate((el) => {
        const skeletons = el.querySelectorAll('.skeleton-track, .skeleton-card');
        const cards = el.querySelectorAll('.track-item, .card, [data-track-id]');
        return skeletons.length > 0 && cards.length === 0;
      });

      // A visible section MUST contain real content items
      // Loading skeletons alone don't count as real content
      if (!hasRichPlaceholder && !hasSkeletonOnly) {
        // This is the assertion: visible section must have real content
        expect(
          realContentCount,
          `Section "${id}" is visible but has no real content items (${realContentCount} found). ` +
          `It should either be hidden or contain actual content.`
        ).toBeGreaterThan(0);
      } else if (hasSkeletonOnly) {
        // Still loading - wait a little more
        await page.waitForTimeout(2000);
        const afterWaitCount = await section.evaluate((el) => {
          return el.querySelectorAll('.track-item, .card, [data-track-id]').length;
        });
        const isStillVisible = await section.isVisible();
        if (isStillVisible) {
          expect(
            afterWaitCount,
            `Section "${id}" showed only skeletons and is still visible after additional wait. ` +
            `Either it should be hidden when empty or contain real content.`
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});
