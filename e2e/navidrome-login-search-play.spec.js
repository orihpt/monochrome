import { test, expect } from '@playwright/test';

const USERNAME = 'admin';
const PASSWORD = '0hN0L3aked123';
const QUERY = 'THE DINER';
const ALBUM = 'HIT ME HARD AND SOFT';

test('logs in, searches THE DINER, opens its album, and plays the song', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();

  const loginModal = page.locator('#waves-music-auth-modal');
  await expect(loginModal).toBeVisible({ timeout: 15000 });

  await page.locator('#waves-music-auth-username').fill(USERNAME);
  await page.locator('#waves-music-auth-password').fill(PASSWORD);
  await page.locator('#waves-music-auth-form button[type="submit"]').click();

  await expect(loginModal).toBeHidden({ timeout: 20000 });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('subsonic_user'))).toBe(USERNAME);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('subsonic_pass'))).toBe(PASSWORD);
  await page.waitForFunction(() => window.__wavesAppReady === true, null, { timeout: 30000 });

  await expect(page.locator('#search-input')).toBeVisible({ timeout: 15000 });
  await page.locator('#search-input').fill(QUERY);
  await page.locator('#search-form').evaluate((form) => form.requestSubmit());
  await expect(page).toHaveURL(/\/search\/THE%20DINER$/, { timeout: 10000 });

  await page.locator('#page-search .search-tab[data-tab="tracks"]').click();
  const trackResult = page.locator('#search-tracks-container .track-item', { hasText: QUERY }).first();
  await expect(trackResult).toBeVisible({ timeout: 30000 });
  await expect(trackResult).toContainText('Billie Eilish');

  await page.locator('#page-search .search-tab[data-tab="albums"]').click();
  const albumResult = page.locator('#search-albums-container .card', { hasText: ALBUM }).first();
  await expect(albumResult).toBeVisible({ timeout: 10000 });
  await albumResult.click();

  await expect(page).toHaveURL(/\/album\//, { timeout: 10000 });
  await expect(page.locator('#album-detail-title')).toContainText(ALBUM, { timeout: 20000 });

  const albumTrack = page.locator('#album-detail-tracklist .track-item', { hasText: QUERY }).first();
  await expect(albumTrack).toBeVisible({ timeout: 20000 });
  await albumTrack.click();

  await expect(page.locator('.now-playing-bar .title')).toContainText(QUERY, { timeout: 20000 });
  await expect(page.locator('.now-playing-bar .artist')).toContainText('Billie Eilish', { timeout: 10000 });
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

  const pausedAfterTrackClick = await page.evaluate(() => {
    const audio = document.querySelector('#audio-player');
    return audio ? audio.paused : true;
  });
  if (pausedAfterTrackClick) {
    await page.locator('.now-playing-bar .play-pause-btn').click();
  }

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const audio = document.querySelector('#audio-player');
          return audio ? !audio.paused || audio.currentTime > 0 || audio.readyState >= 2 : false;
        }),
      { timeout: 20000 }
    )
    .toBe(true);
});
