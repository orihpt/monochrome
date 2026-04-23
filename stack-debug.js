import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => {
      console.log('PAGE ERROR:', err.message);
      console.log('STACK:', err.stack);
  });

  try {
    await page.goto('http://127.0.0.1:8080/');
    await page.waitForTimeout(5000);
    
    // Attempt login if modal is visible
    const authModal = await page.$('#spotiman-auth-modal');
    if (await authModal?.isVisible()) {
        await page.fill('#spotiman-auth-username', 'admin');
        await page.fill('#spotiman-auth-password', 'admin');
        await page.click('.auth-submit-btn');
        await page.waitForTimeout(5000);
    }
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await browser.close();
  }
})();
