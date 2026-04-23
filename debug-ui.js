import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  try {
    console.log("Navigating to Spotiman UI...");
    await page.goto('http://127.0.0.1:5173/');
    
    await page.waitForTimeout(5000);
    
    // Check if auth modal is present
    const authModal = await page.$('#spotiman-auth-modal');
    if (await authModal?.isVisible()) {
        console.log("Auth modal is visible, logging in...");
        await page.fill('#spotiman-auth-username', 'admin');
        await page.fill('#spotiman-auth-password', 'admin');
        await page.click('.auth-submit-btn');
        await page.waitForTimeout(5000);
    }
    
    // Check for errors in the UI
    const bodyText = await page.innerText('body');
    console.log("Body text contains 'unstable'?", bodyText.includes('unstable'));
    console.log("Body text contains 'welcome'?", bodyText.includes('Welcome'));
    
    // Check if any cards are rendered
    const cards = await page.$$('.card');
    console.log(`Found ${cards.length} cards.`);
    
    await page.screenshot({ path: 'spotiman_debug.png' });
    
  } catch (error) {
    console.error("Error during UI test:", error);
  } finally {
    await browser.close();
  }
})();
