// // playwright.config.js
// const { defineConfig, devices } = require('@playwright/test');

// module.exports = defineConfig({
//   testDir: './src',           // your test files location
//   timeout: 60000,             // max test timeout
//   retries: 0,                 // number of retries on failure
//   reporter: [['list']],       // console reporter
//   use: {
//     headless: false,          // always headed
//     browserName: 'chromium',  // force Chromium
//     screenshot: 'only-on-failure',  // screenshot only on failure
//     video: 'retain-on-failure',      // record video only on failure
//     viewport: { width: 1280, height: 720 },
//     ignoreHTTPSErrors: true,
    
//   },
// });

// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './src',
  timeout: 60000,
  retries: 0,
  reporter: [['list']],
  use: {
    headless: false,
    browserName: 'chromium',
    channel: 'chrome',  // 👈 use your system-installed Google Chrome
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },
});
