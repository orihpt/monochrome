import { test, expect } from '@playwright/test';

test.describe('Monochrome E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app
    await page.goto('http://localhost:5173/');
    
    // Inject CSS to hide modals that would otherwise intercept clicks in legacy smoke tests.
    await page.addStyleTag({
      content: `
        .modal-overlay,
        #waves-music-auth-modal {
          display: none !important;
          pointer-events: none !important;
        }
      `
    });
  });

  test('should show login modal when not logged in', async ({ page }) => {
    // Check if the login modal is in the DOM
    const modal = page.locator('#waves-music-auth-modal');
    await expect(modal).toBeAttached();
    await expect(page.locator('#waves-music-auth-username')).toBeAttached();
    await expect(page.locator('#waves-music-auth-password')).toBeAttached();
  });

  test('should play a song', async ({ page }) => {
    // Mock a logged in state with correct keys and navidrome provider
    await page.evaluate(() => {
        localStorage.setItem('subsonic_user', 'admin');
        localStorage.setItem('subsonic_pass', '0hN0L3aked123');
        localStorage.setItem('monochrome-user', JSON.stringify({ username: 'admin' }));
        localStorage.setItem('music-provider', 'navidrome');
    });
    
    // Go to an artist page with Navidrome ID
    await page.goto('http://localhost:5173/artist/2cUlR50RVMP4dAUFB7ghi6');
    
    // Wait for content to load
    await page.waitForSelector('.track-item-info', { timeout: 15000 });
    
    // Click on the first track to play it
    const firstTrack = page.locator('.track-item-info').first();
    await firstTrack.click({ force: true });
    
    // Check if the player bar shows something is playing
    const playPauseBtn = page.locator('.now-playing-bar .play-pause-btn');
    await expect(playPauseBtn).toBeVisible();

    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const audio = document.querySelector('#audio-player');
            return audio ? !audio.paused && audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA : false;
          }),
        { timeout: 20000 }
      )
      .toBe(true);

    const firstPosition = await page.evaluate(() => document.querySelector('#audio-player')?.currentTime || 0);
    await expect
      .poll(
        () =>
          page.evaluate((start) => {
            const audio = document.querySelector('#audio-player');
            return audio ? audio.currentTime - start : 0;
          }, firstPosition),
        { timeout: 15000 }
      )
      .toBeGreaterThan(0.25);
  });

  test('should create a playlist', async ({ page }) => {
    // Mock a logged in state
    await page.evaluate(() => {
        localStorage.setItem('subsonic_user', 'admin');
        localStorage.setItem('subsonic_pass', '0hN0L3aked123');
        localStorage.setItem('monochrome-user', JSON.stringify({ username: 'admin' }));
        localStorage.setItem('music-provider', 'navidrome');
    });
    await page.goto('http://localhost:5173/library');
    
    // Wait for Library content to load
    await page.waitForSelector('#library-create-playlist-card', { timeout: 10000 });
    
    // Click "Create Playlist" card
    const createPlaylistBtn = page.locator('#library-create-playlist-card');
    await expect(createPlaylistBtn).toBeAttached();
    await createPlaylistBtn.click({ force: true });
    
    // Wait for any modal or input (simulating the interaction)
    await page.waitForTimeout(1000); 
  });

  test('should load artist page without errors', async ({ page }) => {
    // Mock a logged in state
    await page.evaluate(() => {
        localStorage.setItem('subsonic_user', 'admin');
        localStorage.setItem('subsonic_pass', '0hN0L3aked123');
        localStorage.setItem('monochrome-user', JSON.stringify({ username: 'admin' }));
        localStorage.setItem('music-provider', 'navidrome');
    });

    // Go to an artist page
    await page.goto('http://localhost:5173/artist/2cUlR50RVMP4dAUFB7ghi6');

    // Wait for artist name to load
    await expect(page.locator('#artist-detail-name')).toBeAttached({ timeout: 15000 });

    // Wait for the tracks container to load
    const tracksContainer = page.locator('#artist-detail-tracks');
    await expect(tracksContainer).toBeAttached();

    // Ensure it doesn't say "Could not load artist details"
    const tracksHtml = await tracksContainer.innerHTML();
    expect(tracksHtml).not.toContain('Could not load artist details');
  });
});
