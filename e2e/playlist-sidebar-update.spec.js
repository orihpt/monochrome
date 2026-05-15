import { test, expect } from '@playwright/test';

const json = (body) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

async function installMocks(page) {
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
    return route.fulfill(json([]));
  });

  await page.goto('/home');
  await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });
}

test('playlist cover updates in sidebar immediately after edit', async ({ page }) => {
  await installMocks(page);

  const playlistId = 'test-playlist-123';
  const playlistName = 'Test Sidebar Update';

  // Seed playlist in IndexedDB
  await page.evaluate(async ({ id, name }) => {
    const { db } = await import('/js/db.js');
    await db.addPlaylistToLibrary({
      id,
      name,
      ownerUsername: 'admin',
      coverType: 'albumGrid',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tracks: []
    });
  }, { id: playlistId, name: playlistName });

  // Refresh to make sure it shows in sidebar
  await page.reload();
  await page.waitForFunction(() => window.__wavesAppReady === true);

  const sidebarItem = page.locator(`.sidebar-library-item[data-id="${playlistId}"]`);
  await expect(sidebarItem).toBeVisible();
  
  // Initially should not be stylish
  await expect(sidebarItem.locator('.playlist-cover-stylish')).not.toBeVisible();

  // Go to playlist page
  await page.goto(`/userplaylist/${playlistId}`);
  
  // Click edit button
  const editBtn = page.locator('#edit-playlist-btn');
  await expect(editBtn).toBeVisible();
  await editBtn.click();
  
  await expect(page.locator('#playlist-modal')).toHaveClass(/active/);

  // Change to stylish cover
  // Click the first stylish option
  const stylishOption = page.locator('.playlist-cover-option[data-cover-type="stylish"]').first();
  await stylishOption.click();
  
  // Save
  await page.locator('#playlist-modal-save').click();
  await expect(page.locator('#playlist-modal')).not.toHaveClass(/active/);

  // CHECK SIDEBAR - This is where it's expected to FAIL currently
  // We expect the stylish cover to be visible in the sidebar immediately
  const sidebarStylishCover = sidebarItem.locator('.playlist-cover-stylish');
  await expect(sidebarStylishCover).toBeVisible({ timeout: 5000 });
});
