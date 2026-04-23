import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  try {
    console.log("Navigating to Spotiman UI...");
    await page.goto('http://127.0.0.1:8080/');
    
    // Wait for the UI to load
    await page.waitForTimeout(5000);
    
    // Check for auth modal
    const authModal = await page.$('#spotiman-auth-modal');
    const isVisible = await authModal?.isVisible();
    if (isVisible) {
        console.log("SUCCESS: Auth modal is visible!");
    } else {
        console.log("FAIL: Auth modal not found or not visible.");
    }
    
    // Check sidebar links
    const sidebar = await page.$('.sidebar');
    const sidebarText = await sidebar?.innerText();
    if (sidebarText?.includes('Donate') || sidebarText?.includes('Unreleased')) {
        console.log("FAIL: Donate or Unreleased link still present in Sidebar!");
    } else {
        console.log("SUCCESS: Sidebar items removed.");
    }
    
    // Check if we can login (admin/admin)
    console.log("Attempting login...");
    await page.fill('#spotiman-auth-username', 'admin');
    await page.fill('#spotiman-auth-password', 'admin');
    await page.click('.auth-submit-btn');
    
    // Wait for reload or modal to hide
    await page.waitForTimeout(5000);
    
    const isStillVisible = await authModal?.isVisible();
    if (!isStillVisible) {
        console.log("SUCCESS: Logged in and modal hidden!");
    } else {
        console.log("FAIL: Login failed or modal still visible.");
        const errorText = await page.$eval('#spotiman-auth-error', el => el.textContent);
        console.log("Auth Error Text:", errorText);
        await page.screenshot({ path: 'login_failed.png' });
    }
    
  } catch (error) {
    console.error("Error during UI test:", error);
  } finally {
    await browser.close();
  }
})();
