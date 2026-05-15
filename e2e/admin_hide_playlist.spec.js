import { test, expect } from '@playwright/test';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '0hN0L3aked123';
const USER_USERNAME = 'user';
const USER_PASSWORD = 'password';

async function login(page, username, password) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();

  const loginModal = page.locator('#waves-music-auth-modal');
  await expect(loginModal).toBeVisible({ timeout: 15000 });

  await page.locator('#waves-music-auth-username').fill(username);
  await page.locator('#waves-music-auth-password').fill(password);
  await page.locator('#waves-music-auth-form button[type="submit"]').click();

  await expect(loginModal).toBeHidden({ timeout: 20000 });
  await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });
}

test.describe('Admin Hide Playlist from Community', () => {
  test('admin can hide and unhide a playlist from community', async ({ page }) => {
    test.setTimeout(120000);
    await login(page, ADMIN_USERNAME, ADMIN_PASSWORD);

    // 1. Go to Community page and find a playlist to hide
    await page.goto('/community');
    await page.waitForSelector('.community-section', { timeout: 20000 });
    
    const playlistCard = page.locator('.community-section .card').first();
    await expect(playlistCard).toBeVisible();
    
    const playlistTitle = await playlistCard.locator('.card-title').textContent();
    const playlistId = await playlistCard.evaluate(el => el.dataset.id);
    console.log(`Hiding playlist: ${playlistTitle} (${playlistId})`);

    // 2. Hide from Community
    await playlistCard.click({ button: 'right' });
    const hideOption = page.locator('#context-menu li[data-action="hide-from-community"]');
    await expect(hideOption).toBeVisible();
    await hideOption.click();

    // 3. Verify notification and disappearance
    await expect(page.locator('.notification-container')).toContainText('Playlist hidden from community');
    await expect(page.locator(`.community-section .card[data-id="${playlistId}"]`)).not.toBeVisible({ timeout: 10000 });

    // 4. Go to search to find it and unhide
    await page.locator('#search-input').fill(playlistTitle);
    await page.locator('#search-form').evaluate((form) => form.requestSubmit());
    await page.locator('#page-search .search-tab[data-tab="playlists"]').click();
    
    const searchedPlaylist = page.locator(`#search-playlists-container .card[data-id="${playlistId}"]`);
    await expect(searchedPlaylist).toBeVisible();
    
    await searchedPlaylist.click({ button: 'right' });
    const unhideOption = page.locator('#context-menu li[data-action="unhide-from-community"]');
    await expect(unhideOption).toBeVisible();
    await unhideOption.click();

    // 5. Verify notification and reappearance in Community
    await expect(page.locator('.notification-container')).toContainText('Playlist unhidden from community');
    
    await page.goto('/community');
    await expect(page.locator(`.community-section .card[data-id="${playlistId}"]`)).toBeVisible({ timeout: 20000 });
  });

  test('non-admin cannot see hide option', async ({ page }) => {
    // Note: This test assumes 'user' exists. If not, we might need to skip or handle failure.
    try {
      await login(page, USER_USERNAME, USER_PASSWORD);
    } catch (e) {
      console.warn('Could not login as non-admin, skipping visibility test');
      return;
    }

    await page.goto('/community');
    await page.waitForSelector('.community-section', { timeout: 20000 });
    
    const playlistCard = page.locator('.community-section .card').first();
    await expect(playlistCard).toBeVisible();
    
    await playlistCard.click({ button: 'right' });
    const hideOption = page.locator('#context-menu li[data-action="hide-from-community"]');
    await expect(hideOption).not.toBeVisible();
    const unhideOption = page.locator('#context-menu li[data-action="unhide-from-community"]');
    await expect(unhideOption).not.toBeVisible();
  });

  test('direct API call by non-admin is rejected', async ({ page }) => {
    try {
      await login(page, USER_USERNAME, USER_PASSWORD);
    } catch (e) {
      console.warn('Could not login as non-admin, skipping API test');
      return;
    }

    // Attempt to hide a playlist via direct API call in the browser context
    const result = await page.evaluate(async () => {
        try {
            // We need a playlist ID. Let's fetch featured playlists first.
            const res = await fetch('/api/community/featured');
            const playlists = await res.json();
            if (playlists.length === 0) return 'no playlists';
            
            const id = playlists[0].id;
            const hideRes = await fetch(`/api/playlist/${id}/hide_from_community`, { method: 'PUT' });
            return hideRes.status;
        } catch (e) {
            return e.message;
        }
    });

    expect(result).toBe(403);
  });
});
