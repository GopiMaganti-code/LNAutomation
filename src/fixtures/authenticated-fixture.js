/**
 * Authenticated Fixture
 * Provides authenticated page fixture for tests
 * Uses environment variables for login credentials
 */

const { test as base } = require("@playwright/test");
const { chromium } = require("@playwright/test");
const speakeasy = require("speakeasy");
const fs = require("fs");
const { addStealth } = require("../helpers/stealth");
const { humanType, humanMouse, humanIdle, randomDelay } = require("../helpers/human-interactions");

// Configuration from environment
const STORAGE_FILE =
  process.env.STORAGE_FILE || "linkedinStealth-state-Praneeth.json";
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days

/**
 * Login helper function
 * @param {Page} page - Playwright page object
 */
async function login(page) {
  if (!process.env.LINKEDIN_EMAIL || !process.env.LINKEDIN_PASSWORD) {
    throw new Error("Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env");
  }

  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await humanMouse(page, 3);
  await humanIdle(800, 1800);

  if (await page.locator("#username").isVisible({ timeout: 5000 })) {
    await humanType(page, "#username", process.env.LINKEDIN_EMAIL);
    await humanIdle(600, 1600);
    await humanType(page, "#password", process.env.LINKEDIN_PASSWORD);
    await humanIdle(600, 1600);
    await page
      .locator(`label[for='rememberMeOptIn-checkbox']`)
      .click()
      .catch(() => {
        // Silent fail - checkbox not found
      });
    await humanIdle(600, 1600);
    await page.locator('button[type="submit"]').click();
    await randomDelay(1000, 2000);

    // Handle 2FA if present
    const authLink = page.locator('a:has-text("Verify using authenticator app")');
    if (await authLink.isVisible({ timeout: 5000 })) {
      await authLink.click();
    }
    const totpInput = page.locator('input[name="pin"][maxlength="6"]');
    if (await totpInput.isVisible({ timeout: 5000 })) {
      if (!process.env.LINKEDIN_TOTP_SECRET) {
        throw new Error("TOTP required but LINKEDIN_TOTP_SECRET not set");
      }
      const token = speakeasy.totp({
        secret: process.env.LINKEDIN_TOTP_SECRET,
        encoding: "base32",
      });
      await humanType(page, 'input[name="pin"][maxlength="6"]', token);
      await randomDelay(700, 1400);
      await page
        .locator('#two-step-submit-button, button[type="submit"]')
        .first()
        .click();
    }

    await page
      .waitForURL("https://www.linkedin.com/feed/", { timeout: 60000 })
      .catch(() => {
        // Silent fail - feed not reached
      });
  }
}

/**
 * Extended test with authenticated page fixture
 */
const test = base.extend({
  authenticatedPage: async ({}, use) => {
    // Check if storage state exists and is valid
    const storageState =
      fs.existsSync(STORAGE_FILE) &&
      fs.statSync(STORAGE_FILE).mtimeMs > Date.now() - SESSION_MAX_AGE
        ? STORAGE_FILE
        : undefined;

    const browser = await chromium.launch({
      headless: false,
      args: ["--start-maximized"],
    });

    const context = await browser.newContext({
      viewport: null,
      locale: "en-US",
      timezoneId: "Asia/Kolkata",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      storageState,
    });

    const page = await context.newPage();
    await addStealth(page);

    // Login if storage state is not available or expired
    if (!storageState) {
      await login(page);
      await context.storageState({ path: STORAGE_FILE });
    } else {
      // Verify login by checking feed
      await page.goto("https://www.linkedin.com/feed/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      // If not logged in, login again
      if (await page.locator("#username").isVisible({ timeout: 5000 }).catch(() => false)) {
        await login(page);
        await context.storageState({ path: STORAGE_FILE });
      }
    }

    await use(page);

    await context.close();
    await browser.close();
  },
});

module.exports = { test };

