import { test, expect } from '@playwright/test';

const json = (body) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

const song = (id, title, playCount = 0) => ({
  id,
  title,
  artist: 'Waves Artist',
  artistId: 'artist-1',
  album: 'Waves Album',
  albumId: 'album-1',
  coverArt: 'album-1',
  duration: 180,
  playCount,
});

async function installMocks(page, overrides = {}) {
  const state = {
    artistRequests: [
      { id: 'req-2', name: 'Beta Artist', status: 'wishlist', voteCount: 1, userVoted: false },
      { id: 'req-1', name: 'Alpha Artist', status: 'available_soon', voteCount: 4, userVoted: true },
    ],
    createdArtistRequests: [],
    ...overrides,
  };

  await page.addInitScript(() => {
    localStorage.setItem('subsonic_user', 'admin');
    localStorage.setItem('subsonic_pass', 'password');
    localStorage.setItem('monochrome-user', JSON.stringify({ username: 'admin' }));
    localStorage.setItem('music-provider', 'navidrome');
  });

  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.includes('/auth/login')) return route.fulfill(json({ token: 'native-token' }));
    if (url.includes('/api/user/search')) return route.fulfill(json([]));
    if (url.includes('/api/user/creator/profile')) {
      return route.fulfill(json({ id: 'creator', userName: 'creator', display_name: 'Creator User', playlists: [] }));
    }
    if (url.includes('/api/community/activity')) {
      return route.fulfill(json(state.communityActivity || {
        recentlyPlayed: [],
        mostPlayed: [],
        followingRecent: [],
      }));
    }
    if (url.includes('/api/community/featured')) {
      return route.fulfill(json(state.featuredPlaylists || []));
    }
    if (url.includes('/api/') || url.includes('/rest/')) {
      return route.fulfill(json({ 'subsonic-response': { status: 'ok' } }));
    }
    return route.continue();
  });

  await page.route('**/rest/getUser.view**', (route) => route.fulfill(json({
    'subsonic-response': {
      status: 'ok',
      user: { username: 'admin', name: 'Admin User', adminRole: true },
    },
  })));

  await page.route('**/rest/search3.view**', (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('query') || '';
    const playlist = state.searchPlaylists || [];
    return route.fulfill(json({
      'subsonic-response': {
        status: 'ok',
        searchResult3: {
          song: query ? [song('song-1', 'Saved Search Track', 5)] : [],
          album: query ? [{ id: 'album-1', name: 'Waves Album', artist: 'Waves Artist', artistId: 'artist-1', songCount: 1 }] : [],
          artist: query ? [{ id: 'artist-1', name: 'Waves Artist', albumCount: 1 }] : [],
          playlist,
        },
      },
    }));
  });

  await page.route('**/rest/getPlaylists.view**', (route) => route.fulfill(json({
    'subsonic-response': {
      status: 'ok',
      playlists: { playlist: state.searchPlaylists || [] },
    },
  })));

  await page.route('**/rest/getArtist.view**', (route) => route.fulfill(json({
    'subsonic-response': {
      status: 'ok',
      artist: {
        id: 'artist-1',
        name: 'Waves Artist',
        album: [{ id: 'album-1', name: 'Waves Album', artist: 'Waves Artist', artistId: 'artist-1', songCount: 13 }],
      },
    },
  })));

  await page.route('**/rest/getTopSongs.view**', (route) => route.fulfill(json({
    'subsonic-response': {
      status: 'ok',
      topSongs: { song: Array.from({ length: 15 }, (_, index) => song(`popular-${index}`, `Popular ${index}`, index)) },
    },
  })));

  await page.route('**/rest/getArtistRichInfo.view**', (route) => route.fulfill(json({
    'subsonic-response': {
      status: 'ok',
      artistRichInfo: {
        name: 'Waves Artist',
        biography: 'Local biography from info.json',
        genres: ['offline'],
        hasAvatar: true,
        hasHeader: false,
      },
    },
  })));

  await page.route('**/rest/getArtistRequestSuggestions.view**', (route) => route.fulfill(json({
    'subsonic-response': {
      status: 'ok',
      artistRequestSuggestions: {
        artist: [
          { id: 'artist-1', name: 'Waves Artist', hasAvatar: true, avatarUrl: '/rest/getArtistRichImage.view?id=artist-1&type=avatar' },
          { id: 'artist-2', name: 'No Image Artist', hasAvatar: false },
        ],
      },
    },
  })));

  await page.route('**/rest/getArtistRequests.view**', (route) => route.fulfill(json({
    'subsonic-response': {
      status: 'ok',
      artistRequests: { isAdmin: true, artistRequest: state.artistRequests },
    },
  })));

  await page.route('**/rest/createArtistRequest.view**', (route) => {
    const url = new URL(route.request().url());
    const name = url.searchParams.get('name');
    if (state.artistRequests.some((item) => item.name.toLowerCase() === String(name).toLowerCase())) {
      return route.fulfill(json({ 'subsonic-response': { status: 'failed', error: { message: 'duplicate' } } }));
    }
    const created = { id: `req-new-${state.createdArtistRequests.length}`, name, status: 'wishlist', voteCount: 1, userVoted: true };
    state.createdArtistRequests.push(created);
    state.artistRequests = [created, ...state.artistRequests];
    return route.fulfill(json({
      'subsonic-response': {
        status: 'ok',
        artistRequests: { isAdmin: true, artistRequest: state.artistRequests },
      },
    }));
  });

  await page.route('**/rest/getPlaylist.view**', (route) => route.fulfill(json({
    'subsonic-response': {
      status: 'ok',
      playlist: {
        id: 'featured-1',
        name: 'Featured Mix',
        owner: 'creator',
        public: true,
        visibility: 'featured',
        songCount: 1,
        entry: [song('song-99', 'Featured Song', 12)],
      },
    },
  })));

  await page.goto('/home');
  await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });
  return state;
}

async function seedPlaylist(page, playlist) {
  await page.evaluate(async (value) => {
    const { db } = await import('/js/db.js');
    await db.performTransaction('user_playlists', 'readwrite', (store) => store.put(value));
    window.dispatchEvent(new CustomEvent('refresh-home-editors-picks'));
  }, playlist);
}

async function seedFavoriteTrack(page, track) {
  await page.evaluate(async (value) => {
    const { db } = await import('/js/db.js');
    await db.toggleFavorite('track', value);
  }, track);
}

test.describe('WavesMusic regressions', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('marks search result songs already saved in a normal playlist', async ({ page }) => {
    await installMocks(page);
    await seedPlaylist(page, {
      id: 'playlist-local',
      name: 'Local Playlist',
      tracks: [{ id: 'song-1', title: 'Saved Search Track', artist: { id: 'artist-1', name: 'Waves Artist' } }],
      visibility: 'private',
      ownerUsername: 'admin',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      numberOfTracks: 1,
    });

    await page.goto('/search/saved');
    await expect(page.locator('#search-all-container [data-track-id="song-1"] .now-playing-library-btn')).toHaveClass(/in-library/);
  });

  test('marks search result songs already saved in liked songs', async ({ page }) => {
    await installMocks(page);
    await seedFavoriteTrack(page, { id: 'song-1', title: 'Saved Search Track', artist: { id: 'artist-1', name: 'Waves Artist' } });

    await page.goto('/search/saved');
    await expect(page.locator('#search-all-container [data-track-id="song-1"] .now-playing-library-btn')).toHaveClass(/in-library/);
  });

  test('shows local artist info and limits popular songs to the most played 12', async ({ page }) => {
    await installMocks(page);

    await page.goto('/artist/artist-1');
    await expect(page.locator('#artist-detail-bio')).toBeVisible();
    await expect(page.locator('#artist-detail-bio')).toContainText('Local biography from info.json');
    await expect(page.locator('#artist-detail-tracks .track-item')).toHaveCount(12);
    const firstTrackId = await page.locator('#artist-detail-tracks .track-item').first().getAttribute('data-track-id');
    expect(firstTrackId).toBe('popular-14');
  });

  test('hides empty home community sections and renders non-empty sections', async ({ page }) => {
    await installMocks(page, {
      communityActivity: {
        recentlyPlayed: [],
        mostPlayed: [song('song-2', 'Community Played', 9)],
        followingRecent: [],
      },
      featuredPlaylists: [],
    });

    await page.locator('.home-tab[data-tab="community"]').click();
    await expect(page.locator('#community-recently-played').locator('xpath=ancestor::section[1]')).toBeHidden();
    await expect(page.locator('#community-following-played').locator('xpath=ancestor::section[1]')).toBeHidden();
    await expect(page.locator('#community-featured-playlists').locator('xpath=ancestor::section[1]')).toBeHidden();
    await expect(page.locator('#community-most-played .track-item')).toHaveCount(1);
  });

  test('opens artist request modal, autocompletes artists, shows avatars, and creates requests without refresh', async ({ page }) => {
    const state = await installMocks(page);

    await page.locator('.home-tab[data-tab="artist-requests"]').click();
    await page.locator('.artist-request-new-btn').click();
    await expect(page.locator('.artist-request-modal')).toHaveClass(/active/);

    await page.locator('#artist-request-name-input').fill('waves');
    await expect(page.locator('.artist-autocomplete-result')).toHaveCount(2);
    await expect(page.locator('.artist-autocomplete-result').first().locator('.artist-autocomplete-avatar')).toBeVisible();
    await page.locator('.artist-autocomplete-result').first().click();
    await page.locator('#artist-request-modal-save').click();

    await expect(page.locator('.artist-request-row[data-request-id^="req-new-"]')).toBeVisible();
    expect(state.createdArtistRequests).toHaveLength(1);
  });

  test('renders artist request status, preserves sorting, and prevents duplicate creation', async ({ page }) => {
    const state = await installMocks(page);

    await page.locator('.home-tab[data-tab="artist-requests"]').click();
    await expect(page.locator('.artist-request-soon-row[data-status="available_soon"]')).toHaveCount(1);
    await expect(page.locator('.artist-request-row').first()).toHaveAttribute('data-request-id', 'req-2');

    await page.locator('.artist-request-new-btn').click();
    await page.locator('#artist-request-name-input').fill('Beta Artist');
    await page.locator('#artist-request-modal-save').click();
    await expect(page.locator('.artist-request-row[data-request-id="req-2"]')).toHaveCount(1);
    expect(state.createdArtistRequests).toHaveLength(0);
  });

  test('featured playlists show creator links and open userplaylist songs', async ({ page }) => {
    await installMocks(page);
    await seedPlaylist(page, {
      id: 'featured-1',
      name: 'Featured Mix',
      tracks: [{ id: 'song-99', title: 'Featured Song', artist: { id: 'artist-1', name: 'Waves Artist' } }],
      visibility: 'featured',
      ownerUsername: 'creator',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      numberOfTracks: 1,
    });

    await page.goto('/home');
    const card = page.locator('.featured-playlist-card[data-playlist-id="featured-1"]');
    await expect(card).toBeVisible();
    await expect(card.locator('.featured-playlist-creator')).toBeVisible();

    await card.locator('.featured-playlist-creator').click();
    await expect(page).toHaveURL(/\/user\/@creator$/);

    await page.goto('/home');
    await page.locator('.featured-playlist-card[data-playlist-id="featured-1"]').click();
    await expect(page).toHaveURL(/\/userplaylist\/featured-1$/);
    await expect(page.locator('#playlist-detail-tracklist .track-item[data-track-id="song-99"]')).toBeVisible();
  });

  test('searches playlist visibility and keeps user playlists last in all results', async ({ page }) => {
    await installMocks(page, {
      searchPlaylists: [
        { id: 'featured-1', name: 'Featured Mix', visibility: 'featured', public: true, songCount: 1, owner: 'creator' },
        { id: 'public-1', name: 'Public Mix', visibility: 'public', public: true, songCount: 1, owner: 'creator' },
        { id: 'private-other', name: 'Private Other', visibility: 'private', public: false, songCount: 1, owner: 'other' },
      ],
    });
    await seedPlaylist(page, {
      id: 'private-owned',
      name: 'Owned Private Mix',
      tracks: [],
      visibility: 'private',
      ownerUsername: 'admin',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      numberOfTracks: 0,
    });

    await page.goto('/search/mix');
    await page.locator('#page-search .search-tab[data-tab="playlists"]').click();
    await expect(page.locator('#search-playlists-container .search-result-playlist[data-playlist-id="featured-1"]')).toBeVisible();
    await expect(page.locator('#search-playlists-container .search-result-playlist[data-playlist-id="public-1"]')).toBeVisible();
    await expect(page.locator('#search-playlists-container .search-result-playlist[data-playlist-id="private-other"]')).toHaveCount(0);
    await expect(page.locator('#search-playlists-container .search-result-playlist[data-playlist-id="private-owned"]')).toBeVisible();

    await page.locator('#page-search .search-tab[data-tab="all"]').click();
    const lastKind = await page.locator('#search-all-container .search-all-row').last().getAttribute('data-result-kind');
    expect(lastKind).toBe('playlist');
  });

  test('deletes playlists without deleting underlying songs or leaving featured home cards', async ({ page }) => {
    await installMocks(page);
    await seedPlaylist(page, {
      id: 'featured-delete',
      name: 'Featured Delete Mix',
      tracks: [{ id: 'song-1', title: 'Saved Search Track', artist: { id: 'artist-1', name: 'Waves Artist' } }],
      visibility: 'featured',
      ownerUsername: 'admin',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      numberOfTracks: 1,
    });

    await page.goto('/home');
    await expect(page.locator('.featured-playlist-card[data-playlist-id="featured-delete"]')).toBeVisible();

    await page.goto('/userplaylist/featured-delete');
    await expect(page.locator('#playlist-detail-tracklist .track-item[data-track-id="song-1"]')).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#delete-playlist-btn, .playlist-delete-btn').first().click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.locator('[data-user-playlist-id="featured-delete"]')).toHaveCount(0);

    await page.goto('/home');
    await expect(page.locator('.featured-playlist-card[data-playlist-id="featured-delete"]')).toHaveCount(0);

    await page.goto('/search/saved');
    await expect(page.locator('#search-all-container .search-all-row[data-track-id="song-1"]')).toBeVisible();
  });
});
