import { test, expect } from '@playwright/test';

const json = (body) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

async function installMocks(page, overrides = {}) {
  // Console logging for debugging
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`PAGE CONSOLE [${msg.type().toUpperCase()}]: ${msg.text()}`);
    }
  });

  await page.addInitScript(() => {
    localStorage.setItem('subsonic_user', 'admin');
    localStorage.setItem('subsonic_pass', 'password');
    localStorage.setItem('navidrome_native_token', 'test-token');
  });

  await page.route('**/rest/**', (route) => {
    const url = route.request().url();
    if (url.includes('getPlaylists')) {
      return route.fulfill(json({
        'subsonic-response': { status: 'ok', playlists: { playlist: [] } },
      }));
    }
    if (url.includes('ping')) {
      return route.fulfill(json({ 'subsonic-response': { status: 'ok' } }));
    }
    return route.fulfill(json({ 'subsonic-response': { status: 'ok' } }));
  });

  await page.route('**/api/community/activity**', (route) =>
    route.fulfill(json({ recentlyPlayed: [], mostPlayed: [], followingRecent: [] }))
  );
  await page.route('**/api/features**', (route) =>
    route.fulfill(json({ features: { recommendations: false } }))
  );
  await page.route('**/api/community/featured**', (route) => {
    console.log('MOCKING FEATURED PLAYLISTS');
    return route.fulfill(json(overrides.featuredPlaylists || []));
  });

  await page.goto('/home');
  await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });
}

async function seedSidebarPlaylist(page, playlist) {
  await page.evaluate(async (pl) => {
    const { db } = await import('/js/db.js');
    await db.addPlaylistToLibrary(pl);
  }, playlist);
}

test.describe('Playlist Cover Rendering Consistency', () => {
  test.setTimeout(60000);

  test('stylish cover renders correctly in community featured playlists', async ({ page }) => {
    await installMocks(page, {
      featuredPlaylists: [
        {
          id: 'stylish-1',
          name: 'Stylish Playlist',
          owner: 'admin',
          ownername: 'admin',
          coverType: 'stylish',
          stylishAssetName: 'mesh',
          gradientColorA: '#ff0000',
          gradientColorB: '#0000ff',
          songCount: 0,
          public: true,
          visibility: 'featured',
        }
      ]
    });

    await page.locator('.home-tab[data-tab="community"]').click();
    
    const card = page.locator('#community-featured-playlists .card[data-playlist-id="stylish-1"]');
    await expect(card).toBeVisible({ timeout: 20000 });

    const stylishCover = card.locator('.playlist-cover-stylish');
    await expect(stylishCover).toBeVisible();
    await expect(card.locator('.playlist-cover-stylish-title')).toContainText('Stylish Playlist');
  });

  test('uploaded cover (URL) renders correctly in community featured playlists', async ({ page }) => {
    const coverUrl = 'https://example.com/my-cover.jpg';

    await installMocks(page, {
      featuredPlaylists: [
        {
          id: 'uploaded-1',
          name: 'Uploaded Playlist',
          owner: 'admin',
          ownername: 'admin',
          coverType: 'uploaded',
          uploadedCoverId: coverUrl,
          songCount: 0,
          public: true,
          visibility: 'featured',
        }
      ]
    });

    await page.locator('.home-tab[data-tab="community"]').click();
    const card = page.locator('#community-featured-playlists .card[data-playlist-id="uploaded-1"]');
    await expect(card).toBeVisible({ timeout: 20000 });

    const img = card.locator('img.playlist-cover-uploaded');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('src', coverUrl);
  });

  test('uploaded cover (Navidrome ID) uses getCoverUrl in community featured playlists', async ({ page }) => {
    const navidromeId = 'p-12345';

    await installMocks(page, {
      featuredPlaylists: [
        {
          id: 'nav-id-1',
          name: 'Navidrome Cover Playlist',
          owner: 'admin',
          ownername: 'admin',
          coverType: 'uploaded',
          uploadedCoverId: navidromeId,
          songCount: 0,
          public: true,
          visibility: 'featured',
        }
      ]
    });

    await page.locator('.home-tab[data-tab="community"]').click();
    const card = page.locator('#community-featured-playlists .card[data-playlist-id="nav-id-1"]');
    await expect(card).toBeVisible({ timeout: 20000 });

    const img = card.locator('img.playlist-cover-uploaded');
    await expect(img).toBeVisible();

    const src = await img.getAttribute('src');
    expect(src).toContain('/rest/getCoverArt.view');
    expect(src).toContain('id=p-12345');
  });

  test('stylish cover renders in sidebar', async ({ page }) => {
    await installMocks(page);

    const playlistId = 'sidebar-stylish-1';
    await seedSidebarPlaylist(page, {
      id: playlistId,
      name: 'Sidebar Stylish Playlist',
      ownerUsername: 'admin',
      coverType: 'stylish',
      stylishAssetName: 'blob',
      gradientColorA: '#00ff00',
      gradientColorB: '#ffff00',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const sidebarItem = page.locator(`.sidebar-library-item[data-id="${playlistId}"]`);
    await expect(sidebarItem).toBeVisible({ timeout: 20000 });

    const stylishCover = sidebarItem.locator('.playlist-cover-stylish');
    await expect(stylishCover).toBeVisible();
    await expect(sidebarItem.locator('.playlist-cover-stylish-title')).toContainText('Sidebar Stylish Playlist');
  });

  test('uploaded cover renders in sidebar', async ({ page }) => {
    await installMocks(page);
    const coverUrl = 'https://example.com/sidebar-cover.jpg';
    const playlistId = 'sidebar-uploaded-1';

    await seedSidebarPlaylist(page, {
      id: playlistId,
      name: 'Sidebar Uploaded Playlist',
      ownerUsername: 'admin',
      coverType: 'uploaded',
      uploadedCoverId: coverUrl,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const sidebarItem = page.locator(`.sidebar-library-item[data-id="${playlistId}"]`);
    await expect(sidebarItem).toBeVisible({ timeout: 20000 });

    const img = sidebarItem.locator('img.playlist-cover-uploaded');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('src', coverUrl);
  });
});
