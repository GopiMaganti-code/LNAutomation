// const { test, expect } = require('@playwright/test');
// const fs = require('fs').promises;
// const path = require('path');

// test.describe('AWS Partner Scraper', () => {
//   test('Extract partner information', async ({ browser }) => {
//     let context = null;
//     let page = null;

//     try {
//       // Create stealth context
//       context = await browser.newContext({
//         viewport: { width: 1366, height: 768 },
//         userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//         extraHTTPHeaders: {
//           'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
//           'Accept-Language': 'en-US,en;q=0.9',
//         },
//         ignoreHTTPSErrors: true,
//       });

//       page = await context.newPage();

//       // Stealth script
//       await page.addInitScript(() => {
//         delete navigator.__proto__.webdriver;
//         window.chrome = { runtime: {} };
//         Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
//         Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
//       });

//       console.log('🌐 Navigating to AWS Partner page...');
      
//       const response = await page.goto('https://partners.amazonaws.com/partners/001E000000lZT8dIAG/Mission', {
//         waitUntil: 'networkidle',
//         timeout: 60000
//       });

//       expect(response.status()).toBeLessThan(400);

//       await page.waitForTimeout(3000);

//       // Extract data (same extraction logic as above)
//       const partnerData = await page.evaluate(() => {
//         const extractText = (selectors) => {
//           if (typeof selectors === 'string') selectors = [selectors];
//           for (const selector of selectors) {
//             const element = document.querySelector(selector);
//             if (element && element.textContent.trim()) {
//               return element.textContent.trim();
//             }
//           }
//           return null;
//         };

//         return {
//           companyName: extractText([`.partner-bio__header.h1`]),
//           description: extractText([`.partner-bio__description`, `.partner-bio__description p`]),
//           pageTitle: document.title,
//           url: window.location.href
//         };
//       });

//       // Save results
//       const jsonData = {
//         success: true,
//         timestamp: new Date().toISOString(),
//         partner: partnerData
//       };

//       const outputPath = path.join(__dirname, '../aws_partner_test_data.json');
//       await fs.writeFile(outputPath, JSON.stringify(jsonData, null, 2));

//       console.log('✅ Test completed successfully!');
//       console.log('Data:', JSON.stringify(partnerData, null, 2));

//       // Assertions
//       expect(partnerData.companyName).toBeTruthy();
//       expect(partnerData.url).toContain('partners.amazonaws.com');

//     } catch (error) {
//       console.error('❌ Test failed:', error.message);
      
//       if (page) {
//         await page.screenshot({ path: 'test-error.png', fullPage: true });
//       }
      
//       throw error;
//     } finally {
//       if (page) await page.close().catch(() => {});
//       if (context) await context.close().catch(() => {});
//     }
//   });
// });





import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://www.linkedin.com/');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email or phone' }).click();
  await page.getByRole('textbox', { name: 'Email or phone' }).fill('tanujapeddi99@gmail.com');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('Vamsi@8010');
  await page.getByText('Keep me logged in').click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Verify using authenticator app' }).click();
  await page.getByRole('textbox', { name: 'Please enter the code here' }).click();
  await page.getByRole('textbox', { name: 'Please enter the code here' }).fill('581095');
  await page.getByRole('textbox', { name: 'Please enter the code here' }).press('Enter');
  await page.getByRole('button', { name: 'Submit code' }).click();
  await page.getByRole('button', { name: 'React Celebrate' }).click();
  await page.getByRole('button', { name: 'React Support' }).click();
  await page.getByRole('button', { name: 'React Love' }).click();
  await page.getByRole('button', { name: 'React Insightful' }).click();
  await page.locator('#ember576').getByRole('button', { name: 'React Like' }).first().click();
});