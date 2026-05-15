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
  // Handle already logged in state
  if (await page.locator('#waves-music-auth-modal').isHidden()) {
      return;
  }

  await expect(page.locator('#waves-music-auth-modal')).toBeVisible({ timeout: 15000 });

  await page.locator('#waves-music-auth-username').fill('admin');
  await page.locator('#waves-music-auth-password').fill(adminPassword);

  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('/rest/ping.view') && response.status() === 200
    ),
    page.locator('#waves-music-auth-form button').click(),
  ]);

  await expect(page.locator('#waves-music-auth-modal')).toBeHidden({ timeout: 20000 });
}

test.describe('Library Sync – Add/Remove Other Users Playlists', () => {
  test.setTimeout(120000);

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('adds a public playlist to library and shows it in sidebar', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });

    const playlistId = `followed-${Date.now()}`;
    const playlistName = `Public Playlist ${Date.now()}`;

    await page.evaluate(
      async ({ id, name }) => {
        const { db } = await import('/js/db.js');
        await db.addPlaylistToLibrary({
          id,
          name,
          title: name,
          tracks: [],
          ownerUsername: 'other-user',
          visibility: 'public',
          isFollowed: true,
          syncStatus: 'synced',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      },
      { id: playlistId, name: playlistName }
    );

    const sidebarItem = page.locator(`.sidebar-library-item[data-id="${playlistId}"]`);
    await expect(sidebarItem).toBeVisible({ timeout: 20000 });
    await expect(sidebarItem.locator('.sidebar-library-item-name')).toHaveText(playlistName);
  });

  test('context menu "add-to-library" adds community playlist to sidebar', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });

    await page.locator('.home-tab[data-tab="community"]').click();
    
    // Increased wait for community content to load
    const featuredSection = page.locator('#community-featured-playlists');
    await expect(featuredSection).toBeVisible({ timeout: 15000 });
    
    const card = featuredSection.locator('.card[data-playlist-id]').first();
    await expect(card).toBeVisible({ timeout: 20000 });

    const cardId = await card.getAttribute('data-playlist-id');

    await card.click({ button: 'right' });

    const contextMenu = page.locator('#context-menu');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const addToLibraryOption = contextMenu.locator('[data-action="add-to-library"]');
    if (await addToLibraryOption.isVisible()) {
        await addToLibraryOption.click();
        await expect(contextMenu).toBeHidden({ timeout: 10000 });

        const sidebarItem = page.locator(`.sidebar-library-item[data-id="${cardId}"]`);
        await expect(sidebarItem).toBeVisible({ timeout: 20000 });
    } else {
        const sidebarItem = page.locator(`.sidebar-library-item[data-id="${cardId}"]`);
        await expect(sidebarItem).toBeVisible({ timeout: 10000 });
    }
  });

  test('removes a followed playlist from library and removes it from sidebar', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });

    const playlistId = `followed-remove-${Date.now()}`;
    const playlistName = `To Remove ${Date.now()}`;

    await page.evaluate(
      async ({ id, name }) => {
        const { db } = await import('/js/db.js');
        await db.addPlaylistToLibrary({
          id,
          name,
          title: name,
          tracks: [],
          ownerUsername: 'other-user',
          visibility: 'public',
          isFollowed: true,
          syncStatus: 'synced',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      },
      { id: playlistId, name: playlistName }
    );

    const sidebarItem = page.locator(`.sidebar-library-item[data-id="${playlistId}"]`);
    await expect(sidebarItem).toBeVisible({ timeout: 10000 });

    await page.evaluate(async (id) => {
      const { db } = await import('/js/db.js');
      await db.removePlaylistFromLibrary(id);
    }, playlistId);

    await expect(sidebarItem).toBeHidden({ timeout: 15000 });
  });

  test('cleanup removes followed playlist that became private', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });

    const playlistId = `followed-private-${Date.now()}`;
    
    await page.evaluate(
      async ({ id }) => {
        const { db } = await import('/js/db.js');
        await db.addPlaylistToLibrary({
          id,
          name: 'Private Soon',
          title: 'Private Soon',
          tracks: [],
          ownerUsername: 'other-user',
          visibility: 'public',
          isFollowed: true,
          syncStatus: 'synced',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      },
      { id: playlistId }
    );

    const sidebarItem = page.locator(`.sidebar-library-item[data-id="${playlistId}"]`);
    await expect(sidebarItem).toBeVisible({ timeout: 10000 });

    // Intercept any request to get this playlist and return 404
    await page.route(new RegExp(`/api/playlist/${playlistId}`), async (route) => {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not Found' }) });
    });

    await page.evaluate(async () => {
      localStorage.removeItem('followed_playlists_cleanup_at');
      const { syncManager } = await import('/js/navidrome-sync.js');
      await syncManager.cleanupFollowedPlaylists();
    });

    // Wait for the item to be removed from the sidebar
    await expect(sidebarItem).toBeHidden({ timeout: 30000 });
  });
});
