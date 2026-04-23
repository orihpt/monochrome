# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: monochrome.spec.js >> Monochrome E2E Tests >> should play a song
- Location: e2e/monochrome.spec.js:29:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('.track-item-info') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - heading "Panel" [level=3] [ref=e5]
  - generic [ref=e7]:
    - complementary [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]:
          - link "Spotiman Logo Spotiman" [ref=e11] [cursor=pointer]:
            - /url: https://spotiman.tf/
            - img "Spotiman Logo" [ref=e12]
            - generic [ref=e13]: Spotiman
          - button "Collapse Sidebar" [ref=e14] [cursor=pointer]:
            - img [ref=e15]
        - navigation [ref=e17]:
          - list [ref=e18]:
            - listitem [ref=e19]:
              - link "Home" [ref=e20] [cursor=pointer]:
                - /url: /
                - img [ref=e21]
                - generic [ref=e24]: Home
            - listitem [ref=e25]:
              - link "Library" [ref=e26] [cursor=pointer]:
                - /url: /library
                - img [ref=e27]
                - generic [ref=e29]: Library
            - listitem [ref=e30]:
              - link "Recent" [ref=e31] [cursor=pointer]:
                - /url: /recent
                - img [ref=e32]
                - generic [ref=e35]: Recent
            - listitem [ref=e36]:
              - link "Settings" [ref=e37] [cursor=pointer]:
                - /url: /settings
                - img [ref=e38]
                - generic [ref=e41]: Settings
        - navigation [ref=e44]:
          - list [ref=e45]:
            - listitem [ref=e46]:
              - link "Parties" [ref=e47] [cursor=pointer]:
                - /url: /parties
                - img [ref=e48]
                - generic [ref=e51]: Parties
            - listitem [ref=e52]:
              - link "About" [ref=e53] [cursor=pointer]:
                - /url: /about
                - img [ref=e54]
                - generic [ref=e57]: About
            - listitem [ref=e58]:
              - link "GitHub GitHub" [ref=e59] [cursor=pointer]:
                - /url: https://github.com/spotiman-music/spotiman
                - img "GitHub" [ref=e60]
                - generic [ref=e62]: GitHub
    - main [ref=e63]:
      - generic [ref=e64]:
        - generic [ref=e65]:
          - button "Go Back" [ref=e66] [cursor=pointer]:
            - img [ref=e67]
          - button "Go Forward" [ref=e69] [cursor=pointer]:
            - img [ref=e70]
        - generic [ref=e72]:
          - img
          - searchbox "Search for tracks, artists, albums..." [ref=e73]
        - button "Account" [ref=e75] [cursor=pointer]:
          - img [ref=e77]
      - generic [ref=e80]:
        - generic [ref=e81]:
          - img "Artist" [ref=e83]
          - generic [ref=e84]:
            - heading "JAŸ-Z" [level=1] [ref=e85]
            - generic [ref=e87]: undefined% popularity
            - generic [ref=e88]:
              - button "Artist Radio" [ref=e89] [cursor=pointer]:
                - img [ref=e90]
              - button "Shuffle" [ref=e92] [cursor=pointer]:
                - img [ref=e93]
              - button "Download" [ref=e96] [cursor=pointer]:
                - img [ref=e97]
              - button "Save to Favorites" [ref=e100] [cursor=pointer]:
                - img [ref=e101]
        - heading "Popular Tracks" [level=2] [ref=e104]
        - generic [ref=e105]:
          - heading "Albums" [level=2] [ref=e106]
          - generic [ref=e108]: No albums found.
        - button "Load Unreleased Projects" [ref=e110] [cursor=pointer]
    - contentinfo [ref=e111]:
      - generic [ref=e112]:
        - img "Current Track Cover" [ref=e113] [cursor=pointer]: 🎵
        - generic [ref=e115] [cursor=pointer]: Select a song
      - generic [ref=e116]:
        - generic [ref=e117]:
          - button "Shuffle" [ref=e118] [cursor=pointer]:
            - img [ref=e119]
          - button "Previous" [ref=e122] [cursor=pointer]:
            - img [ref=e123]
          - button "Play" [ref=e125] [cursor=pointer]:
            - img [ref=e126]
          - button "Next" [ref=e128] [cursor=pointer]:
            - img [ref=e129]
          - button "Repeat" [ref=e131] [cursor=pointer]:
            - img [ref=e132]
        - generic [ref=e136]:
          - generic [ref=e137]: 0:00
          - generic [ref=e139]: 0:00
      - generic [ref=e140]:
        - generic [ref=e141]:
          - button "Add to playlist" [ref=e142] [cursor=pointer]:
            - img [ref=e143]
          - button "Download current track" [ref=e145] [cursor=pointer]:
            - img [ref=e146]
          - button "Cast" [ref=e149] [cursor=pointer]:
            - img [ref=e150]
          - button "Queue" [ref=e152] [cursor=pointer]:
            - img [ref=e153]
        - generic [ref=e155]:
          - button "Mute" [ref=e156] [cursor=pointer]:
            - img [ref=e157]
          - button "Sleep Timer" [ref=e160] [cursor=pointer]:
            - img [ref=e161]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Monochrome E2E Tests', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Go to the app
  6  |     await page.goto('http://localhost:5173/');
  7  |     
  8  |     // Inject CSS to hide all modal overlays and error toasts to prevent click interception
  9  |     await page.addStyleTag({
  10 |       content: `
  11 |         .modal-overlay,
  12 |         #spotiman-auth-modal,
  13 |         div:has(> text("Unhandled Promise Rejection")) {
  14 |           display: none !important;
  15 |           pointer-events: none !important;
  16 |         }
  17 |       `
  18 |     });
  19 |   });
  20 | 
  21 |   test('should show login modal when not logged in', async ({ page }) => {
  22 |     // Check if the login modal is in the DOM
  23 |     const modal = page.locator('#spotiman-auth-modal');
  24 |     await expect(modal).toBeAttached();
  25 |     await expect(page.locator('#spotiman-auth-username')).toBeAttached();
  26 |     await expect(page.locator('#spotiman-auth-password')).toBeAttached();
  27 |   });
  28 | 
  29 |   test('should play a song', async ({ page }) => {
  30 |     // Mock a logged in state with correct keys and navidrome provider
  31 |     await page.evaluate(() => {
  32 |         localStorage.setItem('subsonic_user', 'admin');
  33 |         localStorage.setItem('subsonic_pass', 'admin');
  34 |         localStorage.setItem('monochrome-user', JSON.stringify({ username: 'admin' }));
  35 |         localStorage.setItem('music-provider', 'navidrome');
  36 |     });
  37 |     
  38 |     // Go to an artist page with Navidrome ID
  39 |     await page.goto('http://localhost:5173/artist/2s3tuz4Kd5Kf8WbutjNpaE');
  40 |     
  41 |     // Wait for content to load
> 42 |     await page.waitForSelector('.track-item-info', { timeout: 15000 });
     |                ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
  43 |     
  44 |     // Click on the first track to play it
  45 |     const firstTrack = page.locator('.track-item-info').first();
  46 |     await firstTrack.click({ force: true });
  47 |     
  48 |     // Check if the player bar shows something is playing
  49 |     const playPauseBtn = page.locator('.now-playing-bar .play-pause-btn');
  50 |     await expect(playPauseBtn).toBeVisible();
  51 |   });
  52 | 
  53 |   test('should create a playlist', async ({ page }) => {
  54 |     // Mock a logged in state
  55 |     await page.evaluate(() => {
  56 |         localStorage.setItem('subsonic_user', 'admin');
  57 |         localStorage.setItem('subsonic_pass', 'admin');
  58 |         localStorage.setItem('monochrome-user', JSON.stringify({ username: 'admin' }));
  59 |         localStorage.setItem('music-provider', 'navidrome');
  60 |     });
  61 |     await page.goto('http://localhost:5173/library');
  62 |     
  63 |     // Wait for Library content to load
  64 |     await page.waitForSelector('#library-create-playlist-card', { timeout: 10000 });
  65 |     
  66 |     // Click "Create Playlist" card
  67 |     const createPlaylistBtn = page.locator('#library-create-playlist-card');
  68 |     await expect(createPlaylistBtn).toBeAttached();
  69 |     await createPlaylistBtn.click({ force: true });
  70 |     
  71 |     // Wait for any modal or input (simulating the interaction)
  72 |     await page.waitForTimeout(1000); 
  73 |   });
  74 | 
  75 |   test('should load artist page without errors', async ({ page }) => {
  76 |     // Mock a logged in state
  77 |     await page.evaluate(() => {
  78 |         localStorage.setItem('subsonic_user', 'admin');
  79 |         localStorage.setItem('subsonic_pass', 'admin');
  80 |         localStorage.setItem('monochrome-user', JSON.stringify({ username: 'admin' }));
  81 |         localStorage.setItem('music-provider', 'navidrome');
  82 |     });
  83 | 
  84 |     // Go to an artist page
  85 |     await page.goto('http://localhost:5173/artist/2s3tuz4Kd5Kf8WbutjNpaE');
  86 | 
  87 |     // Wait for artist name to load
  88 |     await expect(page.locator('#artist-detail-name')).toBeAttached({ timeout: 15000 });
  89 | 
  90 |     // Wait for the tracks container to load
  91 |     const tracksContainer = page.locator('#artist-detail-tracks');
  92 |     await expect(tracksContainer).toBeAttached();
  93 | 
  94 |     // Ensure it doesn't say "Could not load artist details"
  95 |     const tracksHtml = await tracksContainer.innerHTML();
  96 |     expect(tracksHtml).not.toContain('Could not load artist details');
  97 |   });
  98 | });
  99 | 
```