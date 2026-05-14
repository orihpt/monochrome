import { test, expect } from '@playwright/test';

const ADMIN = 'admin';
const PASSWORD = '0hN0L3aked123';

const json = (body) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

async function installCommunityMocks(page) {
  const requests = { followed: [] };

  await page.addInitScript(({ username, password }) => {
    localStorage.setItem('subsonic_user', username);
    localStorage.setItem('subsonic_pass', password);
    localStorage.setItem('monochrome-user', JSON.stringify({ username }));
    localStorage.setItem('music-provider', 'navidrome');
  }, { username: ADMIN, password: PASSWORD });

  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('/auth/login')) {
      return route.fulfill(json({ token: 'test-native-token' }));
    }
    if (url.includes('/api/') || url.includes('/rest/')) {
      return route.fulfill(json({ 'subsonic-response': { status: 'ok' } }));
    }
    return route.continue();
  });

  await page.route('**/rest/getUser.view**', (route) => route.fulfill(json({
    'subsonic-response': {
      status: 'ok',
      user: { username: ADMIN, name: 'Admin User', adminRole: true },
    },
  })));

  await page.route('**/rest/search3.view**', (route) => route.fulfill(json({
    'subsonic-response': {
      status: 'ok',
      searchResult3: { song: [], album: [], artist: [], playlist: [] },
    },
  })));

  await page.route('**/api/user/search**', (route) => route.fulfill(json([
    { id: 'bob', userName: 'bob', name: 'Bob Listener' },
    { id: 'bea', userName: 'bea', name: 'Bea Beats' },
  ])));

  await page.route('**/api/user/bob/follow', (route) => {
    requests.followed.push(route.request().method());
    return route.fulfill(json({ id: 'bob', following: true }));
  });

  await page.route('**/api/user/bob/profile', (route) => route.fulfill(json({
    id: 'bob',
    userName: 'bob',
    display_name: 'Bob Listener',
    listeningArtists: [
      { id: 'artist-radiohead', name: 'Radiohead', playCount: 42 },
      { id: 'artist-bjork', name: 'Björk', playCount: 17 },
    ],
    playlists: [
      { id: 'public-mix', name: 'Public Kitchen Mix', visibility: 'public', numberOfTracks: 5 },
      { id: 'featured-mix', name: 'Featured Night Drive', visibility: 'featured', numberOfTracks: 8 },
      { id: 'private-drafts', name: 'Private Drafts', visibility: 'private', numberOfTracks: 2 },
    ],
  })));

  await page.route('**/api/community/activity**', (route) => route.fulfill(json({
    recentlyPlayed: [],
    mostPlayed: [],
    followingRecent: [
      {
        id: 'track-1',
        title: 'Everything In Its Right Place',
        artist: 'Radiohead',
        album: 'Kid A',
        duration: 251,
      },
    ],
  })));

  await page.route('**/api/community/featured**', (route) => route.fulfill(json([
    {
      id: 'featured-home',
      uuid: 'featured-home',
      name: 'Featured Home Screen Mix',
      title: 'Featured Home Screen Mix',
      visibility: 'featured',
      public: true,
      songCount: 9,
      numberOfTracks: 9,
    },
  ])));

  return requests;
}

test.describe('offline community features', () => {
  test.afterEach(async ({ page }) => {
    await expect(page.locator('.error-panel')).not.toBeVisible();
  });

  test('users can discover, follow, and view non-private listening profiles', async ({ page }) => {
    const requests = await installCommunityMocks(page);

    await page.goto('/search/bob');
    await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });

    const bobResult = page.locator('#search-all-container .card', { hasText: 'Bob Listener' }).first();
    await expect(bobResult).toBeVisible({ timeout: 15000 });

    const followButton = bobResult.locator('[data-action="follow-user"]');
    await followButton.click();
    await expect(followButton).toHaveText('Following');
    expect(requests.followed).toContain('POST');

    await bobResult.click();
    await expect(page).toHaveURL(/\/user\/@bob$/, { timeout: 10000 });
    await expect(page.locator('#profile-display-name')).toContainText('Bob Listener', { timeout: 15000 });

    await expect(page.locator('#profile-top-artists-container')).toContainText('Radiohead');
    await expect(page.locator('#profile-top-artists-container')).toContainText('Björk');
    await expect(page.locator('#profile-playlists-container')).toContainText('Public Kitchen Mix');
    await expect(page.locator('#profile-playlists-container')).toContainText('Featured Night Drive');
    await expect(page.locator('#profile-playlists-container')).not.toContainText('Private Drafts');

    await page.goto('/home');
    await page.locator('.home-tab[data-tab="community"]').click();
    await expect(page.locator('#community-following-played')).toContainText('Everything In Its Right Place', { timeout: 15000 });
    await expect(page.locator('#community-following-played')).toContainText('Radiohead');
  });

  test('featured playlists show on the Community home tab', async ({ page }) => {
    await installCommunityMocks(page);

    await page.goto('/home');
    await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });
    await page.locator('.home-tab[data-tab="community"]').click();

    const featured = page.locator('#community-featured-playlists .card', { hasText: 'Featured Home Screen Mix' });
    await expect(featured).toBeVisible({ timeout: 15000 });
    await expect(featured).toContainText('9 tracks');
  });
});
