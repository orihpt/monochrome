import { expect, test } from '@playwright/test';

const json = (body) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

const systemPlaylist = {
  id: 'system-1',
  name: 'System Mix',
  songCount: 1,
  duration: 240,
  public: true,
  owner: 'WavesMusic',
  visibility: 'featured',
  fileBasedFeatured: true,
  filebasedfeatured: true,
  readonly: true,
  coverArt: 'pl-system-1_0',
};

const communityPlaylist = {
  id: 'community-1',
  name: 'Community Mix',
  songCount: 2,
  public: true,
  visibility: 'featured',
  coverArt: 'pl-community-1_0',
};

async function installMocks(page, { includeSystem = true } = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('subsonic_user', 'admin');
    localStorage.setItem('subsonic_pass', 'password');
    localStorage.setItem('music-provider', 'navidrome');
  });

  const playlists = includeSystem ? [systemPlaylist, communityPlaylist] : [communityPlaylist];

  await page.route('**/auth/login', (route) => route.fulfill(json({ token: 'native-token' })));
  await page.route('**/api/user/sync', (route) => route.fulfill(json({})));
  await page.route('**/api/user/search**', (route) => route.fulfill(json([])));
  await page.route('**/api/playlist/**', (route) => route.fulfill(json(playlists)));
  await page.route('**/api/community/activity**', (route) => route.fulfill(json({
    recentlyPlayed: [],
    mostPlayed: [],
    followingRecent: [],
  })));
  await page.route('**/api/community/featured**', (route) => route.fulfill(json([communityPlaylist])));
  await page.route('**/api/community/popular-playlists**', (route) => route.fulfill(json([communityPlaylist])));

  await page.route(/.*\/rest\/ping(\.view)?.*/, (route) => route.fulfill(json({ 'subsonic-response': { status: 'ok' } })));
  await page.route(/.*\/rest\/getUser(\.view)?.*/, (route) => route.fulfill(json({
    'subsonic-response': { status: 'ok', user: { username: 'admin', adminRole: true } },
  })));
  await page.route(/.*\/rest\/getPlaylists(\.view)?.*/, (route) => route.fulfill(json({
    'subsonic-response': { status: 'ok', playlists: { playlist: playlists } },
  })));
  await page.route(/.*\/rest\/search3(\.view)?.*/, (route) => route.fulfill(json({
    'subsonic-response': { status: 'ok', searchResult3: { song: [], album: [], artist: [] } },
  })));
  await page.route(/.*\/rest\/getPlaylist(\.view)?.*/, (route) => route.fulfill(json({
    'subsonic-response': {
      status: 'ok',
      playlist: {
        ...systemPlaylist,
        entry: [{
          id: 'song-1',
          title: 'CHIHIRO',
          artist: 'Billie Eilish',
          album: 'HIT ME HARD AND SOFT',
          duration: 240,
          coverArt: 'al-1_0',
        }],
      },
    },
  })));
  await page.route(/.*\/rest\/getCoverArt(\.view)?.*/, (route) => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
  }));
  await page.route(/.*\/rest\/stream(\.view)?.*/, (route) => route.fulfill({
    status: 200,
    contentType: 'audio/mpeg',
    body: Buffer.from(''),
  }));
  await page.route('**/rest/**', (route) => {
    const url = route.request().url();
    if (url.includes('/getPlaylists')) {
      return route.fulfill(json({ 'subsonic-response': { status: 'ok', playlists: { playlist: playlists } } }));
    }
    if (url.includes('/getPlaylist')) {
      return route.fulfill(json({
        'subsonic-response': {
          status: 'ok',
          playlist: {
            ...systemPlaylist,
            entry: [{
              id: 'song-1',
              title: 'CHIHIRO',
              artist: 'Billie Eilish',
              album: 'HIT ME HARD AND SOFT',
              duration: 240,
              coverArt: 'al-1_0',
            }],
          },
        },
      }));
    }
    if (url.includes('/search3')) {
      return route.fulfill(json({ 'subsonic-response': { status: 'ok', searchResult3: { song: [], album: [], artist: [] } } }));
    }
    return route.fulfill(json({ 'subsonic-response': { status: 'ok' } }));
  });
}

test.describe('file-based featured playlists', () => {
  test('home shows system section first and show all lists system playlists', async ({ page }) => {
    await installMocks(page);
    await page.goto('/');
    await page.waitForFunction(() => window.__wavesAppReady === true);

    const section = page.locator('.home-file-based-featured-playlists-section');
    await expect(section).toBeVisible();
    await expect(page.locator('#home-content .content-section').first()).toHaveClass(/home-file-based-featured-playlists-section/);
    await expect(section.locator('.file-based-featured-playlist-card')).toHaveCount(1);

    await page.locator('.file-based-featured-playlists-show-all').click();
    await expect(page.locator('.file-based-featured-playlists-page')).toBeVisible();
    await expect(page.locator('.file-based-featured-playlists-page .file-based-featured-playlist-card')).toHaveCount(1);
  });

  test('home hides system section when no file-based playlists exist', async ({ page }) => {
    await installMocks(page, { includeSystem: false });
    await page.goto('/');
    await page.waitForFunction(() => window.__wavesAppReady === true);

    await expect(page.locator('.home-file-based-featured-playlists-section')).toBeHidden();
  });

  test('system playlists open, are readonly, appear in search, and are excluded from community', async ({ page }) => {
    await installMocks(page);
    await page.goto('/search/System');
    await page.waitForFunction(() => window.__wavesAppReady === true);

    await expect(page.locator('.search-result-playlist.file-based-featured-playlist-card').first()).toBeVisible();
    await page.locator('.search-result-playlist.file-based-featured-playlist-card').first().click();
    await expect(page.locator('#page-playlist.playlist-readonly')).toBeVisible();
    await expect(page.locator('#edit-playlist-btn')).toHaveCount(0);
    await expect(page.locator('#delete-playlist-btn')).toHaveCount(0);
    await expect(page.locator('.playlist-add-to-library-btn')).toBeVisible();

    await page.goto('/home');
    await page.locator('.home-tab[data-tab="community"]').click();
    await expect(page.locator('#community-featured-playlists .file-based-featured-playlist-card')).toHaveCount(0);
  });
});
